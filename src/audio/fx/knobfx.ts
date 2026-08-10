/**
 * Knob FX: a single effect controlled by three parameters, inserted on the
 * master bus. Native nodes cover most of the list and cost essentially
 * nothing; only bitcrush and the vintage emulators need a worklet.
 *
 * See BUILD_PLAN.md Appendix A.11 for the full parameter table.
 */

export type KnobFXId =
  | 'off'
  | 'delay' | 'diffDelay' | 'tapeDelay' | 'sampleDelay'
  | 'reverbSmall' | 'reverbMed' | 'reverbLarge' | 'springReverb'
  | 'lpFilter' | 'hpFilter' | 'bpFilter'
  | 'compressor' | 'limiter' | 'pumper' | 'transient' | 'noiseGate'
  | 'tubeDrive' | 'softClipper' | 'ampSim'
  | 'chorus' | 'ensemble' | 'multiChorus' | 'flanger' | 'phaser' | 'autoWah' | 'autoPan'
  | 'bitcrush'
  | 'vintage3000' | 'vintageMPC60' | 'vintageSP1200'
  | 'vinylEmu' | 'tapeEmu';

export interface KnobFXDef {
  id: KnobFXId;
  name: string;
  params: [string, string, string];
  shiftParams?: [string, string, string];
}

export const KNOB_FX: KnobFXDef[] = [
  { id: 'off', name: 'Off', params: ['—', '—', '—'] },
  { id: 'delay', name: 'Delay', params: ['Time', 'Feedback', 'Mix'], shiftParams: ['Sync', 'Damping', 'Width'] },
  { id: 'diffDelay', name: 'Diff Delay', params: ['Time', 'Feedback', 'Mix'], shiftParams: ['Sync', 'Diffusion', 'High Damp'] },
  { id: 'tapeDelay', name: 'Tape Delay', params: ['Time', 'Feedback', 'Mix'], shiftParams: ['Wow/Flut', 'Ramp', 'Spread'] },
  { id: 'sampleDelay', name: 'Sample Delay', params: ['Left', 'Right', '—'] },
  { id: 'reverbSmall', name: 'Reverb Small', params: ['Pre-Delay', 'Time', 'Mix'], shiftParams: ['ER/Tail', 'Density', 'Low Cut'] },
  { id: 'reverbMed', name: 'Reverb Med', params: ['Pre-Delay', 'Time', 'Mix'], shiftParams: ['ER/Tail', 'Density', 'Low Cut'] },
  { id: 'reverbLarge', name: 'Reverb Large', params: ['Pre-Delay', 'Time', 'Mix'], shiftParams: ['ER/Tail', 'Density', 'Low Cut'] },
  { id: 'springReverb', name: 'Spring Reverb', params: ['Pre-Delay', 'Time', 'Mix'], shiftParams: ['Width', 'Diffusion', 'Low Cut'] },
  { id: 'lpFilter', name: 'LP Filter', params: ['Frequency', 'Resonance', '—'] },
  { id: 'hpFilter', name: 'HP Filter', params: ['Frequency', 'Resonance', '—'] },
  { id: 'bpFilter', name: 'BP Filter', params: ['Frequency', 'Resonance', '—'] },
  { id: 'compressor', name: 'Bus Compressor', params: ['Attack', 'Release', 'Threshold'], shiftParams: ['Ratio', 'Output', 'Mix'] },
  { id: 'limiter', name: 'Limiter', params: ['Gain', 'Ceiling', 'Release'] },
  { id: 'pumper', name: 'Pumper', params: ['Speed', 'Shape', 'Depth'], shiftParams: ['Attack', 'Hold', 'Release'] },
  { id: 'transient', name: 'Transient', params: ['Attack', 'Shape', 'Sustain'] },
  { id: 'noiseGate', name: 'Noise Gate', params: ['Threshold', 'Depth', '—'], shiftParams: ['Attack', 'Hold', 'Release'] },
  { id: 'tubeDrive', name: 'Tube Drive', params: ['Drive', 'Headroom', 'Saturation'] },
  { id: 'softClipper', name: 'Soft Clipper', params: ['Drive', 'Shape', 'Mix'], shiftParams: ['True Peak', 'Rel Time', 'Post Lvl'] },
  { id: 'ampSim', name: 'Amp Sim', params: ['Drive', 'Soft Clip', 'Mix'], shiftParams: ['Bass', 'Mid', 'Treble'] },
  { id: 'chorus', name: 'Chorus', params: ['Rate', 'Depth', 'Mix'] },
  { id: 'ensemble', name: 'Ensemble', params: ['Rate', 'Depth', 'Mix'], shiftParams: ['Delay', 'Shimmer', 'Width'] },
  { id: 'multiChorus', name: 'Multi-Chorus', params: ['Rate', 'Depth', 'Mix'], shiftParams: ['Voices', 'Delay', '—'] },
  { id: 'flanger', name: 'Flanger', params: ['Rate', 'Depth', 'Feedback'] },
  { id: 'phaser', name: 'Phaser', params: ['Rate', 'Depth', 'Mix'], shiftParams: ['Model', 'Feedback', '—'] },
  { id: 'autoWah', name: 'Auto-Wah', params: ['Sens', 'Resonance', 'Mix'], shiftParams: ['Center', 'Attack', 'Release'] },
  { id: 'autoPan', name: 'Auto-Pan', params: ['Rate', '—', 'Mix'] },
  { id: 'bitcrush', name: 'LoFi', params: ['Bitcrush', 'Decimate', 'Mix'] },
  { id: 'vintage3000', name: 'Vintage MPC3000', params: ['Amount', 'Tone', 'Mix'] },
  { id: 'vintageMPC60', name: 'Vintage MPC60', params: ['Amount', 'Tone', 'Mix'] },
  { id: 'vintageSP1200', name: 'Vintage SP1200', params: ['Amount', 'Tone', 'Mix'] },
  { id: 'vinylEmu', name: 'Vinyl Emulator', params: ['Tone', 'Crackle', 'Pitch'], shiftParams: ['—', '—', '—'] },
  { id: 'tapeEmu', name: 'Tape Emulator', params: ['Wow', 'Noise', 'Pitch'], shiftParams: ['—', '—', '—'] },
];

/** Generate an impulse response for the convolver — no asset to download. */
function makeImpulse(ctx: BaseAudioContext, seconds: number, decay: number): AudioBuffer {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}

/** Waveshaper curve for tube-style saturation. */
function driveCurve(amount: number): Float32Array<ArrayBuffer> {
  const n = 1024;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  const k = Math.max(0.001, amount) * 100;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return curve;
}

export class KnobFX {
  private ctx: AudioContext;
  readonly input: GainNode;
  readonly output: GainNode;

  private dry: GainNode;
  private wet: GainNode;
  private nodes: AudioNode[] = [];
  private lfos: OscillatorNode[] = [];
  private current: KnobFXId = 'off';
  private worklet: AudioWorkletNode | null = null;
  private shiftVals: [number, number, number] = [0.5, 0.5, 0.5];
  private delaySync = false;
  private pumpLfo: OscillatorNode | null = null;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.dry = ctx.createGain();
    this.wet = ctx.createGain();

    this.input.connect(this.dry);
    this.dry.connect(this.output);
    this.wet.connect(this.output);
    this.dry.gain.value = 1;
    this.wet.gain.value = 0;
  }

  get effect(): KnobFXId {
    return this.current;
  }

  private teardown() {
    for (const l of this.lfos) {
      try { l.stop(); l.disconnect(); } catch { /* noop */ }
    }
    for (const n of this.nodes) {
      try { n.disconnect(); } catch { /* noop */ }
    }
    this.lfos = [];
    this.nodes = [];
    this.worklet = null;
    this.pumpLfo = null;
    try { this.input.disconnect(this.wet); } catch { /* noop */ }
  }

  async setEffect(id: KnobFXId) {
    this.teardown();
    this.current = id;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    if (id === 'off') {
      this.dry.gain.setTargetAtTime(1, now, 0.02);
      this.wet.gain.setTargetAtTime(0, now, 0.02);
      return;
    }

    // Build the wet chain, then hang it off input -> ... -> wet.
    const chain: AudioNode[] = [];
    const push = (n: AudioNode) => { chain.push(n); this.nodes.push(n); return n; };

    switch (id) {
      case 'delay':
      case 'diffDelay':
      case 'tapeDelay': {
        const d = push(ctx.createDelay(2)) as DelayNode;
        const fb = push(ctx.createGain()) as GainNode;
        const damp = push(ctx.createBiquadFilter()) as BiquadFilterNode;
        d.delayTime.value = 0.25;
        fb.gain.value = 0.4;
        damp.type = 'lowpass';
        damp.frequency.value = id === 'tapeDelay' ? 3200 : 8000;
        d.connect(damp);
        damp.connect(fb);
        fb.connect(d);
        if (id === 'diffDelay') {
          const ap = push(ctx.createBiquadFilter()) as BiquadFilterNode;
          ap.type = 'allpass';
          ap.frequency.value = 1200;
          d.connect(ap);
        }
        if (id === 'tapeDelay') {
          const lfo = ctx.createOscillator();
          const depth = ctx.createGain();
          lfo.frequency.value = 0.7;
          depth.gain.value = 0.0016;
          lfo.connect(depth);
          depth.connect(d.delayTime);
          lfo.start();
          this.lfos.push(lfo);
          this.nodes.push(depth);
        }
        break;
      }

      case 'sampleDelay': {
        const split = push(ctx.createChannelSplitter(2)) as ChannelSplitterNode;
        const merge = push(ctx.createChannelMerger(2)) as ChannelMergerNode;
        const dl = push(ctx.createDelay(0.5)) as DelayNode;
        const dr = push(ctx.createDelay(0.5)) as DelayNode;
        dl.delayTime.value = 0.08;
        dr.delayTime.value = 0.12;
        split.connect(dl, 0);
        split.connect(dr, 1);
        dl.connect(merge, 0, 0);
        dr.connect(merge, 0, 1);
        break;
      }

      case 'reverbSmall':
      case 'reverbMed':
      case 'reverbLarge':
      case 'springReverb': {
        const pre = push(ctx.createDelay(0.5)) as DelayNode;
        const conv = push(ctx.createConvolver()) as ConvolverNode;
        pre.delayTime.value = 0.02;
        const sec = id === 'reverbLarge' ? 3.2 : id === 'reverbMed' ? 2.0 : id === 'springReverb' ? 1.4 : 1.0;
        const decay = id === 'springReverb' ? 3.5 : 2.4;
        conv.buffer = makeImpulse(ctx, sec, decay);
        pre.connect(conv);
        break;
      }

      case 'lpFilter':
      case 'hpFilter':
      case 'bpFilter': {
        const f = push(ctx.createBiquadFilter()) as BiquadFilterNode;
        f.type = id === 'lpFilter' ? 'lowpass' : id === 'hpFilter' ? 'highpass' : 'bandpass';
        f.frequency.value = id === 'hpFilter' ? 200 : 8000;
        f.Q.value = 1;
        break;
      }

      case 'compressor':
      case 'limiter':
      case 'transient':
      case 'noiseGate': {
        const c = push(ctx.createDynamicsCompressor()) as DynamicsCompressorNode;
        if (id === 'limiter') {
          c.threshold.value = -3;
          c.ratio.value = 20;
          c.attack.value = 0.001;
          c.release.value = 0.1;
          c.knee.value = 0;
        } else if (id === 'noiseGate') {
          c.threshold.value = -40;
          c.ratio.value = 20;
          c.attack.value = 0.002;
          c.release.value = 0.08;
        } else if (id === 'transient') {
          c.threshold.value = -24;
          c.ratio.value = 4;
          c.attack.value = 0.001;
          c.release.value = 0.05;
        }
        break;
      }

      case 'pumper': {
        const g = push(ctx.createGain()) as GainNode;
        g.gain.value = 1;
        const lfo = ctx.createOscillator();
        const depth = ctx.createGain();
        lfo.frequency.value = 2;
        depth.gain.value = 0.35;
        lfo.connect(depth);
        depth.connect(g.gain);
        lfo.start();
        this.lfos.push(lfo);
        this.pumpLfo = lfo;
        this.nodes.push(depth);
        break;
      }

      case 'tubeDrive':
      case 'softClipper':
      case 'ampSim': {
        const ws = push(ctx.createWaveShaper()) as WaveShaperNode;
        ws.curve = driveCurve(id === 'ampSim' ? 0.55 : 0.4);
        ws.oversample = '4x';
        const tone = push(ctx.createBiquadFilter()) as BiquadFilterNode;
        tone.type = 'lowpass';
        tone.frequency.value = id === 'ampSim' ? 6500 : 9000;
        if (id === 'ampSim') {
          const eq = push(ctx.createBiquadFilter()) as BiquadFilterNode;
          eq.type = 'peaking';
          eq.frequency.value = 800;
          eq.gain.value = 2;
          ws.connect(eq);
          eq.connect(tone);
        } else {
          ws.connect(tone);
        }
        break;
      }

      case 'chorus':
      case 'ensemble':
      case 'multiChorus':
      case 'flanger': {
        const voices = id === 'multiChorus' ? 3 : id === 'ensemble' ? 2 : 1;
        for (let v = 0; v < voices; v++) {
          const d = push(ctx.createDelay(0.05)) as DelayNode;
          d.delayTime.value = id === 'flanger' ? 0.005 : 0.015 + v * 0.008;
          const lfo = ctx.createOscillator();
          const depth = ctx.createGain();
          lfo.frequency.value = id === 'flanger' ? 0.3 : 0.8 + v * 0.2;
          depth.gain.value = id === 'flanger' ? 0.003 : 0.004 + v * 0.002;
          lfo.connect(depth);
          depth.connect(d.delayTime);
          lfo.start();
          this.lfos.push(lfo);
          this.nodes.push(depth);
          if (id === 'flanger' && v === 0) {
            const fb = push(ctx.createGain()) as GainNode;
            fb.gain.value = 0.5;
            d.connect(fb);
            fb.connect(d);
          }
        }
        break;
      }

      case 'phaser': {
        // Four cascaded allpass stages, swept together.
        const lfo = ctx.createOscillator();
        const depth = ctx.createGain();
        lfo.frequency.value = 0.4;
        depth.gain.value = 800;
        lfo.start();
        this.lfos.push(lfo);
        this.nodes.push(depth);
        lfo.connect(depth);
        for (let i = 0; i < 4; i++) {
          const ap = push(ctx.createBiquadFilter()) as BiquadFilterNode;
          ap.type = 'allpass';
          ap.frequency.value = 400 + i * 500;
          depth.connect(ap.frequency);
          if (i > 0) chain[chain.length - 2].connect(ap);
        }
        break;
      }

      case 'autoPan':
      case 'autoWah': {
        if (id === 'autoWah') {
          const f = push(ctx.createBiquadFilter()) as BiquadFilterNode;
          f.type = 'bandpass';
          f.frequency.value = 800;
          f.Q.value = 6;
          const lfo = ctx.createOscillator();
          const depth = ctx.createGain();
          lfo.frequency.value = 0.25;
          depth.gain.value = 700;
          lfo.connect(depth);
          depth.connect(f.frequency);
          lfo.start();
          this.lfos.push(lfo);
          this.nodes.push(depth);
        } else {
          const p = push(ctx.createStereoPanner()) as StereoPannerNode;
          const lfo = ctx.createOscillator();
          const depth = ctx.createGain();
          lfo.frequency.value = 1;
          depth.gain.value = 1;
          lfo.connect(depth);
          depth.connect(p.pan);
          lfo.start();
          this.lfos.push(lfo);
          this.nodes.push(depth);
        }
        break;
      }

      case 'bitcrush':
      case 'vintage3000':
      case 'vintageMPC60':
      case 'vintageSP1200':
      case 'vinylEmu':
      case 'tapeEmu': {
        try {
          const w = new AudioWorkletNode(ctx, 'lofi-processor', {
            outputChannelCount: [2],
          });
          this.worklet = w;
          push(w);
          if (id === 'vintage3000') {
            w.parameters.get('bits')!.value = 12;
            w.parameters.get('decimate')!.value = 18;
          } else if (id === 'vintageMPC60') {
            w.parameters.get('bits')!.value = 12;
            w.parameters.get('decimate')!.value = 32;
          } else if (id === 'vintageSP1200') {
            w.parameters.get('bits')!.value = 12;
            w.parameters.get('decimate')!.value = 46;
          } else if (id === 'vinylEmu') {
            w.parameters.get('bits')!.value = 14;
            w.parameters.get('decimate')!.value = 8;
            w.parameters.get('noise')!.value = 25;
          } else if (id === 'tapeEmu') {
            w.parameters.get('bits')!.value = 16;
            w.parameters.get('decimate')!.value = 12;
            w.parameters.get('noise')!.value = 15;
          }
          const tone = push(ctx.createBiquadFilter()) as BiquadFilterNode;
          tone.type = 'lowpass';
          tone.frequency.value =
            id === 'vintageSP1200' ? 7000
            : id === 'vintageMPC60' ? 9000
            : id === 'vinylEmu' ? 8500
            : id === 'tapeEmu' ? 7500
            : 11000;
          w.connect(tone);
        } catch {
          this.current = 'off';
          this.dry.gain.setTargetAtTime(1, now, 0.02);
          this.wet.gain.setTargetAtTime(0, now, 0.02);
          return;
        }
        break;
      }
    }

    if (chain.length === 0) return;

    // Wire input -> first, and last -> wet. Intermediate links were made above
    // where the effect needed a specific order.
    this.input.connect(chain[0]);
    const last = chain[chain.length - 1];
    last.connect(this.wet);

    // Effects that replace the signal rather than adding to it run fully wet.
    const insert =
      id === 'lpFilter' || id === 'hpFilter' || id === 'bpFilter' ||
      id === 'compressor' || id === 'limiter' || id === 'transient' || id === 'noiseGate' ||
      id === 'bitcrush' || id === 'vintage3000' || id === 'vintageMPC60' || id === 'vintageSP1200' ||
      id === 'vinylEmu' || id === 'tapeEmu' ||
      id === 'autoPan' || id === 'autoWah' || id === 'pumper';

    this.dry.gain.setTargetAtTime(insert ? 0 : 0.75, now, 0.02);
    this.wet.gain.setTargetAtTime(insert ? 1 : 0.35, now, 0.02);
  }

  /** k is 0-2 for K1-K3; v is normalised 0-1. */
  setParam(k: 0 | 1 | 2, v: number) {
    this.applyParam(k, v, false);
  }

  setShiftParam(k: 0 | 1 | 2, v: number) {
    this.shiftVals[k] = Math.max(0, Math.min(1, v));
    this.applyParam(k, v, true);
  }

  private applyParam(k: 0 | 1 | 2, v: number, shift: boolean) {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const id = this.current;
    const n = Math.max(0, Math.min(1, v));
    const ramp = (p: AudioParam, val: number) => p.setTargetAtTime(val, t, 0.02);

    const find = <T extends AudioNode>(pred: (x: AudioNode) => boolean): T | undefined =>
      this.nodes.find(pred) as T | undefined;

    switch (id) {
      case 'delay':
      case 'diffDelay':
      case 'tapeDelay': {
        const d = find<DelayNode>((x) => x instanceof DelayNode);
        const fb = find<GainNode>((x) => x instanceof GainNode);
        const damp = find<BiquadFilterNode>((x) => x instanceof BiquadFilterNode);
        if (shift) {
          if (k === 0) this.delaySync = v >= 0.5;
          if (k === 1 && damp) ramp(damp.frequency, 500 + v * 19500);
          if (k === 2) ramp(this.wet.gain, v * 0.5);
        } else {
          if (k === 0 && d) ramp(d.delayTime, this.delaySync ? 0.125 + v * 0.375 : 0.02 + v * 1.2);
          if (k === 1 && fb) ramp(fb.gain, v * 0.92);
          if (k === 2) { ramp(this.wet.gain, v); ramp(this.dry.gain, 1 - v * 0.6); }
        }
        break;
      }
      case 'sampleDelay': {
        const delays = this.nodes.filter((x) => x instanceof DelayNode) as DelayNode[];
        if (k === 0 && delays[0]) ramp(delays[0].delayTime, v * 0.25);
        if (k === 1 && delays[1]) ramp(delays[1].delayTime, v * 0.25);
        if (k === 2) { ramp(this.wet.gain, v); ramp(this.dry.gain, 1 - v * 0.5); }
        break;
      }
      case 'reverbSmall':
      case 'reverbMed':
      case 'reverbLarge':
      case 'springReverb': {
        const pre = find<DelayNode>((x) => x instanceof DelayNode);
        const conv = find<ConvolverNode>((x) => x instanceof ConvolverNode);
        if (shift) {
          if (k === 0) ramp(this.dry.gain, 0.3 + v * 0.5);
          if (k === 1 && conv) {
            const sec = id === 'reverbLarge' ? 2 + v * 4 : id === 'reverbMed' ? 1 + v * 3 : 0.5 + v * 2;
            conv.buffer = makeImpulse(ctx, sec, 2 + v * 2);
          }
        } else {
          if (k === 0 && pre) ramp(pre.delayTime, v * 0.25);
          if (k === 1 && conv) {
            const base = id === 'reverbLarge' ? 3.2 : id === 'reverbMed' ? 2 : id === 'springReverb' ? 1.4 : 1;
            conv.buffer = makeImpulse(ctx, base + v * 4, id === 'springReverb' ? 3.5 : 2.4);
          }
          if (k === 2) { ramp(this.wet.gain, v); ramp(this.dry.gain, 1 - v * 0.5); }
        }
        break;
      }
      case 'lpFilter':
      case 'hpFilter':
      case 'bpFilter': {
        const f = find<BiquadFilterNode>((x) => x instanceof BiquadFilterNode);
        if (!f) break;
        if (k === 0) ramp(f.frequency, 20 * Math.pow(1000, n));
        if (k === 1) ramp(f.Q, 0.7 + n * 19);
        break;
      }
      case 'compressor':
      case 'limiter':
      case 'transient':
      case 'noiseGate': {
        const c = find<DynamicsCompressorNode>((x) => x instanceof DynamicsCompressorNode);
        if (!c) break;
        if (shift && id === 'compressor') {
          if (k === 0) ramp(c.ratio, 1 + v * 19);
          if (k === 1) ramp(c.threshold, -40 + v * 30);
          if (k === 2) { ramp(this.wet.gain, v); ramp(this.dry.gain, 1 - v); }
        } else if (shift && id === 'noiseGate') {
          if (k === 0) ramp(c.attack, 0.0005 + v * 0.05);
          if (k === 1) ramp(c.release, 0.01 + v * 0.4);
          if (k === 2) ramp(c.release, 0.05 + v * 0.8);
        } else {
          if (k === 0) ramp(c.attack, 0.0005 + v * 0.15);
          if (k === 1) ramp(c.release, 0.01 + v * 0.6);
          if (k === 2) {
            if (id === 'transient') ramp(c.ratio, 1 + v * 8);
            else ramp(c.threshold, -60 * v);
          }
        }
        break;
      }
      case 'pumper': {
        if (this.pumpLfo) {
          if (k === 0) ramp(this.pumpLfo.frequency, 0.5 + v * 7.5);
          if (k === 1) {
            const depth = this.nodes.find((x) => x instanceof GainNode && x !== this.dry && x !== this.wet) as GainNode | undefined;
            if (depth) ramp(depth.gain, v * 0.6);
          }
          if (k === 2) { ramp(this.wet.gain, v); ramp(this.dry.gain, 1 - v * 0.5); }
        }
        break;
      }
      case 'tubeDrive':
      case 'softClipper':
      case 'ampSim': {
        const ws = find<WaveShaperNode>((x) => x instanceof WaveShaperNode);
        const tone = find<BiquadFilterNode>((x) => x instanceof BiquadFilterNode);
        if (shift && id === 'ampSim') {
          if (k === 0 && tone) { tone.type = 'lowshelf'; tone.frequency.value = 120; ramp(tone.gain, (v - 0.5) * 24); }
          if (k === 1 && tone) { tone.type = 'peaking'; tone.frequency.value = 800; ramp(tone.gain, (v - 0.5) * 24); }
          if (k === 2 && tone) { tone.type = 'highshelf'; tone.frequency.value = 4000; ramp(tone.gain, (v - 0.5) * 24); }
        } else {
          if (k === 0 && ws) ws.curve = driveCurve(0.02 + v * (id === 'ampSim' ? 0.8 : 0.5));
          if (k === 1 && tone) ramp(tone.frequency, 800 + v * 15000);
          if (k === 2) { ramp(this.wet.gain, v); ramp(this.dry.gain, 1 - v); }
        }
        break;
      }
      case 'chorus':
      case 'ensemble':
      case 'multiChorus':
      case 'flanger':
      case 'phaser':
      case 'autoPan':
      case 'autoWah': {
        const lfo = this.lfos[0];
        const depth = this.nodes.find((x) => x instanceof GainNode && x !== this.dry && x !== this.wet) as GainNode | undefined;
        if (k === 0 && lfo) ramp(lfo.frequency, 0.05 + v * 8);
        if (k === 1 && depth) ramp(depth.gain, depth.gain.value === 0 ? 0 : v * (id === 'phaser' || id === 'autoWah' ? 2000 : 0.01));
        if (k === 2) { ramp(this.wet.gain, v); ramp(this.dry.gain, 1 - v * 0.7); }
        break;
      }
      case 'bitcrush':
      case 'vintage3000':
      case 'vintageMPC60':
      case 'vintageSP1200':
      case 'vinylEmu':
      case 'tapeEmu': {
        const w = this.worklet;
        if (!w) break;
        if (id === 'vinylEmu' || id === 'tapeEmu') {
          if (k === 0) w.parameters.get('decimate')!.setTargetAtTime(v * 40, t, 0.02);
          if (k === 1) w.parameters.get('noise')!.setTargetAtTime(v * 100, t, 0.02);
          if (k === 2) w.parameters.get('bits')!.setTargetAtTime(24 - v * 10, t, 0.02);
        } else {
          if (k === 0) w.parameters.get('bits')!.setTargetAtTime(24 - v * 22, t, 0.02);
          if (k === 1) w.parameters.get('decimate')!.setTargetAtTime(v * 100, t, 0.02);
          if (k === 2) w.parameters.get('mix')!.setTargetAtTime(v * 100, t, 0.02);
        }
        break;
      }
      default:
        break;
    }
  }

  dispose() {
    this.teardown();
    try {
      this.input.disconnect();
      this.dry.disconnect();
      this.wet.disconnect();
      this.output.disconnect();
    } catch { /* noop */ }
  }
}
