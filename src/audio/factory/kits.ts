/**
 * Built-in starter kits — synthesized offline so no sample files are required.
 */

export interface FactoryKitMeta {
  id: string;
  name: string;
  category: 'drums' | 'bass' | 'perc' | 'synth' | 'fx';
  description: string;
  source: 'procedural' | 'files';
  /** Short pad labels for the 16 pads. */
  padNames: string[];
  defaultGain?: number;
}

export const FACTORY_KITS: FactoryKitMeta[] = [
  {
    id: 'classic-drums',
    name: 'Classic Drums',
    category: 'drums',
    description: 'Kick, snare, hats, clap, toms',
    source: 'procedural',
    padNames: ['Kick', 'Kick 2', 'Snare', 'Snare 2', 'Hat', 'Hat O', 'Hat C', 'Hat C2',
      'Clap', 'Clap 2', 'Tom L', 'Tom M', 'Tom H', 'Tom HH', 'Rim', 'Hat L'],
  },
  {
    id: 'lofi-drums',
    name: 'Lo-Fi Drums',
    category: 'drums',
    description: 'Dusty kicks, rimshots, soft hats',
    source: 'procedural',
    padNames: ['Kick', 'Kick 2', 'Snare', 'Rim', 'Hat', 'Hat O', 'Rim 2', 'Hat 2',
      'Clap', 'Snare 2', 'Tom L', 'Tom M', 'Tom H', 'Kick 3', 'Hat O2', 'Rim 3'],
  },
  {
    id: 'trap-drums',
    name: 'Trap Drums',
    category: 'drums',
    description: '808 kick, snappy snare, trap hats',
    source: 'procedural',
    padNames: ['808', '808 2', 'Snare', 'Snare 2', 'Hat', 'Hat 2', 'Roll', 'Open',
      'Clap', 'Perc', 'Tom', 'Tom 2', 'Kick FX', 'Hat 3', 'Snare FX', 'Rim'],
  },
  {
    id: 'house-drums',
    name: 'House Drums',
    category: 'drums',
    description: 'Four-on-the-floor kick, claps, shakers',
    source: 'procedural',
    padNames: ['Kick', 'Kick 2', 'Clap', 'Clap 2', 'Hat', 'Hat O', 'Shaker', 'Perc',
      'Snare', 'Ride', 'Tom', 'Tom 2', 'Kick FX', 'Hat 2', 'Clap FX', 'Rim'],
  },
  {
    id: 'techno-drums',
    name: 'Techno Drums',
    category: 'drums',
    description: 'Punchy kick, metallic hats, industrial',
    source: 'procedural',
    padNames: ['Kick', 'Kick 2', 'Clap', 'Snare', 'Hat', 'Hat M', 'Hat O', 'Ride',
      'Perc', 'Perc 2', 'Tom', 'Tom 2', 'Kick FX', 'Noise', 'Rim', 'Crash'],
  },
  {
    id: 'vinyl-drums',
    name: 'Vinyl Drums',
    category: 'drums',
    description: 'Warm dusty drums with crackle',
    source: 'procedural',
    padNames: ['Kick', 'Kick 2', 'Snare', 'Snare 2', 'Hat', 'Hat O', 'Shaker', 'Rim',
      'Clap', 'Tom L', 'Tom M', 'Tom H', 'Crackle', 'Hat 2', 'Snare FX', 'Rim 2'],
  },
  {
    id: '808-bass',
    name: '808 Bass',
    category: 'bass',
    description: 'Sub bass tones C1–D3',
    source: 'procedural',
    padNames: ['C1', 'D1', 'E1', 'F1', 'G1', 'A1', 'B1', 'C2',
      'D2', 'E2', 'F2', 'G2', 'A2', 'B2', 'C3', 'D3'],
    defaultGain: -3,
  },
  {
    id: 'percussion',
    name: 'World Perc',
    category: 'perc',
    description: 'Congas, bongos, shakers, bells',
    source: 'procedural',
    padNames: ['Conga L', 'Conga H', 'Bongo', 'Bongo 2', 'Shaker', 'Tamb', 'Cowbell', 'Clave',
      'Wood', 'Triangle', 'Bell', 'Bell 2', 'Tabla', 'Djembe', 'Rim', 'Snap'],
  },
  {
    id: 'synth-stabs',
    name: 'Synth Stabs',
    category: 'synth',
    description: 'Short synth chords and plucks',
    source: 'procedural',
    padNames: ['Stab 1', 'Stab 2', 'Stab 3', 'Stab 4', 'Pluck 1', 'Pluck 2', 'Pluck 3', 'Pluck 4',
      'Pad 1', 'Pad 2', 'Lead', 'Lead 2', 'Chord', 'Chord 2', 'FX', 'FX 2'],
  },
  {
    id: 'fx-hits',
    name: 'FX Hits',
    category: 'fx',
    description: 'Impacts, risers, sweeps, drops',
    source: 'procedural',
    padNames: ['Impact', 'Impact 2', 'Riser', 'Riser 2', 'Drop', 'Sweep', 'Whoosh', 'Noise',
      'Sub Hit', 'Clang', 'Reverse', 'Glitch', 'Laser', 'Siren', 'Boom', 'Zap'],
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

function kick(ctx: AudioContext, v: number, deep = false): AudioBuffer {
  const sr = ctx.sampleRate;
  const dur = deep ? 0.75 : 0.55;
  const len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len, sr);
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

function snare(ctx: AudioContext, v: number, tight = false): AudioBuffer {
  const sr = ctx.sampleRate;
  const dur = tight ? 0.22 : 0.35;
  const len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len, sr);
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

function hat(ctx: AudioContext, v: number, open = false, metallic = false): AudioBuffer {
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

function shaker(ctx: AudioContext, v: number): AudioBuffer {
  const buf = noise(ctx, 0.15 + v * 0.01, v + 20);
  const d = buf.getChannelData(0);
  const sr = ctx.sampleRate;
  for (let i = 0; i < d.length; i++) {
    d[i] *= 0.2 + 0.8 * Math.abs(Math.sin(i / sr * 40));
  }
  env(d, sr, 0.002, 0.08);
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

function toneHit(ctx: AudioContext, hz: number, dur: number, v: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const f = hz * (1 + v * 0.02 * Math.exp(-t * 10));
    d[i] = Math.sin(2 * Math.PI * f * t) * Math.exp(-t * (4 + v * 0.3));
  }
  env(d, sr, 0.001, dur * 0.6);
  return buf;
}

function synthStab(ctx: AudioContext, root: number, v: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const dur = 0.35;
  const len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len, sr);
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

function riser(ctx: AudioContext, v: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const dur = 1.5;
  const len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len, sr);
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

function impact(ctx: AudioContext, v: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const dur = 0.8;
  const len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len, sr);
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

function vinylCrackle(ctx: AudioContext, v: number): AudioBuffer {
  const buf = noise(ctx, 0.4, v + 99);
  const d = buf.getChannelData(0);
  const sr = ctx.sampleRate;
  for (let i = 0; i < d.length; i++) {
    if (Math.random() > 0.997) d[i] *= 3;
    d[i] *= 0.08;
  }
  env(d, sr, 0.01, 0.3);
  return buf;
}

const BASS_NOTES = [36, 38, 40, 41, 43, 45, 47, 48, 50, 52, 53, 55, 57, 59, 60, 62];
const STAB_NOTES = [48, 50, 52, 53, 55, 57, 59, 60, 62, 64, 65, 67, 69, 71, 72, 74];

const KIT_GENERATORS: Record<string, Gen[]> = {
  'classic-drums': [
    kick, kick, snare, snare, hat, hat, hat, hat,
    clap, clap, tom, tom, tom, tom, rim, hat,
  ],
  'lofi-drums': [
    (c, v) => kick(c, v + 3), kick, (c, v) => snare(c, v + 5), rim,
    (c, v) => hat(c, v + 2), (c, v) => hat(c, v, true), rim, (c, v) => hat(c, v + 4),
    clap, (c, v) => snare(c, v + 8), (c, v) => tom(c, v + 1), (c, v) => tom(c, v + 3),
    (c, v) => tom(c, v + 5), kick, (c, v) => hat(c, v + 6, true), rim,
  ],
  'trap-drums': [
    (c, v) => kick(c, v, true), (c, v) => kick(c, v + 2, true),
    (c, v) => snare(c, v, true), (c, v) => snare(c, v + 3, true),
    hat, (c, v) => hat(c, v + 2), (c, v) => hat(c, v + 4, false, true),
    (c, v) => hat(c, v, true),
    clap, rim, tom, (c, v) => tom(c, v + 4),
    (c, v) => kick(c, v + 1, true), (c, v) => hat(c, v + 6),
    (c, v) => snare(c, v + 5, true), rim,
  ],
  'house-drums': [
    kick, (c, v) => kick(c, v + 1), clap, (c, v) => clap(c, v + 2),
    hat, (c, v) => hat(c, v, true), shaker, rim,
    snare, (c, v) => toneHit(c, 800 + v * 20, 0.3, v),
    tom, (c, v) => tom(c, v + 2), (c, v) => kick(c, v + 3),
    (c, v) => hat(c, v + 4), (c, v) => clap(c, v + 1), rim,
  ],
  'techno-drums': [
    (c, v) => kick(c, v + 2), kick, clap,
    (c, v) => snare(c, v, true),
    (c, v) => hat(c, v, false, true), (c, v) => hat(c, v + 3, false, true),
    (c, v) => hat(c, v, true), (c, v) => toneHit(c, 1200, 0.5, v),
    rim, (c, v) => noise(c, 0.1, v + 30).getChannelData(0) && toneHit(c, 300, 0.15, v),
    tom, (c, v) => tom(c, v + 5), (c, v) => kick(c, v + 4),
    (c, v) => noise(c, 0.2, v) && impact(c, v), rim,
    (c, v) => hat(c, v + 8, true),
  ],
  'vinyl-drums': [
    (c, v) => kick(c, v + 4), (c, v) => kick(c, v + 2),
    (c, v) => snare(c, v + 3), (c, v) => snare(c, v + 6),
    (c, v) => hat(c, v + 1), (c, v) => hat(c, v, true), shaker, rim,
    (c, v) => clap(c, v + 2), (c, v) => tom(c, v), (c, v) => tom(c, v + 3),
    (c, v) => tom(c, v + 5), vinylCrackle, (c, v) => hat(c, v + 4),
    (c, v) => snare(c, v + 8), rim,
  ],
  '808-bass': BASS_NOTES.map((n) => (c) => bass808(c, n)),
  'percussion': [
    (c, v) => toneHit(c, 180 + v * 5, 0.25, v),
    (c, v) => toneHit(c, 280 + v * 8, 0.2, v),
    (c, v) => toneHit(c, 350 + v * 6, 0.18, v),
    (c, v) => toneHit(c, 420 + v * 7, 0.16, v),
    shaker, (c, v) => toneHit(c, 600 + v * 10, 0.12, v),
    (c, v) => toneHit(c, 900 + v * 15, 0.08, v),
    (c, v) => toneHit(c, 1200 + v * 20, 0.06, v),
    rim, (c, v) => toneHit(c, 500 + v * 12, 0.1, v),
    (c, v) => toneHit(c, 2000 + v * 30, 0.15, v),
    (c, v) => toneHit(c, 1500 + v * 25, 0.2, v),
    (c, v) => tom(c, v + 8), (c, v) => kick(c, v + 10, true),
    rim, clap,
  ],
  'synth-stabs': STAB_NOTES.map((n, i) => (c, v) => synthStab(c, n, i + v)),
  'fx-hits': [
    impact, (c, v) => impact(c, v + 3), riser, (c, v) => riser(c, v + 2),
    (c, v) => kick(c, v, true), (c, v) => riser(c, v + 5),
    (c, v) => noise(c, 0.5, v) && riser(c, v), (c, v) => noise(c, 0.3, v + 10),
    (c, v) => kick(c, v + 5, true), (c, v) => toneHit(c, 800, 0.4, v),
    (c, v) => riser(c, v + 8), (c, v) => noise(c, 0.15, v + 20),
    (c, v) => toneHit(c, 2000 + v * 100, 0.2, v), (c, v) => toneHit(c, 400, 0.6, v),
    (c, v) => impact(c, v + 6), (c, v) => toneHit(c, 3000, 0.1, v),
  ],
};

// Fix techno-drums generators that used invalid expressions
KIT_GENERATORS['techno-drums'] = [
  (c, v) => kick(c, v + 2), kick, clap,
  (c, v) => snare(c, v, true),
  (c, v) => hat(c, v, false, true), (c, v) => hat(c, v + 3, false, true),
  (c, v) => hat(c, v, true), (c, v) => toneHit(c, 1200, 0.5, v),
  rim, (c, v) => toneHit(c, 300, 0.15, v),
  tom, (c, v) => tom(c, v + 5), (c, v) => kick(c, v + 4),
  (c, v) => impact(c, v), rim, (c, v) => hat(c, v + 8, true),
];

export function generateFactoryKit(
  ctx: AudioContext,
  kitId: string,
): { id: string; name: string; buffers: AudioBuffer[] } | null {
  const meta = FACTORY_KITS.find((k) => k.id === kitId);
  const gens = KIT_GENERATORS[kitId];
  if (!meta || !gens || meta.source !== 'procedural') return null;

  const buffers = gens.map((gen, i) => gen(ctx, i));
  return { id: kitId, name: meta.name, buffers };
}
