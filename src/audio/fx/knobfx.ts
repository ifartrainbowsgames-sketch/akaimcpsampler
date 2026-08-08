/**
 * Knob FX: a single effect controlled by three parameters, inserted on the
 * master bus. Native nodes cover most of the list and cost essentially
 * nothing; only bitcrush and the vintage emulators need a worklet.
 *
 * See BUILD_PLAN.md Appendix A.11 for the full parameter table.
 */

export type KnobFXId =
  | 'off'
  | 'delay' | 'tapeDelay'
  | 'reverbSmall' | 'reverbLarge'
  | 'lpFilter' | 'hpFilter' | 'bpFilter'
  | 'compressor' | 'limiter'
  | 'tubeDrive' | 'softClipper'
  | 'chorus' | 'flanger' | 'phaser' | 'autoPan'
  | 'bitcrush' | 'vintage3000' | 'vintageSP1200';

export interface KnobFXDef {
  id: KnobFXId;
  name: string;
  params: [string, string, string];
}

export const KNOB_FX: KnobFXDef[] = [
  { id: 'off', name: 'Off', params: ['—', '—', '—'] },
  { id: 'delay', name: 'Delay', params: ['Time', 'Feedback', 'Mix'] },
  { id: 'tapeDelay', name: 'Tape Delay', params: ['Time', 'Feedback', 'Mix'] },
  { id: 'reverbSmall', name: 'Reverb Small', params: ['Pre-Delay', 'Time', 'Mix'] },
  { id: 'reverbLarge', name: 'Reverb Large', params: ['Pre-Delay', 'Time', 'Mix'] },
  { id: 'lpFilter', name: 'LP Filter', params: ['Frequency', 'Resonance', '—'] },
  { id: 'hpFilter', name: 'HP Filter', params: ['Frequency', 'Resonance', '—'] },
  { id: 'bpFilter', name: 'BP Filter', params: ['Frequency', 'Resonance', '—'] },
  { id: 'compressor', name: 'Bus Compressor', params: ['Attack', 'Release', 'Threshold'] },
  { id: 'limiter', name: 'Limiter', params: ['Gain', 'Ceiling', 'Release'] },
  { id: 'tubeDrive', name: 'Tube Drive', params: ['Drive', 'Headroom', 'Saturation'] },
  { id: 'softClipper', name: 'Soft Clipper', params: ['Drive', 'Shape', 'Mix'] },
  { id: 'chorus', name: 'Chorus', params: ['Rate', 'Depth', 'Mix'] },
  { id: 'flanger', name: 'Flanger', params: ['Rate', 'Depth', 'Feedback'] },
  { id: 'phaser', name: 'Phaser', params: ['Rate', 'Depth', 'Mix'] },
  { id: 'autoPan', name: 'Auto-Pan', params: ['Rate', '—', 'Mix'] },
  { id: 'bitcrush', name: 'LoFi', params: ['Bitcrush', 'Decimate', 'Mix'] },
  { id: 'vintage3000', name: 'Vintage MPC3000', params: ['Amount', 'Tone', 'Mix'] },
  { id: 'vintageSP1200', name: 'Vintage SP1200', params: ['Amount', 'Tone', 'Mix'] },
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
        // Tape delay adds slow pitch instability.
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

      case 'reverbSmall':
      case 'reverbLarge': {
        const pre = push(ctx.createDelay(0.5)) as DelayNode;
        const conv = push(ctx.createConvolver()) as ConvolverNode;
        pre.delayTime.value = 0.02;
        conv.buffer = makeImpulse(ctx, id === 'reverbLarge' ? 3.2 : 1.0, 2.4);
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
      case 'limiter': {
        const c = push(ctx.createDynamicsCompressor()) as DynamicsCompressorNode;
        if (id === 'limiter') {
          c.threshold.value = -3;
          c.ratio.value = 20;
          c.attack.value = 0.001;
          c.release.value = 0.1;
          c.knee.value = 0;
        }
        break;
      }

      case 'tubeDrive':
      case 'softClipper': {
        const ws = push(ctx.createWaveShaper()) as WaveShaperNode;
        ws.curve = driveCurve(0.4);
        ws.oversample = '4x';
        const tone = push(ctx.createBiquadFilter()) as BiquadFilterNode;
        tone.type = 'lowpass';
        tone.frequency.value = 9000;
        ws.connect(tone);
        break;
      }

      case 'chorus':
      case 'flanger': {
        const d = push(ctx.createDelay(0.05)) as DelayNode;
        d.delayTime.value = id === 'flanger' ? 0.005 : 0.02;
        const lfo = ctx.createOscillator();
        const depth = ctx.createGain();
        lfo.frequency.value = id === 'flanger' ? 0.3 : 1.2;
        depth.gain.value = id === 'flanger' ? 0.003 : 0.006;
        lfo.connect(depth);
        depth.connect(d.delayTime);
        lfo.start();
        this.lfos.push(lfo);
        this.nodes.push(depth);
        if (id === 'flanger') {
          const fb = push(ctx.createGain()) as GainNode;
          fb.gain.value = 0.5;
          d.connect(fb);
          fb.connect(d);
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

      case 'autoPan': {
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
        break;
      }

      case 'bitcrush':
      case 'vintage3000':
      case 'vintageSP1200': {
        try {
          const w = new AudioWorkletNode(ctx, 'lofi-processor', {
            outputChannelCount: [2],
          });
          this.worklet = w;
          push(w);
          // The vintage emulators are bit-depth and sample-rate reduction plus
          // filtering, modelling 12-bit-era converters. Cheap, and
          // disproportionately loved.
          if (id === 'vintage3000') {
            w.parameters.get('bits')!.value = 12;
            w.parameters.get('decimate')!.value = 18;
          } else if (id === 'vintageSP1200') {
            w.parameters.get('bits')!.value = 12;
            w.parameters.get('decimate')!.value = 46;
          }
          const tone = push(ctx.createBiquadFilter()) as BiquadFilterNode;
          tone.type = 'lowpass';
          tone.frequency.value = id === 'vintageSP1200' ? 7000 : 11000;
          w.connect(tone);
        } catch {
          // Worklet module not loaded — fall through to dry.
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
      id === 'compressor' || id === 'limiter' ||
      id === 'bitcrush' || id === 'vintage3000' || id === 'vintageSP1200' ||
      id === 'autoPan';

    this.dry.gain.setTargetAtTime(insert ? 0 : 0.75, now, 0.02);
    this.wet.gain.setTargetAtTime(insert ? 1 : 0.35, now, 0.02);
  }

  /** k is 0-2 for K1-K3; v is normalised 0-1. */
  setParam(k: 0 | 1 | 2, v: number) {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const id = this.current;
    const n = Math.max(0, Math.min(1, v));
    const ramp = (p: AudioParam, val: number) => p.setTargetAtTime(val, t, 0.02);

    const find = <T extends AudioNode>(pred: (x: AudioNode) => boolean): T | undefined =>
      this.nodes.find(pred) as T | undefined;

    switch (id) {
      case 'delay':
      case 'tapeDelay': {
        const d = find<DelayNode>((x) => x instanceof DelayNode);
        const fb = find<GainNode>((x) => x instanceof GainNode);
        if (k === 0 && d) ramp(d.delayTime, 0.02 + n * 1.2);
        if (k === 1 && fb) ramp(fb.gain, n * 0.92);
        if (k === 2) { ramp(this.wet.gain, n); ramp(this.dry.gain, 1 - n * 0.6); }
        break;
      }
      case 'reverbSmall':
      case 'reverbLarge': {
        const pre = find<DelayNode>((x) => x instanceof DelayNode);
        if (k === 0 && pre) ramp(pre.delayTime, n * 0.25);
        if (k === 1) {
          const conv = find<ConvolverNode>((x) => x instanceof ConvolverNode);
          if (conv) conv.buffer = makeImpulse(ctx, 0.3 + n * 4, 2.4);
        }
        if (k === 2) { ramp(this.wet.gain, n); ramp(this.dry.gain, 1 - n * 0.5); }
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
      case 'limiter': {
        const c = find<DynamicsCompressorNode>((x) => x instanceof DynamicsCompressorNode);
        if (!c) break;
        if (k === 0) ramp(c.attack, 0.0005 + n * 0.15);
        if (k === 1) ramp(c.release, 0.01 + n * 0.6);
        if (k === 2) ramp(c.threshold, -60 * n);
        break;
      }
      case 'tubeDrive':
      case 'softClipper': {
        const ws = find<WaveShaperNode>((x) => x instanceof WaveShaperNode);
        const tone = find<BiquadFilterNode>((x) => x instanceof BiquadFilterNode);
        if (k === 0 && ws) ws.curve = driveCurve(0.02 + n);
        if (k === 1 && tone) ramp(tone.frequency, 800 + n * 15000);
        if (k === 2) { ramp(this.wet.gain, n); ramp(this.dry.gain, 1 - n); }
        break;
      }
      case 'chorus':
      case 'flanger':
      case 'phaser':
      case 'autoPan': {
        const lfo = this.lfos[0];
        const depth = this.nodes.find((x) => x instanceof GainNode) as GainNode | undefined;
        if (k === 0 && lfo) ramp(lfo.frequency, 0.05 + n * 8);
        if (k === 1 && depth) ramp(depth.gain, depth.gain.value === 0 ? 0 : n * (id === 'phaser' ? 2000 : 0.01));
        if (k === 2) { ramp(this.wet.gain, n); ramp(this.dry.gain, 1 - n * 0.7); }
        break;
      }
      case 'bitcrush':
      case 'vintage3000':
      case 'vintageSP1200': {
        const w = this.worklet;
        if (!w) break;
        if (k === 0) w.parameters.get('bits')!.setTargetAtTime(24 - n * 22, t, 0.02);
        if (k === 1) w.parameters.get('decimate')!.setTargetAtTime(n * 100, t, 0.02);
        if (k === 2) w.parameters.get('mix')!.setTargetAtTime(n * 100, t, 0.02);
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
