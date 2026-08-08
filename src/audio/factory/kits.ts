/**
 * Built-in starter kits — synthesized offline so no sample files are required.
 * Real WAV kits can be added later under public/factory/ with the same manifest.
 */

export interface FactoryKitMeta {
  id: string;
  name: string;
  category: 'drums' | 'bass' | 'mixed';
  description: string;
  /** 'procedural' = generated in-browser; 'files' = fetch from /factory/… */
  source: 'procedural' | 'files';
}

export const FACTORY_KITS: FactoryKitMeta[] = [
  {
    id: 'classic-drums',
    name: 'Classic Drums',
    category: 'drums',
    description: 'Kick, snare, hats, clap, toms — 16-pad kit',
    source: 'procedural',
  },
  {
    id: '808-bass',
    name: '808 Bass',
    category: 'bass',
    description: 'Sub bass tones across 16 pads (C1–D#2)',
    source: 'procedural',
  },
  {
    id: 'lofi-drums',
    name: 'Lo-Fi Drums',
    category: 'drums',
    description: 'Dusty kicks, rimshots, soft hats',
    source: 'procedural',
  },
];

type Gen = (ctx: AudioContext, variant: number) => AudioBuffer;

function env(data: Float32Array, sr: number, attack: number, decay: number) {
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    const a = Math.min(1, t / attack);
    const d = Math.exp(-t / decay);
    data[i] *= a * d;
  }
}

function noise(ctx: AudioContext, dur: number, variant: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  let seed = 1000 + variant * 137;
  for (let i = 0; i < len; i++) {
    seed = (seed * 16807 + 7) % 2147483647;
    d[i] = (seed / 1073741823.5 - 1) * 0.5;
  }
  return buf;
}

function kick(ctx: AudioContext, v: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const dur = 0.55;
  const len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const f = (120 - v * 8) * Math.exp(-t * 18) + 42;
    d[i] = Math.sin(2 * Math.PI * f * t) * Math.exp(-t * (8 + v * 0.5));
  }
  env(d, sr, 0.002, 0.35);
  return buf;
}

function snare(ctx: AudioContext, v: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const dur = 0.35;
  const len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len, sr);
  const n = noise(ctx, dur, v).getChannelData(0);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const tone = Math.sin(2 * Math.PI * (180 + v * 20) * t) * Math.exp(-t * 30);
    d[i] = n[i] * 0.65 + tone * 0.45;
  }
  env(d, sr, 0.001, 0.18);
  return buf;
}

function hat(ctx: AudioContext, v: number, open = false): AudioBuffer {
  const dur = open ? 0.28 : 0.06 + v * 0.008;
  const buf = noise(ctx, dur, v + 10);
  const d = buf.getChannelData(0);
  const sr = ctx.sampleRate;
  for (let i = 0; i < d.length; i++) {
    const t = i / sr;
    d[i] *= (0.3 + 0.7 * Math.sin(t * 8000)) * (open ? 0.5 : 0.35);
  }
  env(d, sr, 0.001, open ? 0.12 : 0.04);
  return buf;
}

function clap(ctx: AudioContext, v: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const dur = 0.22;
  const len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  for (let b = 0; b < 3; b++) {
    const off = Math.floor(sr * (0.012 * b));
    const n = noise(ctx, dur * 0.5, v + b).getChannelData(0);
    for (let i = off; i < len; i++) d[i] += n[i - off] * 0.4;
  }
  env(d, sr, 0.001, 0.1);
  return buf;
}

function tom(ctx: AudioContext, v: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const dur = 0.4;
  const len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  const base = 90 + v * 35;
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const f = base * Math.exp(-t * 6);
    d[i] = Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 5);
  }
  env(d, sr, 0.002, 0.25);
  return buf;
}

function rim(ctx: AudioContext, v: number): AudioBuffer {
  const buf = noise(ctx, 0.05, v + 50);
  const d = buf.getChannelData(0);
  env(d, ctx.sampleRate, 0.001, 0.02);
  return buf;
}

function bass808(ctx: AudioContext, note: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const dur = 1.2;
  const len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  const hz = 440 * Math.pow(2, (note - 69) / 12);
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const pitch = hz * (1 + 0.4 * Math.exp(-t * 8));
    d[i] = Math.sin(2 * Math.PI * pitch * t) * Math.exp(-t * 1.8);
  }
  env(d, sr, 0.005, 0.9);
  return buf;
}

const CLASSIC: Gen[] = [
  kick, kick, snare, snare, hat, hat, hat, hat,
  clap, clap, tom, tom, tom, tom, rim, hat,
];

const LOFI: Gen[] = [
  (c, v) => kick(c, v + 3),
  kick,
  (c, v) => snare(c, v + 5),
  rim,
  (c, v) => hat(c, v + 2),
  (c, v) => hat(c, v, true),
  rim,
  (c, v) => hat(c, v + 4),
  clap,
  (c, v) => snare(c, v + 8),
  (c, v) => tom(c, v + 1),
  (c, v) => tom(c, v + 3),
  (c, v) => tom(c, v + 5),
  kick,
  (c, v) => hat(c, v + 6, true),
  rim,
];

const BASS_NOTES = [36, 38, 40, 41, 43, 45, 47, 48, 50, 52, 53, 55, 57, 59, 60, 62];

export function generateFactoryKit(
  ctx: AudioContext,
  kitId: string,
): { id: string; name: string; buffers: AudioBuffer[] } | null {
  const meta = FACTORY_KITS.find((k) => k.id === kitId);
  if (!meta || meta.source !== 'procedural') return null;

  const buffers: AudioBuffer[] = [];
  if (kitId === 'classic-drums') {
    for (let i = 0; i < 16; i++) buffers.push(CLASSIC[i](ctx, i));
    return { id: kitId, name: meta.name, buffers };
  }
  if (kitId === 'lofi-drums') {
    for (let i = 0; i < 16; i++) buffers.push(LOFI[i](ctx, i));
    return { id: kitId, name: meta.name, buffers };
  }
  if (kitId === '808-bass') {
    for (let i = 0; i < 16; i++) buffers.push(bass808(ctx, BASS_NOTES[i]));
    return { id: kitId, name: meta.name, buffers };
  }
  return null;
}
