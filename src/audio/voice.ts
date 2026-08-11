import type { Pad, FilterType } from './types';

/**
 * A single playing note. Created per hit, disposed on end.
 *
 * Graph: source -> ampGain -> [EQ] -> filter -> panner -> destination
 */
export interface Voice {
  pad: number;
  bank: number;
  /** MIDI note this voice was triggered at (for per-note release). 60 = C4. */
  note?: number;
  muteGroup: number | null;
  startedAt: number;
  regionStart: number;
  regionEnd: number;
  loopStart: number;
  loop: boolean;
  effectiveRate: number;
  sampleRate: number;
  source: AudioBufferSourceNode;
  ampGain: GainNode;
  stop(when?: number): void;
  /** Immediate cut — used for mono drum retrigger. */
  kill(when?: number): void;
}

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

function cutoffHz(v: number): number {
  const n = Math.max(0, Math.min(127, v)) / 127;
  return 20 * Math.pow(1000, n);
}

function dbToGain(db: number): number {
  return db === -Infinity ? 0 : Math.pow(10, db / 20);
}

function eqGainDb(v: number): number {
  return Math.max(-12, Math.min(12, v));
}

export interface TriggerOptions {
  ctx: AudioContext;
  buffer: AudioBuffer;
  pad: Pad;
  padIndex: number;
  bankIndex: number;
  destination: AudioNode;
  when: number;
  velocity: number;
  slice?: { start: number; end: number };
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

  const detune = pad.semi * 100 + pad.fine;
  const rate = o.rate ?? 1;
  source.playbackRate.value = rate;
  if (detune !== 0) {
    source.playbackRate.value = rate * Math.pow(2, detune / 1200);
  }
  const effectiveRate = source.playbackRate.value;

  const ampGain = ctx.createGain();
  const panner = ctx.createStereoPanner();
  panner.pan.value = Math.max(-1, Math.min(1, pad.pan));

  let last: AudioNode = ampGain;

  if (pad.eqEnabled) {
    const low = ctx.createBiquadFilter();
    low.type = 'lowshelf';
    low.frequency.value = 200;
    low.gain.value = eqGainDb(pad.eqLow ?? 0);

    const mid = ctx.createBiquadFilter();
    mid.type = 'peaking';
    mid.frequency.value = 1000;
    mid.Q.value = 1;
    mid.gain.value = eqGainDb(pad.eqMid ?? 0);

    const high = ctx.createBiquadFilter();
    high.type = 'highshelf';
    high.frequency.value = 4000;
    high.gain.value = eqGainDb(pad.eqHigh ?? 0);

    ampGain.connect(low);
    low.connect(mid);
    mid.connect(high);
    last = high;
  }

  const fc = filterConfig(pad.filterType);
  let filter: BiquadFilterNode | null = null;
  if (fc) {
    filter = ctx.createBiquadFilter();
    filter.type = fc.biquad;
    filter.Q.value = fc.q + (pad.reso / 127) * 18;
    filter.frequency.value = cutoffHz(pad.cutoff);
    last.connect(filter);
    last = filter;
  }
  last.connect(panner);
  panner.connect(destination);
  source.connect(ampGain);

  const velScale = 1 - (pad.ampEnv.amount / 127) * (1 - velocity / 127);
  const peak = dbToGain(pad.gain) * Math.max(0, Math.min(1, velScale));

  const attack = envTime(pad.ampEnv.attack, 2);
  const decay = envTime(pad.ampEnv.decay, 6);
  const regionSeconds = (endFrame - startFrame) / sr / effectiveRate;

  const g = ampGain.gain;
  g.cancelScheduledValues(when);
  g.setValueAtTime(0, when);
  if (attack > 0.001) {
    g.linearRampToValueAtTime(peak, when + attack);
  } else {
    g.setValueAtTime(peak, when);
  }

  if (!pad.noteOn) {
    const decayStart =
      pad.ampEnv.decayFrom === 'start'
        ? when + attack
        : when + Math.max(attack, regionSeconds - decay);
    if (decay > 0.001) {
      g.setTargetAtTime(0, decayStart, Math.max(0.005, decay / 3));
    }
  }

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

  const startSec = startFrame / sr;
  const durSec = (endFrame - startFrame) / sr;
  const loopStartFrame = pad.loopStart || startFrame;

  if (pad.loop) {
    source.loop = true;
    source.loopStart = loopStartFrame / sr;
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
    regionStart: startFrame,
    regionEnd: endFrame,
    loopStart: loopStartFrame,
    loop: pad.loop,
    effectiveRate,
    sampleRate: sr,
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
    kill(at?: number) {
      const t = at ?? ctx.currentTime;
      try {
        g.cancelScheduledValues(t);
        g.setValueAtTime(0, t);
        source.stop(t);
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

/** Current frame position for a playing voice (for waveform playhead). */
export function voiceFrameAt(v: Voice, ctxTime: number): number {
  const elapsed = Math.max(0, ctxTime - v.startedAt);
  const framesPlayed = elapsed * v.sampleRate * v.effectiveRate;
  const regionLen = v.regionEnd - v.regionStart;

  if (v.loop && regionLen > 0) {
    const loopLen = v.regionEnd - v.loopStart;
    if (loopLen <= 0) return v.regionStart;
    const inLoop = framesPlayed % loopLen;
    return v.loopStart + inLoop;
  }

  const frame = v.regionStart + framesPlayed;
  return Math.min(v.regionEnd, frame);
}
