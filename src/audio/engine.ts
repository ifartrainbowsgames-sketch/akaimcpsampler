import { MAX_VOICES, NUM_PADS, PPQN } from './types';
import type { Pad, Project, SeqEvent, Sequence } from './types';
import { triggerVoice, type Voice } from './voice';
import { Scheduler, type TransportState } from './scheduler';
import { KnobFX, type KnobFXId } from './fx/knobfx';
import { PadFXRack, type PadFXId } from './fx/padfx';
import { Recorder } from './recorder';
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
  private analyser!: AnalyserNode;
  knobFX!: KnobFX;
  padFX!: PadFXRack;
  recorder!: Recorder;
  workletsReady = false;

  private buffers = new Map<string, AudioBuffer>();
  private reversed = new Map<string, AudioBuffer>();
  private voices: Voice[] = [];

  private project: Project | null = null;
  private currentBank = 0;
  private currentSeqSlot = 0;

  /** Pad Play modes. Set from the UI; consulted on every trigger. */
  chopMode = false;
  levelsMode = false;
  /** Which pad's sample chop/16-levels operate on. */
  selectedPad = 0;
  levelsType: 'velocity' | 'filter' | 'tune' = 'velocity';
  fullLevel = false;

  scheduler!: Scheduler;

  /** Telemetry the UI polls on rAF. Never a React state update from here. */
  telemetry = {
    playing: false,
    recording: false,
    step: 0,
    positionTicks: 0,
    level: 0,
    padActivity: new Array<number>(NUM_PADS).fill(0),
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
    this.compressor.threshold.value = -6;
    this.compressor.ratio.value = 2;
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

    // kit -> compressor -> knobFX -> padFX -> master -> out
    this.kitGain.connect(this.compressor);
    this.compressor.connect(this.knobFX.input);
    this.knobFX.output.connect(this.padFX.input);
    this.padFX.output.connect(this.master);
    this.master.connect(this.analyser);
    this.master.connect(ctx.destination);

    this.recorder = new Recorder(ctx, this.master);

    // Persistent per-pad gain nodes. Created once, never torn down.
    this.padGains = Array.from({ length: NUM_PADS }, () => {
      const g = ctx.createGain();
      g.connect(this.kitGain);
      return g;
    });

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
      metronomeEnabled: () => {
        const m = this.project?.metronome ?? 'off';
        return m === 'on' || (m === 'record' && this.telemetry.recording);
      },
      click: (when, accent) => this.click(when, accent),
      playEvent: (e, when) => this.playEvent(e, when),
      onPosition: (s: TransportState) => {
        this.telemetry.playing = s.playing;
        this.telemetry.recording = s.recording;
        this.telemetry.step = s.currentStep;
        this.telemetry.positionTicks = s.positionTicks;
      },
    });

    await ctx.resume();
  }

  setProject(p: Project) {
    this.project = p;
  }

  setBank(b: number) {
    this.currentBank = b;
  }

  setSequenceSlot(i: number) {
    this.currentSeqSlot = i;
  }

  activeSequence(): Sequence | null {
    return this.project?.sequences[this.currentBank]?.[this.currentSeqSlot] ?? null;
  }

  private activePad(index: number): Pad | null {
    return this.project?.banks[this.currentBank]?.[index] ?? null;
  }

  // ---------------------------------------------------------------- samples

  async loadSample(id: string, data: ArrayBuffer): Promise<AudioBuffer> {
    if (!this.ctx) throw new Error('Engine not initialised');
    const buf = await this.ctx.decodeAudioData(data.slice(0));
    this.buffers.set(id, buf);
    return buf;
  }

  putBuffer(id: string, buf: AudioBuffer) {
    this.buffers.set(id, buf);
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

    const out = this.ctx.createBuffer(
      src.numberOfChannels,
      src.length,
      src.sampleRate
    );
    for (let ch = 0; ch < src.numberOfChannels; ch++) {
      const from = src.getChannelData(ch);
      const to = out.getChannelData(ch);
      for (let i = 0, j = from.length - 1; i < from.length; i++, j--) {
        to[i] = from[j];
      }
    }
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

  /** Playback rate implied by warp settings. */
  private warpRate(pad: Pad, buffer: AudioBuffer): number {
    if (pad.warpAmount === 'off') return 1;
    if (pad.warpAmount === 'seq') {
      const bpm = this.project?.bpm ?? 120;
      const sampleSeconds = buffer.duration;
      const targetSeconds = (pad.beats * 60) / bpm;
      return sampleSeconds / targetSeconds;
    }
    // 50% = half as long (twice as fast), 200% = twice as long.
    return 100 / pad.warpAmount;
  }

  /**
   * Trigger a pad. `when` defaults to now — for live hits we want the lowest
   * possible latency, so we schedule at currentTime rather than adding a
   * safety margin.
   */
  trigger(padIndex: number, velocity = 100, when?: number, sliceIndex?: number): void {
    if (!this.ctx || !this.project) return;

    // Chop mode: every pad triggers a slice of the *selected* pad's sample.
    // 16 Levels: every pad plays the selected sample with one parameter
    // spread across the grid. Both remap which pad actually sounds.
    let sourcePad = padIndex;
    let slice = sliceIndex;
    let vel = velocity;
    let cutoffOverride: number | undefined;
    let detuneOverride: number | undefined;

    if (this.chopMode && sliceIndex === undefined) {
      sourcePad = this.selectedPad;
      slice = padIndex;
    } else if (this.levelsMode) {
      sourcePad = this.selectedPad;
      const n = padIndex / 15; // 0..1 across the 16 pads
      if (this.levelsType === 'velocity') {
        vel = Math.max(1, Math.round(8 + n * 119));
      } else if (this.levelsType === 'filter') {
        const base = this.activePad(sourcePad)?.cutoff ?? 127;
        cutoffOverride =
          padIndex < 8
            ? (padIndex / 8) * base
            : base + ((padIndex - 8) / 8) * (127 - base);
      } else {
        // Original pitch sits on pad 4; below lowers, above raises.
        detuneOverride = (padIndex - 3) * 100;
      }
    }

    const pad = this.activePad(sourcePad);
    if (!pad || pad.muted || !pad.sampleId) return;

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
    // Mono: retrigger cuts the previous instance of this pad.
    if (pad.polyphony === 'mono') {
      for (const v of this.voices) {
        if (v.pad === padIndex && v.bank === this.currentBank) v.stop(t);
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

    const voice = triggerVoice({
      ctx: this.ctx,
      buffer,
      pad: effectivePad,
      padIndex,
      bankIndex: this.currentBank,
      destination: this.padGains[padIndex],
      when: t + offsetSec,
      velocity,
      slice: region,
      rate: this.warpRate(pad, buffer),
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
      const linked = this.activePad(pad.padLink);
      if (linked && linked.padLink === null) {
        this.trigger(pad.padLink, velocity, t);
      }
    }
  }

  release(padIndex: number) {
    const pad = this.activePad(padIndex);
    if (!pad?.noteOn) return;
    const t = this.ctx?.currentTime ?? 0;
    for (const v of this.voices) {
      if (v.pad === padIndex && v.bank === this.currentBank) v.stop(t);
    }
  }

  stopAll() {
    const t = this.ctx?.currentTime ?? 0;
    for (const v of this.voices) v.stop(t);
    this.voices = [];
  }

  private playEvent(e: SeqEvent, when: number) {
    this.trigger(e.pad, e.velocity, when);
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

  play() {
    if (!this.ctx) return;
    this.scheduler.start(0);
  }

  stop() {
    this.scheduler.stop();
    this.stopAll();
  }

  setRecording(on: boolean) {
    this.scheduler.state.recording = on;
    this.telemetry.recording = on;
  }

  /** Record a live pad hit into the active sequence. */
  recordHit(padIndex: number, velocity: number) {
    const seq = this.activeSequence();
    if (!seq || !this.project) return;
    if (!this.scheduler.state.playing || !this.scheduler.state.recording) return;
    this.scheduler.recordHit(
      seq,
      padIndex,
      this.currentBank,
      velocity,
      this.project.recordQuantize ? this.project.quantize : null
    );
  }

  // ---------------------------------------------------------------- params

  setPadVolume(padIndex: number, db: number) {
    const g = this.padGains[padIndex];
    if (!g || !this.ctx) return;
    const v = db === -Infinity ? 0 : Math.pow(10, db / 20);
    g.gain.setTargetAtTime(v, this.ctx.currentTime, 0.01);
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

  setCompressor(attackMs: number, releaseMs: number, amount: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.compressor.attack.setTargetAtTime(attackMs / 1000, t, 0.01);
    this.compressor.release.setTargetAtTime(releaseMs / 1000, t, 0.01);
    // Amount folds threshold and ratio into one control, as the hardware does.
    const n = Math.max(0, Math.min(100, amount)) / 100;
    this.compressor.threshold.setTargetAtTime(-6 - n * 40, t, 0.01);
    this.compressor.ratio.setTargetAtTime(1 + n * 19, t, 0.01);
  }

  // ------------------------------------------------------------------- fx

  async setKnobFX(id: KnobFXId) {
    await this.knobFX?.setEffect(id);
  }

  setKnobFXParam(k: 0 | 1 | 2, v: number) {
    this.knobFX?.setParam(k, v);
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

  /** Read the output meter. Call from rAF, not from the audio path. */
  readLevel(): number {
    if (!this.analyser) return 0;
    this.analyser.getByteTimeDomainData(this.meterData);
    let peak = 0;
    for (let i = 0; i < this.meterData.length; i++) {
      const d = Math.abs(this.meterData[i] - 128) / 128;
      if (d > peak) peak = d;
    }
    this.telemetry.level = peak;
    return peak;
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
