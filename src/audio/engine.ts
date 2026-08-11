import { MAX_VOICES, NUM_PADS, PPQN, TICKS_PER_16TH } from './types';
import type { AutoParam, Pad, Project, SeqEvent, Sequence } from './types';
import { triggerVoice, voiceFrameAt, type Voice } from './voice';
import { resolvePlayback as resolvePlaybackShared, reverseBuffer, warpRate as warpRateShared } from './playback';
import { Scheduler, type TransportState, ticksPerBar } from './scheduler';
import { KnobFX, type KnobFXId } from './fx/knobfx';
import { PadFXRack, type PadFXId } from './fx/padfx';
import { FlexBeat } from './fx/flexbeat';
import { Recorder } from './recorder';
import { Arp } from './arp';
import { midi } from '../midi/midi';
import { dspWorkletUrl } from './worklets/dspSource';

/**
 * The engine owns all audio state. It is deliberately framework-free: the UI
 * posts commands in and polls telemetry out. Nothing here triggers a React
 * render — wiring React state into the audio path is the reliable way to
 * introduce glitches.
 */
export class Engine {
  ctx: AudioContext | null = null;

  private master!: GainNode;
  private compressor!: DynamicsCompressorNode;
  private kitGain!: GainNode;
  private padGains: GainNode[] = [];
  /** Persistent per-pad panners (pad.pan lives here so it's live-automatable). */
  private padPanners: StereoPannerNode[] = [];
  private analyser!: AnalyserNode;
  knobFX!: KnobFX;
  padFX!: PadFXRack;
  flexBeat!: FlexBeat;
  recorder!: Recorder;
  workletsReady = false;
  private knobSends: GainNode[] = [];
  private knobReturn!: GainNode;
  private compBypass!: GainNode;
  private compDry!: GainNode;
  private colorDrive!: WaveShaperNode;
  private colorMix!: GainNode;
  private inBoostGain!: GainNode;
  compressorBypass = false;
  compressorColor = false;
  knobFXRouting = Array.from({ length: 16 }, () => true);
  knobFXBypass = false;

  // Send FX buses
  private reverbConvolver!: ConvolverNode;
  private reverbReturn!: GainNode;
  private delayNode!: DelayNode;
  private delayFeedback!: GainNode;
  private delayReturn!: GainNode;
  private padReverbSends: GainNode[] = [];
  private padDelaySends: GainNode[] = [];

  private buffers = new Map<string, AudioBuffer>();
  private reversed = new Map<string, AudioBuffer>();
  private stretched = new Map<string, AudioBuffer>();
  private voices: Voice[] = [];

  private project: Project | null = null;
  private currentBank = 0;
  private currentSeqSlot = 0;
  /** Playhead preserved for CONTINUE after stop. */
  pausedAt = 0;
  songMode = false;
  songIndex = 0;
  onRecordHit: ((ev: SeqEvent) => void) | null = null;
  onSongStepChange: ((bank: number, slot: number) => void) | null = null;
  /** Fired at each sequence loop boundary (not during song chain). */
  onSeqLoopEnd: (() => void) | null = null;

  /** Per-pad solo mask. When any bit is set, only soloed pads sound. */
  soloMask: boolean[] = Array.from({ length: NUM_PADS }, () => false);

  /** Pad Play modes. Set from the UI; consulted on every trigger. */
  chopMode = false;
  levelsMode = false;
  /** Which pad's sample chop/16-levels operate on. */
  selectedPad = 0;
  levelsType: 'velocity' | 'filter' | 'tune' = 'velocity';
  fullLevel = false;

  scheduler!: Scheduler;

  /** Keyboard arpeggiator — BPM-synced, runs independent of the transport. */
  arp = new Arp({
    bpm: () => {
      const p = this.project;
      if (!p) return 120;
      return p.bpmScope === 'global' ? p.bpm : this.activeSequence()?.bpm ?? p.bpm;
    },
    trigger: (pad, note, vel) =>
      this.triggerWithNote(pad, vel, this.ctx?.currentTime ?? 0, note),
  });

  /** Telemetry the UI polls on rAF. Never a React state update from here. */
  telemetry = {
    playing: false,
    recording: false,
    recordingLive: false,
    step: 0,
    positionTicks: 0,
    level: 0,
    padActivity: new Array<number>(NUM_PADS).fill(0),
    /** Timestamp when pad last fired from sequencer (for pad lights). */
    seqPadLit: new Array<number>(NUM_PADS).fill(0),
    /** Current sample frame per pad while sounding (-1 = silent). */
    samplePlayhead: new Array<number>(NUM_PADS).fill(-1),
  };

  private meterData = new Uint8Array(0);

  get ready() {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  /**
   * Must be called from inside a user gesture. iOS requires both the
   * construction and the resume to happen in that gesture.
   */
  async init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      return;
    }

    const ctx = new AudioContext({ latencyHint: 'interactive' });
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.compressor = ctx.createDynamicsCompressor();
    this.kitGain = ctx.createGain();
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.meterData = new Uint8Array(this.analyser.frequencyBinCount);

    // Compressor starts effectively transparent; the Compressor page drives it.
    this.compressor.threshold.value = 0;
    this.compressor.ratio.value = 1.5;
    this.compressor.attack.value = 0.012;
    this.compressor.release.value = 0.11;

    // Load the DSP worklets before building anything that needs them. If this
    // fails the FX degrade to dry rather than breaking playback.
    try {
      const url = dspWorkletUrl();
      await ctx.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      this.workletsReady = true;
    } catch {
      this.workletsReady = false;
    }

    this.knobFX = new KnobFX(ctx);
    this.padFX = new PadFXRack(ctx);
    this.flexBeat = new FlexBeat(ctx, this.workletsReady);

    this.inBoostGain = ctx.createGain();
    this.inBoostGain.gain.value = 1;
    this.compBypass = ctx.createGain();
    this.compDry = ctx.createGain();
    this.colorDrive = ctx.createWaveShaper();
    this.colorDrive.curve = this.makeColorCurve(0);
    this.colorMix = ctx.createGain();
    this.colorMix.gain.value = 0;
    this.knobReturn = ctx.createGain();
    this.knobReturn.gain.value = 1;

    // Per-pad knob FX sends (return adds to kit bus).
    this.knobSends = Array.from({ length: NUM_PADS }, () => ctx.createGain());
    for (const s of this.knobSends) {
      s.connect(this.knobFX.input);
    }
    this.knobFX.output.connect(this.knobReturn);
    this.knobReturn.connect(this.kitGain);

    // kit -> inBoost -> compressor (+ color) -> padFX -> flexBeat -> master
    this.kitGain.connect(this.inBoostGain);
    this.inBoostGain.connect(this.compressor);
    this.compressor.connect(this.compDry);
    this.compDry.connect(this.compBypass);
    this.compDry.connect(this.colorDrive);
    this.colorDrive.connect(this.colorMix);
    this.colorMix.connect(this.compBypass);
    this.compBypass.connect(this.padFX.input);
    this.padFX.output.connect(this.flexBeat.input);
    this.flexBeat.output.connect(this.master);
    this.master.connect(this.analyser);
    this.master.connect(ctx.destination);

    this.recorder = new Recorder(ctx, this.master);

    // Persistent per-pad gain + pan nodes. Created once, never torn down.
    // Chain: padGains[i] (volume) -> padPanners[i] (pan) -> kitGain.
    this.padPanners = Array.from({ length: NUM_PADS }, () => {
      const p = ctx.createStereoPanner();
      p.connect(this.kitGain);
      return p;
    });
    this.padGains = Array.from({ length: NUM_PADS }, (_, i) => {
      const g = ctx.createGain();
      g.connect(this.padPanners[i]);
      return g;
    });

    // Reverb send: convolver with a synthetic impulse response
    this.reverbConvolver = ctx.createConvolver();
    this.reverbReturn = ctx.createGain();
    this.reverbReturn.gain.value = 1;
    const irLen = Math.floor(ctx.sampleRate * 2.0);
    const ir = ctx.createBuffer(2, irLen, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = ir.getChannelData(ch);
      for (let i = 0; i < irLen; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 2.5);
      }
    }
    this.reverbConvolver.buffer = ir;
    this.reverbConvolver.connect(this.reverbReturn);
    this.reverbReturn.connect(this.kitGain);

    // Delay send: delay + feedback loop
    this.delayNode = ctx.createDelay(2.0);
    this.delayNode.delayTime.value = 0.375; // 1/4 note at 160bpm default
    this.delayFeedback = ctx.createGain();
    this.delayFeedback.gain.value = 0.35;
    this.delayReturn = ctx.createGain();
    this.delayReturn.gain.value = 1;
    this.delayNode.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delayNode);
    this.delayNode.connect(this.delayReturn);
    this.delayReturn.connect(this.kitGain);

    // Per-pad send gains for reverb and delay (default to 0)
    this.padReverbSends = Array.from({ length: NUM_PADS }, () => {
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(this.reverbConvolver);
      return g;
    });
    this.padDelaySends = Array.from({ length: NUM_PADS }, () => {
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(this.delayNode);
      return g;
    });
    // Connect pad outputs to their send buses
    for (let i = 0; i < NUM_PADS; i++) {
      this.padGains[i].connect(this.padReverbSends[i]);
      this.padGains[i].connect(this.padDelaySends[i]);
    }

    this.syncKnobFXRouting();

    this.scheduler = new Scheduler({
      ctx,
      getSequence: () => this.activeSequence(),
      getBpm: () => {
        const p = this.project;
        if (!p) return 120;
        return p.bpmScope === 'global' ? p.bpm : this.activeSequence()?.bpm ?? p.bpm;
      },
      getSwing: () => this.project?.swing ?? 50,
      getTimeSignature: () => this.project?.timeSignature ?? [4, 4],
      getHumanize: () => this.project?.humanize ?? { timing: 0, velocity: 0 },
      metronomeEnabled: () => {
        const m = this.project?.metronome ?? 'off';
        return m === 'on' || (m === 'record' && this.telemetry.recording);
      },
      countInBars: () => (this.project?.countIn ? 1 : 0),
      click: (when, accent) => this.click(when, accent),
      playEvent: (e, when, velocityOverride) => this.playEvent(e, when, velocityOverride),
      applyAutomation: (evt, when) => this.applyAutomation(evt.param, evt.pad, evt.value, when),
      onPosition: (s: TransportState) => {
        this.telemetry.playing = s.playing;
        this.telemetry.recording = s.recording;
        this.telemetry.recordingLive = s.recordingLive;
        this.telemetry.step = s.currentStep;
        this.telemetry.positionTicks = s.positionTicks;
      },
      onLoopComplete: () => this.onSequenceLoopComplete(),
      onMidiClock: () => midi.clock(),
    });

    await ctx.resume();
  }

  setProject(p: Project) {
    this.project = p;
    this.syncSendLevels(p);
  }

  private syncSendLevels(p: Project) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const bank = p.banks[this.currentBank];
    if (!bank) return;
    for (let i = 0; i < NUM_PADS; i++) {
      const pad = bank[i];
      if (!pad) continue;
      const rv = (pad.reverbSend ?? 0) / 127;
      const dl = (pad.delaySend ?? 0) / 127;
      this.padReverbSends[i]?.gain.setTargetAtTime(rv, t, 0.01);
      this.padDelaySends[i]?.gain.setTargetAtTime(dl, t, 0.01);
      // Static volume + pan live on the persistent per-pad nodes.
      const g = pad.gain <= -74 ? 0 : Math.pow(10, pad.gain / 20);
      this.padGains[i]?.gain.setTargetAtTime(g, t, 0.01);
      this.padPanners[i]?.pan.setTargetAtTime(Math.max(-1, Math.min(1, pad.pan)), t, 0.01);
    }
    // Update delay time from BPM
    const bpm = p.bpmScope === 'global' ? p.bpm : p.bpm;
    if (this.delayNode) {
      const quarterSec = 60 / bpm;
      this.delayNode.delayTime.setTargetAtTime(quarterSec, t, 0.01);
    }
  }

  setBank(b: number) {
    this.currentBank = b;
  }

  private soloActive() {
    return this.soloMask.some(Boolean);
  }

  setSolo(padIndex: number, on: boolean) {
    if (padIndex >= 0 && padIndex < this.soloMask.length) this.soloMask[padIndex] = on;
  }

  clearSolos() {
    this.soloMask.fill(false);
  }

  setSequenceSlot(i: number) {
    this.currentSeqSlot = i;
  }

  activeSequence(): Sequence | null {
    return this.project?.sequences[this.currentBank]?.[this.currentSeqSlot] ?? null;
  }

  private activePad(index: number, bank = this.currentBank): Pad | null {
    return this.project?.banks[bank]?.[index] ?? null;
  }

  // ---------------------------------------------------------------- samples

  async loadSample(id: string, data: ArrayBuffer): Promise<AudioBuffer> {
    if (!this.ctx) throw new Error('Engine not initialised');
    const buf = await this.ctx.decodeAudioData(data.slice(0));
    this.buffers.set(id, buf);
    this.stretched.clear();
    return buf;
  }

  putBuffer(id: string, buf: AudioBuffer) {
    this.buffers.set(id, buf);
    this.stretched.clear();
  }

  clearStretchCache() {
    this.stretched.clear();
  }

  getBuffer(id: string | null): AudioBuffer | null {
    return id ? this.buffers.get(id) ?? null : null;
  }

  /**
   * Web Audio can't play a buffer backwards, so reverse playback needs a
   * mirrored copy. Built lazily and cached — the cost is paid once per sample.
   */
  private getReversed(id: string): AudioBuffer | null {
    const cached = this.reversed.get(id);
    if (cached) return cached;
    const src = this.buffers.get(id);
    if (!src || !this.ctx) return null;
    const out = reverseBuffer(this.ctx, src);
    this.reversed.set(id, out);
    return out;
  }

  /**
   * Destructive trim: discard everything before Start and after End.
   * Returns the new buffer so the caller can update the pad's frame offsets.
   */
  trimSample(sampleId: string, start: number, end: number): AudioBuffer | null {
    const src = this.buffers.get(sampleId);
    if (!src || !this.ctx) return null;
    const from = Math.max(0, Math.min(src.length - 1, start));
    const to = Math.max(from + 1, Math.min(src.length, end));
    const len = to - from;

    const out = this.ctx.createBuffer(src.numberOfChannels, len, src.sampleRate);
    for (let ch = 0; ch < src.numberOfChannels; ch++) {
      out.getChannelData(ch).set(src.getChannelData(ch).subarray(from, to));
    }
    this.buffers.set(sampleId, out);
    this.reversed.delete(sampleId);
    this.stretched.clear();
    return out;
  }

  /**
   * Non-destructive extract: copy a slice into a new buffer under a new id.
   * The original stays fully intact.
   */
  extractSlice(sampleId: string, start: number, end: number): { id: string; buffer: AudioBuffer } | null {
    const src = this.buffers.get(sampleId);
    if (!src || !this.ctx) return null;
    const len = Math.max(1, end - start);
    const out = this.ctx.createBuffer(src.numberOfChannels, len, src.sampleRate);
    for (let ch = 0; ch < src.numberOfChannels; ch++) {
      out.getChannelData(ch).set(src.getChannelData(ch).subarray(start, end));
    }
    const id = crypto.randomUUID();
    this.buffers.set(id, out);
    return { id, buffer: out };
  }

  /** Render an AudioBuffer to a WAV blob — used by extract and export. */
  bufferToWav(buffer: AudioBuffer): Blob {
    const ch = buffer.numberOfChannels;
    const len = buffer.length * ch * 2 + 44;
    const ab = new ArrayBuffer(len);
    const view = new DataView(ab);
    const writeStr = (off: number, s: string) => {
      for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
    };
    writeStr(0, 'RIFF');
    view.setUint32(4, len - 8, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, ch, true);
    view.setUint32(24, buffer.sampleRate, true);
    view.setUint32(28, buffer.sampleRate * ch * 2, true);
    view.setUint16(32, ch * 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, len - 44, true);

    let off = 44;
    const chans = Array.from({ length: ch }, (_, i) => buffer.getChannelData(i));
    for (let i = 0; i < buffer.length; i++) {
      for (let c = 0; c < ch; c++) {
        const s = Math.max(-1, Math.min(1, chans[c][i]));
        view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        off += 2;
      }
    }
    return new Blob([ab], { type: 'audio/wav' });
  }

  // --------------------------------------------------------------- playback

  /** Playback rate (pitch mode) or pre-stretched buffer (stretch mode). */
  private resolvePlayback(
    pad: Pad,
    buffer: AudioBuffer,
    region?: { start: number; end: number },
  ): { buffer: AudioBuffer; rate: number; padOverride: Partial<Pad> | null } {
    if (!this.ctx) return { buffer, rate: 1, padOverride: null };
    const bpm = this.project?.bpm ?? 120;
    return resolvePlaybackShared(this.ctx, pad, buffer, bpm, this.stretched, region);
  }

  /**
   * Trigger a pad. `when` defaults to now — for live hits we want the lowest
   * possible latency, so we schedule at currentTime rather than adding a
   * safety margin.
   */
  trigger(
    padIndex: number,
    velocity = 100,
    when?: number,
    sliceIndex?: number,
    bankIndex?: number,
  ): void {
    if (!this.ctx || !this.project) return;

    const bank = bankIndex ?? this.currentBank;

    let sourcePad = padIndex;
    let slice = sliceIndex;
    let vel = velocity;
    let cutoffOverride: number | undefined;
    let detuneOverride: number | undefined;

    if (this.chopMode && sliceIndex === undefined) {
      sourcePad = this.selectedPad;
      slice = padIndex;
      const chopPad = this.activePad(sourcePad, bank);
      if (!chopPad?.slices[padIndex]) return;
    } else if (this.levelsMode) {
      sourcePad = this.selectedPad;
      const n = padIndex / 15; // 0..1 across the 16 pads
      if (this.levelsType === 'velocity') {
        vel = Math.max(1, Math.round(8 + n * 119));
      } else if (this.levelsType === 'filter') {
        const base = this.activePad(sourcePad, bank)?.cutoff ?? 127;
        cutoffOverride =
          padIndex < 8
            ? (padIndex / 8) * base
            : base + ((padIndex - 8) / 8) * (127 - base);
      } else {
        // Original pitch sits on pad 4; below lowers, above raises.
        detuneOverride = (padIndex - 3) * 100;
      }
    }

    const pad = this.activePad(sourcePad, bank);
    if (!pad || pad.muted || !pad.sampleId) return;
    if (this.soloActive() && !this.soloMask[sourcePad]) return;

    const buffer = pad.reverse
      ? this.getReversed(pad.sampleId)
      : this.buffers.get(pad.sampleId);
    if (!buffer) return;

    if (this.fullLevel) vel = 127;
    velocity = vel;
    sliceIndex = slice;
    padIndex = sourcePad;

    const t = when ?? this.ctx.currentTime;
    const offsetSec = (pad.offset / 100) * 0.25;

    // Mute group: the last pad played silences others in the same group.
    if (pad.muteGroup !== null) {
      for (const v of this.voices) {
        if (v.muteGroup === pad.muteGroup) v.stop(t);
      }
    }
    // Mono: retrigger cuts the previous instance of this pad immediately.
    if (pad.polyphony === 'mono') {
      for (let vi = this.voices.length - 1; vi >= 0; vi--) {
        const v = this.voices[vi];
        if (v.pad === padIndex && v.bank === bank) {
          v.kill(t);
          this.voices.splice(vi, 1);
        }
      }
    }

    // Voice stealing: oldest first.
    while (this.voices.length >= MAX_VOICES) {
      const oldest = this.voices.shift();
      oldest?.stop(t);
    }

    let region =
      sliceIndex !== undefined && pad.slices[sliceIndex]
        ? pad.slices[sliceIndex]
        : undefined;

    // On a reversed buffer, frame offsets mirror around the sample length.
    if (pad.reverse) {
      const L = buffer.length;
      if (region) region = { start: L - region.end, end: L - region.start };
    }

    const effectivePad =
      cutoffOverride !== undefined || detuneOverride !== undefined
        ? {
            ...pad,
            cutoff: cutoffOverride ?? pad.cutoff,
            filterType: cutoffOverride !== undefined && pad.filterType === 'off'
              ? ('lpf2' as const)
              : pad.filterType,
            fine: detuneOverride !== undefined ? 0 : pad.fine,
            semi: detuneOverride !== undefined
              ? pad.semi + Math.round(detuneOverride / 100)
              : pad.semi,
          }
        : pad;

    if (pad.reverse && !region) {
      const L = buffer.length;
      const s = pad.start;
      const e = pad.end || L;
      region = { start: L - e, end: L - s };
    }

    const resolved = this.resolvePlayback(effectivePad, buffer, region);
    const playPad = resolved.padOverride
      ? { ...effectivePad, ...resolved.padOverride }
      : effectivePad;
    const playRegion = resolved.padOverride ? undefined : region;

    const voice = triggerVoice({
      ctx: this.ctx,
      buffer: resolved.buffer,
      pad: playPad,
      padIndex,
      bankIndex: bank,
      destination: this.padGains[padIndex],
      when: t + offsetSec,
      velocity,
      slice: playRegion,
      rate: resolved.rate,
    });

    this.voices.push(voice);
    voice.source.addEventListener('ended', () => {
      const i = this.voices.indexOf(voice);
      if (i >= 0) this.voices.splice(i, 1);
    });

    this.telemetry.padActivity[padIndex] = performance.now();
    midi.padOn(padIndex, velocity);

    // Pad link: fire the linked pad simultaneously. One level deep only.
    if (pad.padLink !== null && pad.padLink !== padIndex) {
      const linked = this.activePad(pad.padLink, bank);
      if (linked && linked.padLink === null) {
        this.trigger(pad.padLink, velocity, t, undefined, bank);
      }
    }
  }

  release(padIndex: number, bankIndex?: number) {
    const bank = bankIndex ?? this.currentBank;
    const pad = this.activePad(padIndex, bank);
    if (!pad?.noteOn) return;
    const t = this.ctx?.currentTime ?? 0;
    for (const v of this.voices) {
      if (v.pad === padIndex && v.bank === bank) v.stop(t);
    }
  }

  stopAll() {
    const t = this.ctx?.currentTime ?? 0;
    for (const v of this.voices) v.stop(t);
    this.voices = [];
  }

  private playEvent(e: SeqEvent, when: number, velocityOverride?: number) {
    const vel = velocityOverride ?? e.velocity;
    if (e.note !== undefined && e.note !== 60) {
      // Apply pitch offset relative to base note C4 (MIDI 60)
      this.triggerWithNote(e.pad, vel, when, e.note, e.bank);
    } else {
      this.trigger(e.pad, vel, when, undefined, e.bank);
    }
    this.telemetry.seqPadLit[e.pad] = performance.now();
  }

  /**
   * Trigger a pad with a MIDI note override. The semitone offset is
   * calculated relative to C4 (note 60) and added on top of the pad's
   * existing `semi` setting.
   */
  triggerWithNote(
    padIndex: number,
    velocity: number,
    when: number,
    midiNote: number,
    bankIndex?: number,
  ): void {
    if (!this.ctx || !this.project) return;
    const bank = bankIndex ?? this.currentBank;
    const pad = this.activePad(padIndex, bank);
    if (!pad || pad.muted || !pad.sampleId) return;
    if (this.soloActive() && !this.soloMask[padIndex]) return;

    const semiOffset = midiNote - 60;
    const effectivePad: typeof pad = { ...pad, semi: pad.semi + semiOffset };

    const buffer = pad.reverse
      ? this.getReversed(pad.sampleId)
      : this.buffers.get(pad.sampleId);
    if (!buffer) return;

    const t = when;

    if (pad.muteGroup !== null) {
      for (const v of this.voices) {
        if (v.muteGroup === pad.muteGroup) v.stop(t);
      }
    }
    if (pad.polyphony === 'mono') {
      for (let vi = this.voices.length - 1; vi >= 0; vi--) {
        const v = this.voices[vi];
        if (v.pad === padIndex && v.bank === bank) {
          v.kill(t);
          this.voices.splice(vi, 1);
        }
      }
    }
    while (this.voices.length >= MAX_VOICES) {
      const oldest = this.voices.shift();
      oldest?.stop(t);
    }

    let region: { start: number; end: number } | undefined;
    if (pad.reverse) {
      const L = buffer.length;
      const s = pad.start;
      const e = pad.end || L;
      region = { start: L - e, end: L - s };
    }

    const resolved = this.resolvePlayback(effectivePad, buffer, region);
    const playPad = resolved.padOverride
      ? { ...effectivePad, ...resolved.padOverride }
      : effectivePad;
    const playRegion = resolved.padOverride ? undefined : region;

    const voice = triggerVoice({
      ctx: this.ctx,
      buffer: resolved.buffer,
      pad: playPad,
      padIndex,
      bankIndex: bank,
      destination: this.padGains[padIndex],
      when: t + (pad.offset / 100) * 0.25,
      velocity,
      slice: playRegion,
      rate: resolved.rate,
    });

    voice.note = midiNote;
    this.voices.push(voice);
    voice.source.addEventListener('ended', () => {
      const i = this.voices.indexOf(voice);
      if (i >= 0) this.voices.splice(i, 1);
    });
    this.telemetry.padActivity[padIndex] = performance.now();
  }

  /**
   * Release only the voice(s) started at a specific MIDI note on a pad — used
   * by the playable keyboard so releasing one held key doesn't cut the others.
   * Mirrors release(): one-shot pads (noteOn false) ring out and are untouched.
   */
  releaseNote(padIndex: number, midiNote: number, bankIndex?: number) {
    const bank = bankIndex ?? this.currentBank;
    const pad = this.activePad(padIndex, bank);
    if (!pad?.noteOn) return;
    const t = this.ctx?.currentTime ?? 0;
    for (const v of this.voices) {
      if (v.pad === padIndex && v.bank === bank && v.note === midiNote) v.stop(t);
    }
  }

  private onSequenceLoopComplete() {
    if (this.songMode && this.project?.song.length) {
      this.songIndex = (this.songIndex + 1) % this.project.song.length;
      const step = this.project.song[this.songIndex];
      this.currentBank = step.bank;
      this.currentSeqSlot = step.slot;
      this.onSongStepChange?.(step.bank, step.slot);
      return;
    }
    this.onSeqLoopEnd?.();
  }

  private click(when: number, accent: boolean) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.frequency.value = accent ? 1600 : 1000;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(accent ? 0.25 : 0.14, when + 0.001);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
    osc.connect(g);
    g.connect(this.master);
    osc.start(when);
    osc.stop(when + 0.06);
  }

  // -------------------------------------------------------------- transport

  play(continueFromPaused = false) {
    if (!this.ctx) return;
    const from = continueFromPaused ? this.pausedAt : 0;
    if (!continueFromPaused) this.pausedAt = 0;
    const countIn = this.project?.countIn && this.scheduler.state.recording ? 1 : 0;
    this.scheduler.start(from, countIn);
    midi.start();
  }

  stop(hardReset = false) {
    if (this.scheduler.state.playing && !hardReset) {
      const seq = this.activeSequence();
      if (seq) {
        const bar = ticksPerBar(this.project?.timeSignature ?? [4, 4]);
        const loopLen = seq.bars * bar;
        this.pausedAt = this.scheduler.currentTick() % loopLen;
      }
    }
    if (hardReset) this.pausedAt = 0;
    this.scheduler.stop();
    this.stopAll();
    // A recorded sweep leaves the live mix nodes wherever automation put them;
    // restore each pad to its static gain/pan so stopping doesn't strand them.
    if (this.project) this.syncSendLevels(this.project);
    this.songMode = false;
    this.songIndex = 0;
    midi.stop();
  }

  setRecording(on: boolean) {
    this.scheduler.state.recording = on;
    this.telemetry.recording = on;
    if (!on) this.scheduler.state.recordingLive = false;
  }

  startSongMode() {
    if (!this.project?.song.length) return;
    this.songMode = true;
    this.songIndex = 0;
    const step = this.project.song[0];
    this.currentBank = step.bank;
    this.currentSeqSlot = step.slot;
    this.onSongStepChange?.(step.bank, step.slot);
    this.play(false);
  }

  /** Record a live pad hit into the active sequence. */
  recordHit(padIndex: number, velocity: number, recordPad?: number, recordBank?: number, note?: number) {
    const seq = this.activeSequence();
    if (!seq || !this.project) return;
    if (!this.scheduler.state.playing || !this.scheduler.state.recording) return;
    if (!this.scheduler.state.recordingLive) return;
    const ev = this.scheduler.recordHit(
      seq,
      recordPad ?? padIndex,
      recordBank ?? this.currentBank,
      velocity,
      this.project.recordQuantize ? this.project.quantize : null,
      note
    );
    this.onRecordHit?.(ev);
    return ev;
  }

  // ---------------------------------------------------------------- params

  setPadVolume(padIndex: number, db: number) {
    const g = this.padGains[padIndex];
    if (!g || !this.ctx) return;
    const v = db === -Infinity ? 0 : Math.pow(10, db / 20);
    g.gain.setTargetAtTime(v, this.ctx.currentTime, 0.01);
  }

  /** Drive a live mix param from a recorded automation point (or on replay). */
  applyAutomation(param: AutoParam, pad: number, norm: number, when?: number) {
    if (!this.ctx) return;
    const t = when ?? this.ctx.currentTime;
    const n = Math.max(0, Math.min(1, norm));
    if (param === 'vol') {
      const db = n * 80 - 74;
      const v = db <= -74 ? 0 : Math.pow(10, db / 20);
      this.padGains[pad]?.gain.setTargetAtTime(v, t, 0.008);
    } else if (param === 'pan') {
      this.padPanners[pad]?.pan.setTargetAtTime(n * 2 - 1, t, 0.008);
    }
  }

  setKitVolume(db: number) {
    if (!this.ctx) return;
    const v = db === -Infinity ? 0 : Math.pow(10, db / 20);
    this.kitGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.01);
  }

  setMasterVolume(v: number) {
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(Math.max(0, Math.min(1.2, v)), this.ctx.currentTime, 0.01);
  }

  private makeColorCurve(amount: number): Float32Array<ArrayBuffer> {
    const n = 1024;
    const curve = new Float32Array(new ArrayBuffer(n * 4));
    const k = Math.max(0.001, amount) * 80;
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
    }
    return curve;
  }

  setCompressor(
    attackMs: number,
    releaseMs: number,
    amount: number,
    color = false,
    bypass = false,
    inBoost = 0,
  ) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.compressorColor = color;
    this.compressorBypass = bypass;
    this.compressor.attack.setTargetAtTime(attackMs / 1000, t, 0.01);
    this.compressor.release.setTargetAtTime(releaseMs / 1000, t, 0.01);
    const n = Math.max(0, Math.min(100, amount)) / 100;
    this.compressor.threshold.setTargetAtTime(-6 - n * 40, t, 0.01);
    this.compressor.ratio.setTargetAtTime(1 + n * 19, t, 0.01);
    this.colorDrive.curve = this.makeColorCurve(color ? 0.35 : 0);
    this.colorMix.gain.setTargetAtTime(color ? 0.35 : 0, t, 0.01);
    this.compBypass.gain.setTargetAtTime(bypass ? 1 : 1, t, 0.01);
    if (bypass) {
      this.compressor.threshold.setTargetAtTime(0, t, 0.01);
      this.compressor.ratio.setTargetAtTime(1, t, 0.01);
    }
    this.inBoostGain.gain.setTargetAtTime(1 + inBoost * 2, t, 0.01);
  }

  syncKnobFXRouting() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const bypass = this.knobFXBypass;
    for (let i = 0; i < NUM_PADS; i++) {
      const send = bypass || !this.knobFXRouting[i] ? 0 : 1;
      this.knobSends[i]?.gain.setTargetAtTime(send, t, 0.01);
      // Tap pad output into knob FX send bus.
      try {
        this.padGains[i]?.disconnect(this.knobSends[i]);
      } catch { /* not connected */ }
      if (send > 0) {
        this.padGains[i]?.connect(this.knobSends[i]);
      }
    }
  }

  setKnobFXRouting(routing: boolean[], bypass: boolean) {
    this.knobFXRouting = routing.slice(0, 16);
    this.knobFXBypass = bypass;
    this.syncKnobFXRouting();
  }

  // ---------------------------------------------------------------- note repeat

  startNoteRepeat(pad: number, velocity: number, triplet: boolean) {
    const interval = triplet
      ? Math.round(PPQN / 6)
      : Math.round(TICKS_PER_16TH);
    this.scheduler.addNoteRepeat(pad, this.currentBank, velocity, interval);
    // Fire first hit immediately.
    this.trigger(pad, velocity);
  }

  stopNoteRepeat(pad: number) {
    this.scheduler.removeNoteRepeat(pad);
  }

  // ---------------------------------------------------------------- flex beat

  selectFlexBeatPad(pad: number) {
    if (!this.project) return;
    const bpm = this.project.bpmScope === 'global'
      ? this.project.bpm
      : this.activeSequence()?.bpm ?? this.project.bpm;
    this.flexBeat.setTransport(bpm, this.project.timeSignature);
    this.flexBeat.selectPad(pad);
  }

  setFlexBeat(opts: { mode?: 'oneshot' | 'loop'; quantize?: boolean; mix?: number }) {
    if (opts.mode) this.flexBeat.mode = opts.mode;
    if (opts.quantize !== undefined) this.flexBeat.quantize = opts.quantize;
    if (opts.mix !== undefined) this.flexBeat.setMix(opts.mix);
  }

  // ------------------------------------------------------------------- fx

  async setKnobFX(id: KnobFXId) {
    await this.knobFX?.setEffect(id);
  }

  setKnobFXParam(k: 0 | 1 | 2, v: number) {
    this.knobFX?.setParam(k, v);
  }

  setKnobFXShiftParam(k: 0 | 1 | 2, v: number) {
    this.knobFX?.setShiftParam(k, v);
  }

  pressPadFX(id: PadFXId, amount: number) {
    this.padFX?.press(id, amount);
  }

  releasePadFX(id: PadFXId) {
    this.padFX?.release(id);
  }

  togglePadFXLatch(id: PadFXId) {
    this.padFX?.toggleLatch(id);
  }

  // -------------------------------------------------------------- recording

  async openInput(): Promise<boolean> {
    if (!this.ctx) return false;
    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {
        return false;
      }
    }
    return this.recorder ? this.recorder.open() : false;
  }

  startRecording() { this.recorder?.start(); }
  markRecordChop() { this.recorder?.markChop(); }
  stopRecording() { return this.recorder?.stop() ?? null; }
  recall() { return this.recorder?.recall() ?? null; }
  setInputMonitor(on: boolean) { this.recorder?.setMonitor(on); }
  get inputLevel() { return this.recorder?.level ?? 0; }

  /** Short preview from an absolute frame — used by LCD tap-to-audition. */
  previewAtFrame(padIndex: number, frame: number, durationSec = 0.22): void {
    if (!this.ctx || !this.project) return;
    const pad = this.activePad(padIndex);
    if (!pad?.sampleId) return;
    const buffer = pad.reverse
      ? this.getReversed(pad.sampleId)
      : this.buffers.get(pad.sampleId);
    if (!buffer) return;

    const regionEnd = pad.end || buffer.length;
    const frameClamped = Math.max(pad.start, Math.min(Math.round(frame), regionEnd - 1));
    const endFrame = Math.min(
      regionEnd,
      frameClamped + Math.round(durationSec * buffer.sampleRate),
    );
    if (endFrame <= frameClamped) return;

    const t = this.ctx.currentTime;
    const voice = triggerVoice({
      ctx: this.ctx,
      buffer,
      pad: { ...pad, loop: false, noteOn: false },
      padIndex,
      bankIndex: this.currentBank,
      destination: this.padGains[padIndex],
      when: t,
      velocity: 100,
      slice: { start: frameClamped, end: endFrame },
      rate: this.warpRate(pad, buffer),
    });
    this.voices.push(voice);
    voice.source.addEventListener('ended', () => {
      const i = this.voices.indexOf(voice);
      if (i >= 0) this.voices.splice(i, 1);
    });
  }

  /** Read the output meter and sample playheads. Call from rAF. */
  readLevel(): number {
    if (!this.analyser) return 0;
    this.analyser.getByteTimeDomainData(this.meterData);
    let peak = 0;
    for (let i = 0; i < this.meterData.length; i++) {
      const d = Math.abs(this.meterData[i] - 128) / 128;
      if (d > peak) peak = d;
    }
    this.telemetry.level = peak;
    this.updateSamplePlayheads();
    return peak;
  }

  private updateSamplePlayheads() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.telemetry.samplePlayhead.fill(-1);
    for (const v of this.voices) {
      const frame = voiceFrameAt(v, t);
      if (frame >= v.regionStart && frame <= v.regionEnd) {
        this.telemetry.samplePlayhead[v.pad] = frame;
      }
    }
  }

  private warpRate(pad: Pad, buffer: AudioBuffer): number {
    return warpRateShared(pad, buffer, this.project?.bpm ?? 120);
  }

  ticksToBars(ticks: number): string {
    const [num, den] = this.project?.timeSignature ?? [4, 4];
    const perBar = (PPQN * 4 * num) / den;
    const bar = Math.floor(ticks / perBar) + 1;
    const beat = Math.floor((ticks % perBar) / ((PPQN * 4) / den)) + 1;
    return `${bar}.${beat}`;
  }

  dispose() {
    this.scheduler?.dispose();
    this.stopAll();
    this.ctx?.close();
    this.ctx = null;
  }
}

export const engine = new Engine();
