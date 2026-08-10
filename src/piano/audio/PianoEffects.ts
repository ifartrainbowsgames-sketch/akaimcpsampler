import { Filter, Gain, Reverb, StereoWidener } from 'tone';

/** Reusable effect chain — nodes created once, params updated in place. */
export class PianoEffects {
  readonly input: Gain;
  readonly filter: Filter;
  readonly widener: StereoWidener;
  readonly reverb: Reverb;
  readonly output: Gain;

  constructor() {
    this.input = new Gain(1);
    this.filter = new Filter({ type: 'lowpass', frequency: 8000, Q: 0.7 });
    this.widener = new StereoWidener(0.5);
    this.reverb = new Reverb({ decay: 2.8, wet: 0.25 });
    this.output = new Gain(0.85);

    this.input.chain(this.filter, this.widener, this.reverb, this.output);
  }

  async ready() {
    await this.reverb.generate();
  }

  setVolume(v: number) {
    this.output.gain.rampTo(v, 0.02);
  }

  setReverb(v: number) {
    this.reverb.wet.rampTo(v, 0.05);
  }

  setTone(v: number) {
    const hz = 800 + v * 7200;
    this.filter.frequency.rampTo(hz, 0.05);
  }

  setStereoWidth(v: number) {
    this.widener.width.rampTo(v, 0.05);
  }

  dispose() {
    this.input.dispose();
    this.filter.dispose();
    this.widener.dispose();
    this.reverb.dispose();
    this.output.dispose();
  }
}
