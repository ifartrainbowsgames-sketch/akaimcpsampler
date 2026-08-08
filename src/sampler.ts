/**
 * Core, transport-agnostic model of an Akai-style pad sampler.
 *
 * The model is fully in-memory and deterministic (no real audio hardware),
 * so it can be exercised directly in unit tests and driven over MCP.
 */

export const PAD_COUNT = 16;
export const MIN_VELOCITY = 1;
export const MAX_VELOCITY = 127;

export interface Sample {
  id: string;
  name: string;
  /** Source file the sample would be loaded from. */
  filename: string;
  /** Nominal length of the one-shot in milliseconds. */
  durationMs: number;
}

export interface Pad {
  /** 1-based pad index, matching classic 4x4 hardware layouts. */
  index: number;
  sampleId: string | null;
  /** Linear output gain, 0.0 - 1.0. */
  gain: number;
  /** Pitch offset applied when the pad is triggered. */
  tuneSemitones: number;
}

export interface TriggerEvent {
  padIndex: number;
  sampleId: string;
  sampleName: string;
  velocity: number;
  /** Effective gain = pad gain scaled by normalized velocity. */
  effectiveGain: number;
  tuneSemitones: number;
  /** Monotonic voice id for the triggered one-shot. */
  voiceId: number;
  durationMs: number;
}

export class SamplerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SamplerError";
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Default kit shipped with the sampler so it is usable out of the box. */
function defaultSamples(): Sample[] {
  return [
    { id: "kick", name: "Kick 909", filename: "kick_909.wav", durationMs: 320 },
    { id: "snare", name: "Snare 909", filename: "snare_909.wav", durationMs: 210 },
    { id: "clap", name: "Hand Clap", filename: "clap.wav", durationMs: 180 },
    { id: "chh", name: "Closed Hat", filename: "hat_closed.wav", durationMs: 90 },
    { id: "ohh", name: "Open Hat", filename: "hat_open.wav", durationMs: 400 },
    { id: "rim", name: "Rimshot", filename: "rim.wav", durationMs: 120 },
    { id: "tom", name: "Low Tom", filename: "tom_low.wav", durationMs: 500 },
    { id: "cow", name: "Cowbell", filename: "cowbell.wav", durationMs: 260 },
  ];
}

export class Sampler {
  readonly kitName: string;
  private readonly samples = new Map<string, Sample>();
  private readonly pads: Pad[] = [];
  private nextVoiceId = 1;

  constructor(kitName = "Default Kit") {
    this.kitName = kitName;
    for (const sample of defaultSamples()) {
      this.samples.set(sample.id, sample);
    }

    const sampleIds = [...this.samples.keys()];
    for (let index = 1; index <= PAD_COUNT; index++) {
      this.pads.push({
        index,
        sampleId: sampleIds[index - 1] ?? null,
        gain: 0.8,
        tuneSemitones: 0,
      });
    }
  }

  listSamples(): Sample[] {
    return [...this.samples.values()];
  }

  getSample(id: string): Sample | undefined {
    return this.samples.get(id);
  }

  /** Register a new sample. Throws if the id already exists. */
  addSample(sample: Sample): Sample {
    if (this.samples.has(sample.id)) {
      throw new SamplerError(`Sample "${sample.id}" already exists`);
    }
    if (sample.durationMs <= 0) {
      throw new SamplerError("durationMs must be positive");
    }
    this.samples.set(sample.id, { ...sample });
    return { ...sample };
  }

  listPads(): Pad[] {
    return this.pads.map((pad) => ({ ...pad }));
  }

  private padAt(index: number): Pad {
    if (!Number.isInteger(index) || index < 1 || index > PAD_COUNT) {
      throw new SamplerError(`Pad index must be an integer between 1 and ${PAD_COUNT}`);
    }
    return this.pads[index - 1];
  }

  /** Map a sample onto a pad (optionally tuning/gaining it). */
  assignPad(
    index: number,
    sampleId: string,
    opts: { gain?: number; tuneSemitones?: number } = {},
  ): Pad {
    const pad = this.padAt(index);
    if (!this.samples.has(sampleId)) {
      throw new SamplerError(`Unknown sample "${sampleId}"`);
    }
    pad.sampleId = sampleId;
    if (opts.gain !== undefined) {
      pad.gain = clamp(opts.gain, 0, 1);
    }
    if (opts.tuneSemitones !== undefined) {
      pad.tuneSemitones = clamp(Math.round(opts.tuneSemitones), -24, 24);
    }
    return { ...pad };
  }

  /** Strike a pad and return the resulting voice/trigger event. */
  trigger(index: number, velocity: number = MAX_VELOCITY): TriggerEvent {
    const pad = this.padAt(index);
    if (!pad.sampleId) {
      throw new SamplerError(`Pad ${index} is empty`);
    }
    if (!Number.isFinite(velocity) || velocity < MIN_VELOCITY || velocity > MAX_VELOCITY) {
      throw new SamplerError(`Velocity must be between ${MIN_VELOCITY} and ${MAX_VELOCITY}`);
    }
    const sample = this.samples.get(pad.sampleId);
    if (!sample) {
      throw new SamplerError(`Pad ${index} references missing sample "${pad.sampleId}"`);
    }

    const normalizedVelocity = velocity / MAX_VELOCITY;
    const effectiveGain = Math.round(pad.gain * normalizedVelocity * 1000) / 1000;

    return {
      padIndex: index,
      sampleId: sample.id,
      sampleName: sample.name,
      velocity,
      effectiveGain,
      tuneSemitones: pad.tuneSemitones,
      voiceId: this.nextVoiceId++,
      durationMs: sample.durationMs,
    };
  }

  /** Serializable snapshot of the whole instrument. */
  snapshot() {
    return {
      kitName: this.kitName,
      samples: this.listSamples(),
      pads: this.listPads(),
    };
  }
}
