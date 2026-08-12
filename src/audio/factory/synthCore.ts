/** Portable synthesis — works in browser (AudioContext) and Node (build script). */

export interface SynthBuffer {
  sampleRate: number;
  length: number;
  numberOfChannels: number;
  getChannelData(ch: number): Float32Array;
}

export interface SynthCtx {
  sampleRate: number;
  createBuffer(channels: number, length: number): SynthBuffer;
}

export function browserSynthCtx(ctx: AudioContext): SynthCtx {
  return {
    sampleRate: ctx.sampleRate,
    createBuffer: (ch, len) => ctx.createBuffer(ch, len, ctx.sampleRate),
  };
}

export function nodeSynthCtx(sampleRate = 44100): SynthCtx {
  return {
    sampleRate,
    createBuffer(channels, length) {
      const chans = Array.from({ length: channels }, () => new Float32Array(length));
      return {
        sampleRate,
        length,
        numberOfChannels: channels,
        getChannelData(i) { return chans[i]; },
      };
    },
  };
}

function env(data: Float32Array, sr: number, attack: number, decay: number) {
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    data[i] *= Math.min(1, t / attack) * Math.exp(-t / decay);
  }
}

function noise(ctx: SynthCtx, dur: number, variant: number): SynthBuffer {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len);
  const d = buf.getChannelData(0);
  let seed = 1000 + variant * 137;
  for (let i = 0; i < len; i++) {
    seed = (seed * 16807 + 7) % 2147483647;
    d[i] = (seed / 1073741823.5 - 1) * 0.5;
  }
  return buf;
}

// ─── DSP helpers (portable, operate on raw Float32Array) ─────────────────────

/** tanh soft-clip for punch/harmonics. amount 0..1. */
function saturate(d: Float32Array, amount: number) {
  if (amount <= 0) return;
  const k = 1 + amount * 6;
  const norm = 1 / Math.tanh(k);
  for (let i = 0; i < d.length; i++) d[i] = Math.tanh(d[i] * k) * norm;
}

/** One-pole high-pass. */
function highpass(d: Float32Array, sr: number, fc: number) {
  const rc = 1 / (2 * Math.PI * fc);
  const a = rc / (rc + 1 / sr);
  let prevX = 0, prevY = 0;
  for (let i = 0; i < d.length; i++) {
    const x = d[i];
    const y = a * (prevY + x - prevX);
    prevX = x; prevY = y; d[i] = y;
  }
}

/** Resonant band-pass (biquad, constant skirt). fc Hz, q resonance. */
function bandpass(d: Float32Array, sr: number, fc: number, q: number) {
  const w = 2 * Math.PI * fc / sr;
  const alpha = Math.sin(w) / (2 * q);
  const cw = Math.cos(w);
  const b0 = alpha, b1 = 0, b2 = -alpha;
  const a0 = 1 + alpha, a1 = -2 * cw, a2 = 1 - alpha;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < d.length; i++) {
    const x = d[i];
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x; y2 = y1; y1 = y; d[i] = y;
  }
}

function rng(seed: number) {
  let s = (seed | 0) || 1;
  return () => { s = (s * 16807 + 7) % 2147483647; return s / 1073741823.5 - 1; };
}

/** Peak-normalize to `peak`. */
function normalize(d: Float32Array, peak = 0.95) {
  let m = 0;
  for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > m) m = a; }
  if (m > 1e-6) { const g = peak / m; for (let i = 0; i < d.length; i++) d[i] *= g; }
}

const semi = (n: number) => Math.pow(2, n / 12);

/**
 * Per-genre drum character. `kickModel`/`snareModel`/`hatMetallic` pick the
 * synthesis flavour; tune/drive/decay/tone/snap continuously shape it so kits
 * (and variants within a genre) sound distinct.
 */
export interface DrumChar {
  tune: number;   // semitone tuning offset (kick/snare/tom/808)
  drive: number;  // 0..1 saturation
  decay: number;  // 0.6..1.6 decay multiplier
  tone: number;   // 0..1 brightness (hats/snare noise)
  snap: number;   // 0..1 transient amount
  kickModel: 'sub808' | 'punch909' | 'acoustic' | 'boom';
  snareModel: '909' | 'acoustic' | 'trap' | 'clap';
  hatMetallic: boolean;
}

const NEUTRAL: DrumChar = {
  tune: 0, drive: 0.2, decay: 1, tone: 0.5, snap: 0.5,
  kickModel: 'punch909', snareModel: '909', hatMetallic: true,
};

export function kick(ctx: SynthCtx, v: number, deep = false, char: DrumChar = NEUTRAL): SynthBuffer {
  const sr = ctx.sampleRate;
  const model = char !== NEUTRAL ? char.kickModel : (deep ? 'sub808' : 'punch909');
  let startF = 200, endF = 55, pDecay = 42, bDecay = 7, dur = 0.45, click = 0.5;
  if (model === 'sub808') { startF = 130; endF = 44; pDecay = 24; bDecay = 3.0; dur = 0.95; click = 0.25; }
  else if (model === 'acoustic') { startF = 230; endF = 72; pDecay = 60; bDecay = 10; dur = 0.32; click = 0.8; }
  else if (model === 'boom') { startF = 170; endF = 50; pDecay = 30; bDecay = 5; dur = 0.6; click = 0.45; }
  const tm = semi(char.tune);
  startF *= tm; endF *= tm;
  dur *= char.decay;
  const len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len);
  const d = buf.getChannelData(0);
  let phase = 0;
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const f = endF + (startF - endF) * Math.exp(-t * pDecay);
    phase += (2 * Math.PI * f) / sr;
    const body = Math.sin(phase) * Math.exp(-t * bDecay);
    const sub = Math.sin(2 * Math.PI * endF * t) * Math.exp(-t * bDecay * 0.5) * 0.45;
    d[i] = body * 0.9 + sub;
  }
  // Beater click: a few ms of high-passed noise for attack definition.
  const clickLen = Math.min(len, Math.floor(sr * 0.007));
  const nr = rng(3 + v * 7);
  const cb = new Float32Array(clickLen);
  for (let i = 0; i < clickLen; i++) cb[i] = nr();
  highpass(cb, sr, 2200);
  for (let i = 0; i < clickLen; i++) d[i] += cb[i] * Math.exp(-(i / sr) * 320) * click * (0.5 + char.snap) * 1.3;
  saturate(d, char.drive + (model === 'sub808' ? 0.15 : 0));
  env(d, sr, 0.0009, 999); // de-click attack only
  normalize(d, 0.97);
  return buf;
}

export function snare(ctx: SynthCtx, v: number, tight = false, char: DrumChar = NEUTRAL): SynthBuffer {
  const sr = ctx.sampleRate;
  const model = char !== NEUTRAL ? char.snareModel : (tight ? 'trap' : '909');
  const dur = (model === 'trap' ? 0.2 : model === 'acoustic' ? 0.34 : 0.26) * char.decay;
  const len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len);
  const d = buf.getChannelData(0);
  const tm = semi(char.tune);
  const f1 = 180 * tm, f2 = 250 * tm;
  const bodyMix = model === 'acoustic' ? 0.6 : model === 'clap' ? 0.15 : 0.4;
  const noiseMix = model === 'acoustic' ? 0.55 : 0.8;
  const bodyDecay = tight ? 34 : 26;
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const tone = (Math.sin(2 * Math.PI * f1 * t) + Math.sin(2 * Math.PI * f2 * t) * 0.6) * Math.exp(-t * bodyDecay);
    d[i] = tone * bodyMix;
  }
  // Band-passed noise layer for the "wire" rattle.
  const nb = noise(ctx, dur, v + 11).getChannelData(0).slice();
  bandpass(nb, sr, 1400 + char.tone * 3200, 1.2);
  const nDecay = model === 'trap' ? 40 : model === 'acoustic' ? 18 : 26;
  for (let i = 0; i < len; i++) d[i] += nb[i] * noiseMix * Math.exp(-(i / sr) * nDecay);
  // Bright snap transient.
  const snapLen = Math.min(len, Math.floor(sr * 0.004));
  const sr2 = rng(90 + v);
  const snb = new Float32Array(snapLen);
  for (let i = 0; i < snapLen; i++) snb[i] = sr2();
  highpass(snb, sr, 5000);
  for (let i = 0; i < snapLen; i++) d[i] += snb[i] * Math.exp(-(i / sr) * 600) * char.snap;
  saturate(d, char.drive);
  env(d, sr, 0.0006, 999);
  normalize(d, 0.95);
  return buf;
}

/** Metallic hat/cymbal from detuned square oscillators through a high-pass. */
function metalTone(ctx: SynthCtx, dur: number, baseHz: number, hpHz: number, decayRate: number): SynthBuffer {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len);
  const d = buf.getChannelData(0);
  const ratios = [1, 1.34, 1.5, 1.81, 2.0, 2.67];
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    let s = 0;
    for (const r of ratios) s += Math.sign(Math.sin(2 * Math.PI * baseHz * r * t));
    d[i] = (s / ratios.length) * Math.exp(-t * decayRate);
  }
  highpass(d, sr, hpHz);
  return buf;
}

export function hat(ctx: SynthCtx, v: number, open = false, metallic = false, char: DrumChar = NEUTRAL): SynthBuffer {
  const sr = ctx.sampleRate;
  const useMetal = char !== NEUTRAL ? char.hatMetallic : (metallic || !open);
  const dur = (open ? 0.32 : 0.06) * char.decay;
  const hp = 6000 + char.tone * 4500;
  let buf: SynthBuffer;
  if (useMetal) {
    buf = metalTone(ctx, dur, 320 * semi(char.tune * 0.5), hp, open ? 9 : 34);
  } else {
    buf = noise(ctx, dur, v + 10);
    const d = buf.getChannelData(0);
    highpass(d, sr, hp * 0.7);
  }
  const d = buf.getChannelData(0);
  env(d, sr, 0.0004, open ? 0.1 * char.decay : 0.02 * char.decay);
  normalize(d, open ? 0.7 : 0.6);
  return buf;
}

export function clap(ctx: SynthCtx, v: number, char: DrumChar = NEUTRAL): SynthBuffer {
  const sr = ctx.sampleRate;
  const dur = 0.24 * char.decay;
  const len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len);
  const d = buf.getChannelData(0);
  // Three tight bursts (diffusion) then a short decaying tail.
  const offs = [0, 0.009, 0.019];
  for (let b = 0; b < offs.length; b++) {
    const off = Math.floor(sr * offs[b]);
    const nr = rng(v * 5 + b * 31 + 7);
    for (let i = off; i < len; i++) {
      const t = (i - off) / sr;
      if (t < 0.02) d[i] += nr() * (1 - t / 0.02) * 0.7;
    }
  }
  // tail
  const nr = rng(v * 3 + 99);
  for (let i = 0; i < len; i++) { const t = i / sr; d[i] += nr() * Math.exp(-t * 22) * 0.3; }
  bandpass(d, sr, 1100 + char.tone * 1400, 1.1);
  saturate(d, char.drive * 0.5);
  env(d, sr, 0.0006, 999);
  normalize(d, 0.9);
  return buf;
}

export function tom(ctx: SynthCtx, v: number, char: DrumChar = NEUTRAL): SynthBuffer {
  const sr = ctx.sampleRate;
  const dur = 0.4 * char.decay;
  const len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len);
  const d = buf.getChannelData(0);
  const startF = (95 + v * 34) * semi(char.tune);
  let phase = 0;
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const f = startF * (0.6 + 0.4 * Math.exp(-t * 8));
    phase += (2 * Math.PI * f) / sr;
    d[i] = Math.sin(phase) * Math.exp(-t * 6);
  }
  saturate(d, char.drive * 0.6);
  env(d, sr, 0.001, 999);
  normalize(d, 0.9);
  return buf;
}

export function rim(ctx: SynthCtx, v: number, char: DrumChar = NEUTRAL): SynthBuffer {
  const sr = ctx.sampleRate;
  const dur = 0.05;
  const buf = ctx.createBuffer(1, Math.floor(sr * dur));
  const d = buf.getChannelData(0);
  const nr = rng(v + 51);
  const toneHz = 1700 * semi(char.tune * 0.5);
  for (let i = 0; i < d.length; i++) {
    const t = i / sr;
    d[i] = (Math.sin(2 * Math.PI * toneHz * t) * 0.6 + nr() * 0.4) * Math.exp(-t * 220);
  }
  highpass(d, sr, 1200 + char.tone * 800);
  env(d, sr, 0.0004, 999);
  normalize(d, 0.85);
  return buf;
}

export function shaker(ctx: SynthCtx, v: number, char: DrumChar = NEUTRAL): SynthBuffer {
  const sr = ctx.sampleRate;
  const buf = noise(ctx, 0.14, v + 20);
  const d = buf.getChannelData(0);
  highpass(d, sr, 5000 + char.tone * 3000);
  for (let i = 0; i < d.length; i++) d[i] *= 0.25 + 0.75 * Math.abs(Math.sin((i / sr) * 45));
  env(d, sr, 0.003, 0.06);
  normalize(d, 0.6);
  return buf;
}

/** Long metallic crash cymbal. */
export function crash(ctx: SynthCtx, v: number, char: DrumChar = NEUTRAL): SynthBuffer {
  const buf = metalTone(ctx, 1.3 * char.decay, 300, 5000 + char.tone * 3000, 3.2);
  const d = buf.getChannelData(0);
  const nr = rng(v + 200);
  for (let i = 0; i < d.length; i++) d[i] = d[i] * 0.7 + nr() * Math.exp(-(i / ctx.sampleRate) * 4) * 0.3;
  highpass(d, ctx.sampleRate, 5500);
  env(d, ctx.sampleRate, 0.001, 999);
  normalize(d, 0.75);
  return buf;
}

export function bass808(ctx: SynthCtx, note: number, v = 0, char: DrumChar = NEUTRAL): SynthBuffer {
  const sr = ctx.sampleRate;
  const dur = 1.3 * char.decay;
  const len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len);
  const d = buf.getChannelData(0);
  const hz = 440 * Math.pow(2, (note - 69) / 12) * semi(char.tune);
  let phase = 0;
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    // Short pitch glide into the note, then a long sustained sub.
    const f = hz * (1 + (0.35 + v * 0.015) * Math.exp(-t * 9));
    phase += (2 * Math.PI * f) / sr;
    d[i] = Math.sin(phase) * Math.exp(-t * 1.6);
  }
  // Drive adds the harmonics that make an 808 audible on small speakers.
  saturate(d, 0.35 + char.drive * 0.4);
  env(d, sr, 0.004, 999);
  normalize(d, 0.95);
  return buf;
}

export function toneHit(ctx: SynthCtx, hz: number, dur: number, v: number): SynthBuffer {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const f = hz * (1 + v * 0.02 * Math.exp(-t * 10));
    d[i] = Math.sin(2 * Math.PI * f * t) * Math.exp(-t * (4 + v * 0.3));
  }
  env(d, sr, 0.001, dur * 0.6);
  return buf;
}

export function synthStab(ctx: SynthCtx, root: number, v: number): SynthBuffer {
  const sr = ctx.sampleRate;
  const dur = 0.35;
  const len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len);
  const d = buf.getChannelData(0);
  const hz = 440 * Math.pow(2, (root - 69) / 12);
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const s = Math.sin(2 * Math.PI * hz * t)
      + Math.sin(2 * Math.PI * hz * 1.25 * t) * 0.5
      + Math.sin(2 * Math.PI * hz * 1.5 * t) * 0.35;
    d[i] = s * Math.exp(-t * (6 + v * 0.2));
  }
  env(d, sr, 0.003, 0.2);
  return buf;
}

export function riser(ctx: SynthCtx, v: number): SynthBuffer {
  const sr = ctx.sampleRate;
  const dur = 1.5;
  const len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len);
  const n = noise(ctx, dur, v).getChannelData(0);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const sweep = Math.sin(2 * Math.PI * (200 + t * 2000 + v * 50) * t);
    d[i] = (n[i] * 0.4 + sweep * 0.3) * Math.min(1, t * 3);
  }
  env(d, sr, 0.05, 0.4);
  return buf;
}

export function impact(ctx: SynthCtx, v: number): SynthBuffer {
  const sr = ctx.sampleRate;
  const dur = 0.8;
  const len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len);
  const n = noise(ctx, dur, v).getChannelData(0);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    d[i] = n[i] * Math.exp(-t * (8 + v * 0.5))
      + Math.sin(2 * Math.PI * 60 * t) * Math.exp(-t * 4) * 0.6;
  }
  env(d, sr, 0.001, 0.5);
  return buf;
}

function vinylCrackle(ctx: SynthCtx, v: number): SynthBuffer {
  const buf = noise(ctx, 0.4, v + 99);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    if ((i * 17 + v) % 997 === 0) d[i] *= 3;
    d[i] *= 0.08;
  }
  env(d, ctx.sampleRate, 0.01, 0.3);
  return buf;
}

export type Gen = (ctx: SynthCtx, variant: number) => SynthBuffer;

const BASS_NOTES = [36, 38, 40, 41, 43, 45, 47, 48, 50, 52, 53, 55, 57, 59, 60, 62];
/** Two-octave melodic map for keys, pads, leads (C4–D6). */
const MELODIC_NOTES = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81, 83, 84, 86];

function noteHz(n: number): number {
  return 440 * Math.pow(2, (n - 69) / 12);
}

function synthKeys(ctx: SynthCtx, note: number, v: number): SynthBuffer {
  const sr = ctx.sampleRate;
  const dur = 0.55;
  const len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len);
  const d = buf.getChannelData(0);
  const hz = noteHz(note);
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const f = hz * (1 + 0.015 * Math.exp(-t * 20));
    d[i] = Math.sin(2 * Math.PI * f * t) * Math.exp(-t * (3.5 + v * 0.1))
      + Math.sin(2 * Math.PI * f * 2 * t) * 0.25 * Math.exp(-t * 5);
  }
  env(d, sr, 0.002, 0.35);
  return buf;
}

function synthPad(ctx: SynthCtx, note: number, v: number): SynthBuffer {
  const sr = ctx.sampleRate;
  const dur = 8.0;
  const len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len);
  const d = buf.getChannelData(0);
  const hz = noteHz(note);
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const det = 1 + Math.sin(t * 0.5 + v) * 0.005;
    const s = Math.sin(2 * Math.PI * hz * det * t)
      + Math.sin(2 * Math.PI * hz * 1.01 * t) * 0.5
      + Math.sin(2 * Math.PI * hz * 0.99 * t) * 0.5;
    d[i] = s * Math.min(1, t * 1.5) * Math.exp(-t * 0.22);
  }
  env(d, sr, 0.1, 1.8);
  return buf;
}

function synthLead(ctx: SynthCtx, note: number, v: number): SynthBuffer {
  const sr = ctx.sampleRate;
  const dur = 0.65;
  const len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len);
  const d = buf.getChannelData(0);
  const hz = noteHz(note);
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const vibrato = Math.sin(t * 6 + v) * 0.008;
    const f = hz * (1 + vibrato);
    const saw = 2 * (f * t % 1) - 1;
    d[i] = saw * Math.exp(-t * (2.5 + v * 0.05));
  }
  env(d, sr, 0.005, 0.25);
  return buf;
}

function synthChord(ctx: SynthCtx, root: number, v: number, minor = false): SynthBuffer {
  const sr = ctx.sampleRate;
  const dur = 2.4;
  const len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len);
  const d = buf.getChannelData(0);
  const third = minor ? 3 : 4;
  const roots = [root, root + third, root + 7].map(noteHz);
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    let s = 0;
    for (const hz of roots) {
      s += Math.sin(2 * Math.PI * hz * t);
    }
    d[i] = (s / 3) * Math.exp(-t * (1.6 + v * 0.03));
  }
  env(d, sr, 0.008, 0.55);
  return buf;
}

function synthBell(ctx: SynthCtx, note: number, v: number): SynthBuffer {
  const sr = ctx.sampleRate;
  const dur = 1.8;
  const len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len);
  const d = buf.getChannelData(0);
  const hz = noteHz(note);
  const partials = [1, 2.4, 3.5, 5.1];
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    let s = 0;
    for (let p = 0; p < partials.length; p++) {
      s += Math.sin(2 * Math.PI * hz * partials[p] * t) * (1 / (p + 1));
    }
    d[i] = s * Math.exp(-t * (1.2 + v * 0.04));
  }
  env(d, sr, 0.001, 0.8);
  return buf;
}

function synthArp(ctx: SynthCtx, note: number, v: number): SynthBuffer {
  const sr = ctx.sampleRate;
  const dur = 0.18;
  const len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len);
  const d = buf.getChannelData(0);
  const hz = noteHz(note);
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    d[i] = Math.sin(2 * Math.PI * hz * t) * Math.exp(-t * (10 + v * 0.5));
  }
  env(d, sr, 0.001, 0.08);
  return buf;
}

function synthStrings(ctx: SynthCtx, note: number, v: number): SynthBuffer {
  const sr = ctx.sampleRate;
  const dur = 8.0;
  const len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len);
  const d = buf.getChannelData(0);
  const hz = noteHz(note);
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const ph = hz * t;
    const saw = 2 * (ph - Math.floor(ph + 0.5)) - 1;
    d[i] = saw * Math.min(1, t * 2.5) * Math.exp(-t * (0.35 + v * 0.015)) * 0.55;
  }
  env(d, sr, 0.15, 1.4);
  return buf;
}

function synthOrgan(ctx: SynthCtx, note: number, v: number): SynthBuffer {
  const sr = ctx.sampleRate;
  const dur = 6.0;
  const len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len);
  const d = buf.getChannelData(0);
  const hz = noteHz(note);
  const harmonics = [1, 2, 3, 4, 6];
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    let s = 0;
    for (const h of harmonics) {
      s += Math.sin(2 * Math.PI * hz * h * t) / h;
    }
    d[i] = s * Math.exp(-t * (0.55 + v * 0.015));
  }
  env(d, sr, 0.03, 1.1);
  return buf;
}

function synthFlute(ctx: SynthCtx, note: number, v: number): SynthBuffer {
  const sr = ctx.sampleRate;
  const dur = 0.85;
  const len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len);
  const d = buf.getChannelData(0);
  const hz = noteHz(note);
  const n = noise(ctx, dur, v + 40).getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const vibrato = Math.sin(t * 5 + v) * 0.006;
    const f = hz * (1 + vibrato);
    d[i] = (Math.sin(2 * Math.PI * f * t) * 0.75 + n[i] * 0.08) * Math.exp(-t * (1.8 + v * 0.04));
  }
  env(d, sr, 0.04, 0.45);
  return buf;
}

function synthBrass(ctx: SynthCtx, note: number, v: number): SynthBuffer {
  const sr = ctx.sampleRate;
  const dur = 0.55;
  const len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len);
  const d = buf.getChannelData(0);
  const hz = noteHz(note);
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const ph = hz * t;
    const saw = 2 * (ph - Math.floor(ph + 0.5)) - 1;
    const sq = saw >= 0 ? 0.6 : -0.6;
    d[i] = (saw * 0.55 + sq * 0.45) * Math.exp(-t * (3.5 + v * 0.08));
  }
  env(d, sr, 0.006, 0.22);
  return buf;
}

function synthAmbient(ctx: SynthCtx, note: number, v: number): SynthBuffer {
  const sr = ctx.sampleRate;
  const dur = 10.0;
  const len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len);
  const d = buf.getChannelData(0);
  const hz = noteHz(note);
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const lfo = Math.sin(t * (0.3 + v * 0.02)) * 0.012;
    const f = hz * (1 + lfo);
    const s = Math.sin(2 * Math.PI * f * t)
      + Math.sin(2 * Math.PI * f * 1.5 * t) * 0.35
      + Math.sin(2 * Math.PI * f * 0.5 * t) * 0.25;
    d[i] = s * Math.min(1, t * 0.8) * Math.exp(-t * 0.15);
  }
  env(d, sr, 0.2, 2.5);
  return buf;
}

function synthPluck(ctx: SynthCtx, note: number, v: number): SynthBuffer {
  const sr = ctx.sampleRate;
  const dur = 0.45;
  const len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len);
  const d = buf.getChannelData(0);
  const hz = noteHz(note);
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const s = Math.sin(2 * Math.PI * hz * t)
      + Math.sin(2 * Math.PI * hz * 2 * t) * 0.3;
    d[i] = s * Math.exp(-t * (8 + v * 0.4));
  }
  env(d, sr, 0.001, 0.12);
  return buf;
}

// ─── Genre character + standard drum-kit builder ─────────────────────────────

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const tweak = (c: DrumChar, p: Partial<DrumChar>): DrumChar => ({ ...c, ...p });

/** Distinct character per drum genre — this is what makes kits sound different. */
const GENRE_CHAR: Record<string, DrumChar> = {
  trap:     { tune: -2, drive: 0.50, decay: 1.25, tone: 0.72, snap: 0.7, kickModel: 'sub808',  snareModel: 'trap',     hatMetallic: true },
  boombap:  { tune: -1, drive: 0.55, decay: 1.00, tone: 0.32, snap: 0.5, kickModel: 'boom',    snareModel: 'acoustic', hatMetallic: false },
  house:    { tune:  0, drive: 0.30, decay: 0.90, tone: 0.55, snap: 0.6, kickModel: 'punch909', snareModel: '909',      hatMetallic: true },
  techno:   { tune:  0, drive: 0.62, decay: 0.85, tone: 0.60, snap: 0.65, kickModel: 'punch909', snareModel: '909',     hatMetallic: true },
  lofi:     { tune: -2, drive: 0.40, decay: 1.18, tone: 0.20, snap: 0.35, kickModel: 'boom',    snareModel: 'acoustic', hatMetallic: false },
  acoustic: { tune:  0, drive: 0.15, decay: 1.10, tone: 0.45, snap: 0.6, kickModel: 'acoustic', snareModel: 'acoustic', hatMetallic: false },
  dnb:      { tune: -1, drive: 0.52, decay: 0.80, tone: 0.78, snap: 0.78, kickModel: 'punch909', snareModel: '909',     hatMetallic: true },
  afro:     { tune:  1, drive: 0.35, decay: 0.95, tone: 0.60, snap: 0.6, kickModel: 'punch909', snareModel: 'trap',     hatMetallic: true },
};

/** Apply the kit variant as a meaningful modulation so kits within a genre differ. */
function charForGenre(genre: string, variant: number): DrumChar {
  const base = GENRE_CHAR[genre] ?? NEUTRAL;
  const k = variant - 2; // -2..+2 across the 5 variants
  return {
    ...base,
    tune: base.tune + k,
    drive: clamp01(base.drive + k * 0.08),
    decay: Math.max(0.6, Math.min(1.6, base.decay + k * 0.06)),
    tone: clamp01(base.tone + k * 0.06),
  };
}

/** 16 standard drum pads (matches catalog DRUM_PADS) for a given character. */
function drumKit(char: DrumChar): Gen[] {
  return [
    (c, v) => kick(c, v, false, char),
    (c, v) => kick(c, v + 2, false, tweak(char, { tune: char.tune - 3, decay: char.decay * 0.9 })),
    (c, v) => snare(c, v, false, char),
    (c, v) => snare(c, v + 1, true, tweak(char, { decay: char.decay * 0.8 })),
    (c, v) => hat(c, v, false, false, char),
    (c, v) => hat(c, v, true, false, char),
    (c, v) => hat(c, v, false, false, char),
    (c, v) => toneHit(c, 320 * semi(char.tune), 0.14, v),
    (c, v) => clap(c, v, char),
    (c, v) => clap(c, v + 3, char),
    (c) => tom(c, 0, char),
    (c) => tom(c, 1, char),
    (c) => tom(c, 2, char),
    (c) => tom(c, 3, char),
    (c, v) => rim(c, v, char),
    (c, v) => crash(c, v, char),
  ];
}

/** Build 16-pad generator list for a template + kit variant offset. */
export function recipeForTemplate(template: string, kitVariant: number): Gen[] {
  if (GENRE_CHAR[template]) return drumKit(charForGenre(template, kitVariant));
  const o = kitVariant * 4;
  switch (template) {
    case 'classic':
      return [
        (c, v) => kick(c, v + o), (c, v) => kick(c, v + o + 1), snare, snare,
        hat, hat, hat, (c, v) => hat(c, v, true),
        clap, clap, tom, tom, tom, tom, rim, hat,
      ];
    case 'lofi':
      return [
        (c, v) => kick(c, v + o + 3), kick, (c, v) => snare(c, v + o + 5), rim,
        (c, v) => hat(c, v + o + 2), (c, v) => hat(c, v, true), rim, hat,
        clap, snare, tom, tom, tom, kick, (c, v) => hat(c, v, true), rim,
      ];
    case 'trap':
      return [
        (c, v) => kick(c, v + o, true), (c, v) => kick(c, v + o + 2, true),
        (c, v) => snare(c, v, true), (c, v) => snare(c, v + 3, true),
        hat, hat, (c, v) => hat(c, v, false, true), (c, v) => hat(c, v, true),
        clap, rim, tom, tom, kick, hat, snare, rim,
      ];
    case 'house':
      return [
        kick, kick, clap, clap, hat, (c, v) => hat(c, v, true), shaker, rim,
        snare, (c, v) => toneHit(c, 800 + v * 20 + o * 10, 0.3, v),
        tom, tom, kick, hat, clap, rim,
      ];
    case 'techno':
      return [
        (c, v) => kick(c, v + o + 2), kick, clap, (c, v) => snare(c, v, true),
        (c, v) => hat(c, v, false, true), hat, (c, v) => hat(c, v, true),
        (c, v) => toneHit(c, 1200 + o * 50, 0.5, v),
        rim, (c, v) => toneHit(c, 300, 0.15, v), tom, tom, kick, impact, rim, hat,
      ];
    case 'vinyl':
      return [
        (c, v) => kick(c, v + o + 4), kick, snare, snare,
        hat, (c, v) => hat(c, v, true), shaker, rim,
        clap, tom, tom, tom, vinylCrackle, hat, snare, rim,
      ];
    case 'boom':
      return [
        (c, v) => kick(c, v + o), (c, v) => kick(c, v + o + 2), snare, (c, v) => snare(c, v + 4),
        hat, hat, (c, v) => hat(c, v, true), rim,
        clap, (c, v) => toneHit(c, 400 + o * 20, 0.2, v), tom, tom, kick, rim, snare, hat,
      ];
    case 'dnb':
      return [
        (c, v) => kick(c, v + o, true), snare, (c, v) => snare(c, v + 2, true), rim,
        (c, v) => hat(c, v, false, true), hat, hat, (c, v) => hat(c, v, true),
        clap, tom, (c, v) => toneHit(c, 600 + o * 30, 0.15, v), tom, kick, hat, snare, impact,
      ];
    case 'electro':
      return [
        (c, v) => kick(c, v + o + 1), kick, clap, (c, v) => snare(c, v, true),
        (c, v) => hat(c, v, false, true), (c, v) => hat(c, v + 2, false, true),
        (c, v) => toneHit(c, 1500 + o * 40, 0.08, v), hat,
        rim, tom, (c, v) => toneHit(c, 200, 0.3, v), kick, hat, clap, snare, impact,
      ];
    case 'breakbeat':
      return [
        kick, (c, v) => snare(c, v + o), kick, snare,
        hat, hat, (c, v) => hat(c, v, true), rim,
        clap, tom, snare, hat, kick, tom, rim, (c, v) => toneHit(c, 700, 0.2, v),
      ];
    case 'industrial':
      return [
        (c, v) => kick(c, v + o + 3, true), kick, (c, v) => snare(c, v + 2, true), impact,
        (c, v) => hat(c, v, false, true), (c, v) => hat(c, v + 4, false, true),
        (c, v) => toneHit(c, 900 + o * 60, 0.12, v), rim,
        clap, (c, v) => toneHit(c, 200, 0.25, v), tom, kick, hat, snare, impact, rim,
      ];
    case '808':
      return BASS_NOTES.map((n) => (c, v) => bass808(c, n, v + o));
    case 'sub':
      return BASS_NOTES.map((n) => (c, v) => bass808(c, n - 12, v + o));
    case 'acid':
      return BASS_NOTES.map((n, i) => (c, v) => {
        const buf = bass808(c, n, v + o);
        const d = buf.getChannelData(0);
        for (let j = 0; j < d.length; j++) {
          d[j] = Math.tanh(d[j] * (2 + i * 0.1 + o * 0.05));
        }
        return buf;
      });
    case 'fm':
      return BASS_NOTES.map((n, i) => (c, _v) => {
        const sr = c.sampleRate;
        const len = Math.floor(sr * 0.8);
        const buf = c.createBuffer(1, len);
        const d = buf.getChannelData(0);
        const hz = 440 * Math.pow(2, (n - 69) / 12);
        for (let j = 0; j < len; j++) {
          const t = j / sr;
          const mod = Math.sin(2 * Math.PI * hz * 2 * t) * (0.5 + i * 0.02);
          d[j] = Math.sin(2 * Math.PI * hz * t + mod + o * 0.1) * Math.exp(-t * 2);
        }
        env(d, sr, 0.002, 0.5);
        return buf;
      });
    case 'world':
      return [
        (c, v) => toneHit(c, 180 + v * 5 + o * 8, 0.25, v),
        (c, v) => toneHit(c, 280 + v * 8 + o * 10, 0.2, v),
        (c, v) => toneHit(c, 350 + o * 12, 0.18, v), tom,
        shaker, (c, v) => toneHit(c, 600 + v * 10, 0.12, v),
        (c, v) => toneHit(c, 900, 0.08, v), rim,
        clap, (c, v) => toneHit(c, 500, 0.1, v), (c, v) => toneHit(c, 2000, 0.15, v),
        tom, kick, rim, snare, hat,
      ];
    case 'latin':
      return [
        (c, v) => toneHit(c, 220 + o * 15, 0.2, v), (c, v) => toneHit(c, 330 + o * 20, 0.18, v),
        clap, rim, shaker, (c, v) => toneHit(c, 800 + v * 12, 0.1, v),
        (c, v) => toneHit(c, 1200, 0.08, v), hat, tom, tom,
        (c, v) => toneHit(c, 450, 0.15, v), kick, snare, hat, clap, rim,
      ];
    case 'electronic-perc':
      return [
        (c, v) => toneHit(c, 400 + o * 30, 0.1, v), (c, v) => toneHit(c, 600 + o * 40, 0.08, v),
        rim, shaker, hat, (c, v) => toneHit(c, 1500, 0.06, v),
        clap, tom, impact, (c, v) => toneHit(c, 900, 0.12, v),
        kick, snare, hat, rim, (c, v) => toneHit(c, 2000 + o * 50, 0.05, v), clap,
      ];
    case 'stabs':
      return MELODIC_NOTES.map((n, i) => (c, v) => synthStab(c, n + o, i + v));
    case 'plucks':
      return MELODIC_NOTES.map((n, i) => (c, v) => synthPluck(c, n + o, i + v));
    case 'keys':
      return MELODIC_NOTES.map((n, i) => (c, v) => synthKeys(c, n + o, i + v));
    case 'pads':
      return MELODIC_NOTES.map((n, i) => (c, v) => synthPad(c, n + o, i + v));
    case 'leads':
      return MELODIC_NOTES.map((n, i) => (c, v) => synthLead(c, n + o, i + v));
    case 'chords':
      return MELODIC_NOTES.map((n, i) => (c, v) => synthChord(c, n + o, i + v));
    case 'minor':
      return MELODIC_NOTES.map((n, i) => (c, v) => synthChord(c, n + o, i + v, true));
    case 'bells':
      return MELODIC_NOTES.map((n, i) => (c, v) => synthBell(c, n + o, i + v));
    case 'flute':
      return MELODIC_NOTES.map((n, i) => (c, v) => synthFlute(c, n + o, i + v));
    case 'brass':
      return MELODIC_NOTES.map((n, i) => (c, v) => synthBrass(c, n + o, i + v));
    case 'arp':
      return MELODIC_NOTES.map((n, i) => (c, v) => synthArp(c, n + o, i + v));
    case 'strings':
      return MELODIC_NOTES.map((n, i) => (c, v) => synthStrings(c, n + o, i + v));
    case 'organ':
      return MELODIC_NOTES.map((n, i) => (c, v) => synthOrgan(c, n + o, i + v));
    case 'ambient':
      return MELODIC_NOTES.map((n, i) => (c, v) => synthAmbient(c, n + o, i + v));
    case 'fx':
      return [
        impact, (c, v) => impact(c, v + o + 3), riser, (c, v) => riser(c, v + o + 2),
        (c, v) => kick(c, v, true), (c, v) => riser(c, v + o + 5),
        (c, v) => toneHit(c, 800, 0.4, v), (c, v) => toneHit(c, 2000 + o * 100, 0.2, v),
        (c, v) => kick(c, v + 5, true), (c, v) => toneHit(c, 400 + o * 20, 0.6, v),
        (c, v) => riser(c, v + o + 8), (c, v) => impact(c, v + o + 6),
        (c, v) => toneHit(c, 3000 + o * 50, 0.1, v), (c, v) => toneHit(c, 1500 + o * 40, 0.15, v),
        (c, v) => impact(c, v + o + 4), (c, v) => toneHit(c, 3000 + o * 80, 0.1, v),
      ];
    default:
      return recipeForTemplate('classic', kitVariant);
  }
}

export function synthesizeKit(ctx: SynthCtx, template: string, kitVariant: number): SynthBuffer[] {
  const gens = recipeForTemplate(template, kitVariant);
  return gens.map((gen, i) => gen(ctx, i + kitVariant * 2));
}
