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

export function kick(ctx: SynthCtx, v: number, deep = false): SynthBuffer {
  const sr = ctx.sampleRate;
  const dur = deep ? 0.75 : 0.55;
  const len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const base = deep ? 55 : 120;
    const f = (base - v * 8) * Math.exp(-t * (deep ? 12 : 18)) + (deep ? 32 : 42);
    d[i] = Math.sin(2 * Math.PI * f * t) * Math.exp(-t * (deep ? 5 : 8 + v * 0.5));
  }
  env(d, sr, 0.002, deep ? 0.5 : 0.35);
  return buf;
}

export function snare(ctx: SynthCtx, v: number, tight = false): SynthBuffer {
  const sr = ctx.sampleRate;
  const dur = tight ? 0.22 : 0.35;
  const len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len);
  const n = noise(ctx, dur, v).getChannelData(0);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const tone = Math.sin(2 * Math.PI * (180 + v * 20) * t) * Math.exp(-t * 30);
    d[i] = n[i] * (tight ? 0.8 : 0.65) + tone * (tight ? 0.25 : 0.45);
  }
  env(d, sr, 0.001, tight ? 0.1 : 0.18);
  return buf;
}

export function hat(ctx: SynthCtx, v: number, open = false, metallic = false): SynthBuffer {
  const dur = open ? 0.28 : 0.06 + v * 0.008;
  const buf = noise(ctx, dur, v + 10);
  const d = buf.getChannelData(0);
  const sr = ctx.sampleRate;
  for (let i = 0; i < d.length; i++) {
    const t = i / sr;
    const mod = metallic ? Math.sin(t * 12000) : Math.sin(t * 8000);
    d[i] *= (0.3 + 0.7 * mod) * (open ? 0.5 : 0.35);
  }
  env(d, sr, 0.001, open ? 0.12 : 0.04);
  return buf;
}

export function clap(ctx: SynthCtx, v: number): SynthBuffer {
  const sr = ctx.sampleRate;
  const dur = 0.22;
  const len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len);
  const d = buf.getChannelData(0);
  for (let b = 0; b < 3; b++) {
    const off = Math.floor(sr * 0.012 * b);
    const n = noise(ctx, dur * 0.5, v + b).getChannelData(0);
    for (let i = off; i < len; i++) d[i] += n[i - off] * 0.4;
  }
  env(d, sr, 0.001, 0.1);
  return buf;
}

export function tom(ctx: SynthCtx, v: number): SynthBuffer {
  const sr = ctx.sampleRate;
  const dur = 0.4;
  const len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len);
  const d = buf.getChannelData(0);
  const base = 90 + v * 35;
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    d[i] = Math.sin(2 * Math.PI * base * Math.exp(-t * 6) * t) * Math.exp(-t * 5);
  }
  env(d, sr, 0.002, 0.25);
  return buf;
}

export function rim(ctx: SynthCtx, v: number): SynthBuffer {
  const buf = noise(ctx, 0.05, v + 50);
  env(buf.getChannelData(0), ctx.sampleRate, 0.001, 0.02);
  return buf;
}

export function shaker(ctx: SynthCtx, v: number): SynthBuffer {
  const buf = noise(ctx, 0.15 + v * 0.01, v + 20);
  const d = buf.getChannelData(0);
  const sr = ctx.sampleRate;
  for (let i = 0; i < d.length; i++) {
    d[i] *= 0.2 + 0.8 * Math.abs(Math.sin(i / sr * 40));
  }
  env(d, sr, 0.002, 0.08);
  return buf;
}

export function bass808(ctx: SynthCtx, note: number, v = 0): SynthBuffer {
  const sr = ctx.sampleRate;
  const dur = 1.2;
  const len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len);
  const d = buf.getChannelData(0);
  const hz = 440 * Math.pow(2, (note - 69) / 12);
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const pitch = hz * (1 + (0.4 + v * 0.02) * Math.exp(-t * 8));
    d[i] = Math.sin(2 * Math.PI * pitch * t) * Math.exp(-t * 1.8);
  }
  env(d, sr, 0.005, 0.9);
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
const STAB_NOTES = [48, 50, 52, 53, 55, 57, 59, 60, 62, 64, 65, 67, 69, 71, 72, 74];
/** Two-octave melodic map for keys, pads, leads (C4–D5). */
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
  const dur = 2.2;
  const len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len);
  const d = buf.getChannelData(0);
  const hz = noteHz(note);
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const det = 1 + Math.sin(t * 0.7 + v) * 0.004;
    const s = Math.sin(2 * Math.PI * hz * det * t)
      + Math.sin(2 * Math.PI * hz * 1.01 * t) * 0.5
      + Math.sin(2 * Math.PI * hz * 0.99 * t) * 0.5;
    d[i] = s * Math.min(1, t * 2) * Math.exp(-t * 0.35);
  }
  env(d, sr, 0.08, 1.2);
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

function synthChord(ctx: SynthCtx, root: number, v: number): SynthBuffer {
  const sr = ctx.sampleRate;
  const dur = 0.9;
  const len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len);
  const d = buf.getChannelData(0);
  const roots = [root, root + 4, root + 7].map(noteHz);
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    let s = 0;
    for (const hz of roots) {
      s += Math.sin(2 * Math.PI * hz * t);
    }
    d[i] = (s / 3) * Math.exp(-t * (1.8 + v * 0.03));
  }
  env(d, sr, 0.01, 0.45);
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
  const dur = 1.6;
  const len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len);
  const d = buf.getChannelData(0);
  const hz = noteHz(note);
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const ph = hz * t;
    const saw = 2 * (ph - Math.floor(ph + 0.5)) - 1;
    d[i] = saw * Math.min(1, t * 3) * Math.exp(-t * (0.5 + v * 0.02)) * 0.6;
  }
  env(d, sr, 0.12, 0.9);
  return buf;
}

function synthOrgan(ctx: SynthCtx, note: number, v: number): SynthBuffer {
  const sr = ctx.sampleRate;
  const dur = 1.4;
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
    d[i] = s * Math.exp(-t * (0.8 + v * 0.02));
  }
  env(d, sr, 0.02, 0.7);
  return buf;
}

/** Build 16-pad generator list for a template + kit variant offset. */
export function recipeForTemplate(template: string, kitVariant: number): Gen[] {
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
      return STAB_NOTES.map((n, i) => (c, v) => synthStab(c, n + o, i + v));
    case 'plucks':
      return STAB_NOTES.map((n, i) => (c, v) => {
        const b = synthStab(c, n + o, i + v);
        const d = b.getChannelData(0);
        for (let j = 0; j < d.length; j++) d[j] *= Math.exp(-j / b.sampleRate * 12);
        return b;
      });
    case 'keys':
      return MELODIC_NOTES.map((n, i) => (c, v) => synthKeys(c, n + o, i + v));
    case 'pads':
      return MELODIC_NOTES.map((n, i) => (c, v) => synthPad(c, n + o, i + v));
    case 'leads':
      return MELODIC_NOTES.map((n, i) => (c, v) => synthLead(c, n + o, i + v));
    case 'chords':
      return STAB_NOTES.map((n, i) => (c, v) => synthChord(c, n + o, i + v));
    case 'bells':
      return MELODIC_NOTES.map((n, i) => (c, v) => synthBell(c, n + o, i + v));
    case 'arp':
      return MELODIC_NOTES.map((n, i) => (c, v) => synthArp(c, n + o, i + v));
    case 'strings':
      return MELODIC_NOTES.map((n, i) => (c, v) => synthStrings(c, n + o, i + v));
    case 'organ':
      return MELODIC_NOTES.map((n, i) => (c, v) => synthOrgan(c, n + o, i + v));
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
