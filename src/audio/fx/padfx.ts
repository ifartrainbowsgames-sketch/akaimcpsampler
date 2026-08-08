/**
 * Pad FX: momentary effects triggered by pad pressure, applied to the master
 * output. Up to four at once; a fifth bypasses the oldest, which re-engages
 * when the newer ones release.
 *
 * Unlike Knob FX these are performance controls — they must engage and release
 * cleanly under a finger, so every parameter change is ramped rather than set.
 *
 * See BUILD_PLAN.md Appendix A.9 for the full table.
 */

export type PadFXId =
  | 'halfSpeed' | 'chorus' | 'flanger' | 'phaser'
  | 'comb' | 'lpFilter' | 'hpFilter' | 'bpFilter'
  | 'ringMod' | 'lofi' | 'color' | 'granular'
  | 'beatRepeat' | 'revStepper' | 'delay' | 'reverb';

export const PAD_FX: { id: PadFXId; name: string }[] = [
  { id: 'halfSpeed', name: 'Half Speed' },
  { id: 'chorus', name: 'Chorus' },
  { id: 'flanger', name: 'Flanger' },
  { id: 'phaser', name: 'Phaser' },
  { id: 'comb', name: 'Comb Filter' },
  { id: 'lpFilter', name: 'LP Filter' },
  { id: 'hpFilter', name: 'HP Filter' },
  { id: 'bpFilter', name: 'BP Filter' },
  { id: 'ringMod', name: 'Ring Mod' },
  { id: 'lofi', name: 'LoFi' },
  { id: 'color', name: 'Color' },
  { id: 'granular', name: 'Granulator' },
  { id: 'beatRepeat', name: 'Beat Repeat' },
  { id: 'revStepper', name: 'Rev Stepper' },
  { id: 'delay', name: 'Delay' },
  { id: 'reverb', name: 'Reverb' },
];

const MAX_ACTIVE = 4;

interface Slot {
  id: PadFXId;
  wet: GainNode;
  nodes: AudioNode[];
  lfos: OscillatorNode[];
  worklet: AudioWorkletNode | null;
  /** Applies pressure, 0-1. */
  apply(amount: number): void;
  dispose(): void;
}

export class PadFXRack {
  private ctx: AudioContext;
  readonly input: GainNode;
  readonly output: GainNode;

  private active = new Map<PadFXId, Slot>();
  private order: PadFXId[] = [];
  latched = new Set<PadFXId>();

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    // Dry path always present — effects run in parallel and blend in.
    this.input.connect(this.output);
  }

  private build(id: PadFXId): Slot | null {
    const ctx = this.ctx;
    const wet = ctx.createGain();
    wet.gain.value = 0;
    wet.connect(this.output);

    const nodes: AudioNode[] = [];
    const lfos: OscillatorNode[] = [];
    let worklet: AudioWorkletNode | null = null;
    let apply: (a: number) => void = () => {};

    const t = () => ctx.currentTime;
    const ramp = (p: AudioParam, v: number) => p.setTargetAtTime(v, t(), 0.015);

    switch (id) {
      case 'lpFilter':
      case 'hpFilter':
      case 'bpFilter':
      case 'comb': {
        const f = ctx.createBiquadFilter();
        f.type = id === 'hpFilter' ? 'highpass'
          : id === 'bpFilter' ? 'bandpass'
          : id === 'comb' ? 'notch'
          : 'lowpass';
        f.frequency.value = 20000;
        f.Q.value = 4;
        this.input.connect(f);
        f.connect(wet);
        nodes.push(f);
        apply = (a) => {
          // Pressure sweeps the cutoff. LP sweeps down, HP sweeps up.
          const target = id === 'hpFilter'
            ? 20 * Math.pow(1000, a)
            : 20 * Math.pow(1000, 1 - a * 0.92);
          ramp(f.frequency, target);
          ramp(wet.gain, a > 0.02 ? 1 : 0);
          ramp(this.input.gain, a > 0.02 ? 0.02 : 1);
        };
        break;
      }

      case 'delay': {
        const d = ctx.createDelay(2);
        const fb = ctx.createGain();
        d.delayTime.value = 0.1875; // dotted 1/16 at 120
        fb.gain.value = 0.45;
        this.input.connect(d);
        d.connect(fb);
        fb.connect(d);
        d.connect(wet);
        nodes.push(d, fb);
        apply = (a) => { ramp(wet.gain, a); ramp(fb.gain, 0.2 + a * 0.6); };
        break;
      }

      case 'reverb': {
        const conv = ctx.createConvolver();
        const len = Math.floor(ctx.sampleRate * 2.4);
        const buf = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let ch = 0; ch < 2; ch++) {
          const data = buf.getChannelData(ch);
          for (let i = 0; i < len; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
          }
        }
        conv.buffer = buf;
        this.input.connect(conv);
        conv.connect(wet);
        nodes.push(conv);
        apply = (a) => ramp(wet.gain, a);
        break;
      }

      case 'chorus':
      case 'flanger': {
        const d = ctx.createDelay(0.05);
        d.delayTime.value = id === 'flanger' ? 0.005 : 0.018;
        const lfo = ctx.createOscillator();
        const depth = ctx.createGain();
        lfo.frequency.value = id === 'flanger' ? 0.35 : 1.4;
        depth.gain.value = id === 'flanger' ? 0.0035 : 0.006;
        lfo.connect(depth);
        depth.connect(d.delayTime);
        lfo.start();
        this.input.connect(d);
        d.connect(wet);
        nodes.push(d, depth);
        lfos.push(lfo);
        apply = (a) => { ramp(wet.gain, a); ramp(depth.gain, a * 0.008); };
        break;
      }

      case 'phaser': {
        const stages: BiquadFilterNode[] = [];
        const lfo = ctx.createOscillator();
        const depth = ctx.createGain();
        lfo.frequency.value = 0.5;
        depth.gain.value = 900;
        lfo.connect(depth);
        lfo.start();
        lfos.push(lfo);
        nodes.push(depth);
        let prev: AudioNode = this.input;
        for (let i = 0; i < 4; i++) {
          const ap = ctx.createBiquadFilter();
          ap.type = 'allpass';
          ap.frequency.value = 350 + i * 550;
          depth.connect(ap.frequency);
          prev.connect(ap);
          prev = ap;
          stages.push(ap);
          nodes.push(ap);
        }
        prev.connect(wet);
        apply = (a) => { ramp(wet.gain, a); ramp(depth.gain, 200 + a * 2200); };
        break;
      }

      case 'ringMod':
      case 'lofi':
      case 'color': {
        try {
          const w = new AudioWorkletNode(ctx, 'lofi-processor', { outputChannelCount: [2] });
          worklet = w;
          this.input.connect(w);
          w.connect(wet);
          nodes.push(w);
          apply = (a) => {
            ramp(wet.gain, a > 0.02 ? 1 : 0);
            ramp(this.input.gain, a > 0.02 ? 0.02 : 1);
            if (id === 'ringMod') {
              w.parameters.get('ringFreq')!.setTargetAtTime(40 + a * 360, t(), 0.02);
            } else if (id === 'lofi') {
              w.parameters.get('bits')!.setTargetAtTime(24 - a * 21, t(), 0.02);
              w.parameters.get('decimate')!.setTargetAtTime(a * 90, t(), 0.02);
            } else {
              // Color: tape-ish grit — mild crush plus hiss.
              w.parameters.get('bits')!.setTargetAtTime(24 - a * 10, t(), 0.02);
              w.parameters.get('noise')!.setTargetAtTime(a * 40, t(), 0.02);
            }
            w.parameters.get('mix')!.setTargetAtTime(a * 100, t(), 0.02);
          };
        } catch {
          return null;
        }
        break;
      }

      case 'halfSpeed':
      case 'beatRepeat':
      case 'revStepper':
      case 'granular': {
        try {
          const w = new AudioWorkletNode(ctx, 'beat-repeat-processor', {
            outputChannelCount: [2],
          });
          worklet = w;
          this.input.connect(w);
          w.connect(wet);
          nodes.push(w);
          apply = (a) => {
            const on = a > 0.02;
            ramp(wet.gain, on ? 1 : 0);
            ramp(this.input.gain, on ? 0.02 : 1);
            w.parameters.get('active')!.value = on ? 1 : 0;
            w.parameters.get('mix')!.setTargetAtTime(100, t(), 0.01);
            if (id === 'halfSpeed') {
              w.parameters.get('length')!.value = 0.5;
              w.parameters.get('rate')!.value = 0.5 - a * 0.25;
            } else if (id === 'beatRepeat') {
              // Harder press = shorter loop = faster stutter.
              w.parameters.get('length')!.value = 0.5 - a * 0.45;
              w.parameters.get('reverse')!.value = 0;
            } else if (id === 'revStepper') {
              w.parameters.get('length')!.value = 0.35 - a * 0.28;
              w.parameters.get('reverse')!.value = 1;
            } else {
              w.parameters.get('length')!.value = 0.12 - a * 0.1;
              w.parameters.get('gate')!.value = 2 + a * 24;
            }
          };
        } catch {
          return null;
        }
        break;
      }
    }

    return {
      id,
      wet,
      nodes,
      lfos,
      worklet,
      apply,
      dispose: () => {
        for (const l of lfos) { try { l.stop(); l.disconnect(); } catch { /* noop */ } }
        for (const n of nodes) { try { n.disconnect(); } catch { /* noop */ } }
        try { wet.disconnect(); } catch { /* noop */ }
      },
    };
  }

  /** Engage an effect. `amount` is pad pressure, 0-1. */
  press(id: PadFXId, amount: number) {
    let slot = this.active.get(id);
    if (!slot) {
      const built = this.build(id);
      if (!built) return;
      slot = built;
      this.active.set(id, slot);
      this.order.push(id);
      // A fifth effect bypasses the oldest rather than refusing to engage.
      if (this.order.length > MAX_ACTIVE) {
        const oldest = this.order.shift();
        if (oldest && !this.latched.has(oldest)) this.release(oldest);
      }
    }
    slot.apply(Math.max(0, Math.min(1, amount)));
  }

  release(id: PadFXId) {
    if (this.latched.has(id)) return;
    const slot = this.active.get(id);
    if (!slot) return;
    slot.apply(0);
    // Let the ramp finish before tearing the graph down.
    window.setTimeout(() => {
      slot.dispose();
      this.active.delete(id);
      this.order = this.order.filter((x) => x !== id);
      if (this.active.size === 0) {
        this.input.gain.setTargetAtTime(1, this.ctx.currentTime, 0.02);
      }
    }, 220);
  }

  toggleLatch(id: PadFXId) {
    if (this.latched.has(id)) {
      this.latched.delete(id);
      this.release(id);
    } else {
      this.latched.add(id);
    }
  }

  releaseAll() {
    this.latched.clear();
    for (const id of [...this.active.keys()]) this.release(id);
  }

  dispose() {
    for (const s of this.active.values()) s.dispose();
    this.active.clear();
    this.order = [];
    try { this.input.disconnect(); this.output.disconnect(); } catch { /* noop */ }
  }
}
