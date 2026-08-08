import type { Pad, FilterType } from './types';

/**
 * A single playing note. Created per hit, disposed on end.
 *
 * Graph: source -> ampGain -> filter -> panner -> destination
 *
 * Everything downstream of `destination` (the pad's persistent gain node) is
 * created once at init and never torn down.
 */
export interface Voice {
  pad: number;
  bank: number;
  muteGroup: number | null;
  startedAt: number;
  source: AudioBufferSourceNode;
  ampGain: GainNode;
  stop(when?: number): void;
}

/** 0-127 -> seconds, exponential-ish so low values are usefully short. */
function envTime(v: number, max = 4): number {
  const n = Math.max(0, Math.min(127, v)) / 127;
  return n * n * max;
}

function filterConfig(type: FilterType): { biquad: BiquadFilterType; q: number } | null {
  switch (type) {
    case 'off': return null;
    case 'classic': return { biquad: 'lowpass', q: 1.2 };
    case 'lpf2': return { biquad: 'lowpass', q: 1 };
    case 'lpf4': return { biquad: 'lowpass', q: 1 };
    case 'hpf2': return { biquad: 'highpass', q: 1 };
    case 'hpf4': return { biquad: 'highpass', q: 1 };
    case 'bpf2': return { biquad: 'bandpass', q: 1 };
    case 'bpf4': return { biquad: 'bandpass', q: 1 };
  }
}

/** 0-127 -> Hz, roughly logarithmic across the audible band. */
function cutoffHz(v: number): number {
  const n = Math.max(0, Math.min(127, v)) / 127;
  return 20 * Math.pow(1000, n); // 20 Hz .. 20 kHz
}

function dbToGain(db: number): number {
  return db === -Infinity ? 0 : Math.pow(10, db / 20);
}

export interface TriggerOptions {
  ctx: AudioContext;
  buffer: AudioBuffer;
  pad: Pad;
  padIndex: number;
  bankIndex: number;
  destination: AudioNode;
  /** Absolute AudioContext time. */
  when: number;
  velocity: number; // 1-127
  /** Optional slice override for chop mode. */
  slice?: { start: number; end: number };
  /** Playback rate multiplier from warp/tune. */
  rate?: number;
}

export function triggerVoice(o: TriggerOptions): Voice {
  const { ctx, buffer, pad, destination, when, velocity } = o;

  const sr = buffer.sampleRate;
  const region = o.slice ?? { start: pad.start, end: pad.end || buffer.length };
  const startFrame = Math.max(0, Math.min(buffer.length - 1, region.start));
  const endFrame = Math.max(startFrame + 1, Math.min(buffer.length, region.end));

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  // Tuning: semitones + cents, combined with any warp rate.
  const detune = pad.semi * 100 + pad.fine;
  const rate = o.rate ?? 1;
  source.playbackRate.value = rate;
  // detune is not universally supported on BufferSource; fold it into rate.
  if (detune !== 0) {
    source.playbackRate.value = rate * Math.pow(2, detune / 1200);
  }

  const ampGain = ctx.createGain();
  const panner = ctx.createStereoPanner();
  panner.pan.value = Math.max(-1, Math.min(1, pad.pan));

  let last: AudioNode = ampGain;
  const fc = filterConfig(pad.filterType);
  let filter: BiquadFilterNode | null = null;
  if (fc) {
    filter = ctx.createBiquadFilter();
    filter.type = fc.biquad;
    filter.Q.value = fc.q + (pad.reso / 127) * 18;
    filter.frequency.value = cutoffHz(pad.cutoff);
    ampGain.connect(filter);
    last = filter;
  }
  last.connect(panner);
  panner.connect(destination);
  source.connect(ampGain);

  // ---- amplitude envelope -------------------------------------------------
  const velScale = 1 - (pad.ampEnv.amount / 127) * (1 - velocity / 127);
  const peak = dbToGain(pad.gain) * Math.max(0, Math.min(1, velScale));

  const attack = envTime(pad.ampEnv.attack, 2);
  const decay = envTime(pad.ampEnv.decay, 6);
  const regionSeconds = (endFrame - startFrame) / sr / source.playbackRate.value;

  const g = ampGain.gain;
  g.cancelScheduledValues(when);
  g.setValueAtTime(0, when);
  if (attack > 0.001) {
    g.linearRampToValueAtTime(peak, when + attack);
  } else {
    g.setValueAtTime(peak, when);
  }

  if (!pad.noteOn) {
    // One-shot: apply decay from either the start or the end of the region.
    const decayStart =
      pad.ampEnv.decayFrom === 'start'
        ? when + attack
        : when + Math.max(attack, regionSeconds - decay);
    if (decay > 0.001) {
      // setTargetAtTime gives a natural exponential tail; /3 approximates
      // reaching near-silence within the stated time.
      g.setTargetAtTime(0, decayStart, Math.max(0.005, decay / 3));
    }
  }

  // ---- filter envelope ----------------------------------------------------
  if (filter && pad.filterEnv.amount > 0) {
    const depth = pad.filterEnv.amount / 127;
    const base = cutoffHz(pad.cutoff);
    const top = cutoffHz(Math.min(127, pad.cutoff + depth * 127));
    const fa = envTime(pad.filterEnv.attack, 2);
    const fd = envTime(pad.filterEnv.decay, 6);
    const f = filter.frequency;
    f.cancelScheduledValues(when);
    f.setValueAtTime(base, when);
    f.linearRampToValueAtTime(top, when + Math.max(0.001, fa));
    if (fd > 0.001) f.setTargetAtTime(base, when + fa, Math.max(0.005, fd / 3));
  }

  // ---- region / looping ---------------------------------------------------
  const startSec = startFrame / sr;
  const durSec = (endFrame - startFrame) / sr;

  if (pad.loop) {
    source.loop = true;
    source.loopStart = (pad.loopStart || startFrame) / sr;
    source.loopEnd = endFrame / sr;
    source.start(when, startSec);
  } else {
    source.start(when, startSec, durSec);
  }

  const voice: Voice = {
    pad: o.padIndex,
    bank: o.bankIndex,
    muteGroup: pad.muteGroup,
    startedAt: when,
    source,
    ampGain,
    stop(at?: number) {
      const t = at ?? ctx.currentTime;
      const release = pad.noteOn ? envTime(pad.ampEnv.decay, 6) : 0.006;
      try {
        g.cancelScheduledValues(t);
        g.setValueAtTime(g.value, t);
        g.setTargetAtTime(0, t, Math.max(0.003, release / 3));
        source.stop(t + Math.max(0.02, release + 0.05));
      } catch {
        /* already stopped */
      }
    },
  };

  source.onended = () => {
    try {
      panner.disconnect();
      filter?.disconnect();
      ampGain.disconnect();
      source.disconnect();
    } catch {
      /* noop */
    }
  };

  return voice;
}
