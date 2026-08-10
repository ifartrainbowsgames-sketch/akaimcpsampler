/**
 * Factory demo beats — short complete loops (4–8 bars) with kits + sequences.
 * Load → PLAY → jam on pads over a real groove.
 */

import { TICKS_PER_16TH, type SeqEvent } from '../types';

export interface DemoHit {
  pad: number;
  /** 16th-note step from start (0 = downbeat). */
  step: number;
  bank?: number;
  vel?: number;
}

export interface FactoryDemoMeta {
  id: string;
  name: string;
  description: string;
  category: 'beats' | 'melodic' | 'full';
  /** Primary kit (bank 0 drums or melodic). */
  kitId: string;
  /** Optional second kit loaded onto bank 1 for melody under drums. */
  melodyKitId?: string;
  bpm: number;
  bars: number;
  swing?: number;
  hits: DemoHit[];
}

const S = TICKS_PER_16TH;

export function demoHitsToEvents(hits: DemoHit[]): SeqEvent[] {
  return hits
    .map((h) => ({
      tick: h.step * S,
      pad: h.pad,
      bank: h.bank ?? 0,
      velocity: h.vel ?? 100,
      duration: S,
    }))
    .sort((a, b) => a.tick - b.tick || a.pad - b.pad);
}

/** Classic boom-bap — kick/snare/hats (pads 0,2,4). */
function boomBap(bars = 4): DemoHit[] {
  const out: DemoHit[] = [];
  for (let bar = 0; bar < bars; bar++) {
    const o = bar * 16;
    out.push({ pad: 0, step: o, vel: 127 });
    out.push({ pad: 0, step: o + 10, vel: 105 });
    out.push({ pad: 2, step: o + 4, vel: 120 });
    out.push({ pad: 2, step: o + 12, vel: 115 });
    for (let s = 0; s < 16; s += 2) {
      out.push({ pad: 4, step: o + s, vel: s % 4 === 0 ? 85 : 65 });
    }
    out.push({ pad: 8, step: o + 14, vel: 90 });
  }
  return out;
}

/** Trap — 808 kick, snappy snare, rolling hats. */
function trapBeat(bars = 4): DemoHit[] {
  const out: DemoHit[] = [];
  for (let bar = 0; bar < bars; bar++) {
    const o = bar * 16;
    out.push({ pad: 0, step: o, vel: 127 });
    out.push({ pad: 0, step: o + 6, vel: 100 });
    out.push({ pad: 0, step: o + 10, vel: 110 });
    out.push({ pad: 2, step: o + 4, vel: 125 });
    out.push({ pad: 2, step: o + 12, vel: 120 });
    for (let s = 0; s < 16; s++) {
      out.push({ pad: 4, step: o + s, vel: s % 2 === 0 ? 75 : 55 });
    }
    out.push({ pad: 1, step: o + 8, vel: 95 });
  }
  return out;
}

/** Lo-fi dusty groove. */
function lofiBeat(bars = 8): DemoHit[] {
  const out: DemoHit[] = [];
  for (let bar = 0; bar < bars; bar++) {
    const o = bar * 16;
    out.push({ pad: 0, step: o, vel: 115 });
    if (bar % 2 === 1) out.push({ pad: 0, step: o + 7, vel: 90 });
    out.push({ pad: 2, step: o + 4, vel: 105 });
    out.push({ pad: 2, step: o + 12, vel: 100 });
    for (let s = 0; s < 16; s += 4) {
      out.push({ pad: 4, step: o + s, vel: 60 });
      out.push({ pad: 5, step: o + s + 2, vel: 45 });
    }
    out.push({ pad: 10, step: o + 6, vel: 80 });
    out.push({ pad: 11, step: o + 14, vel: 75 });
  }
  return out;
}

/** Four-on-the-floor house. */
function houseBeat(bars = 4): DemoHit[] {
  const out: DemoHit[] = [];
  for (let bar = 0; bar < bars; bar++) {
    const o = bar * 16;
    for (let s = 0; s < 16; s += 4) {
      out.push({ pad: 0, step: o + s, vel: 120 });
      out.push({ pad: 8, step: o + s + 2, vel: 100 });
    }
    out.push({ pad: 4, step: o + 2, vel: 70 });
    out.push({ pad: 4, step: o + 6, vel: 65 });
    out.push({ pad: 4, step: o + 10, vel: 70 });
    out.push({ pad: 4, step: o + 14, vel: 65 });
    out.push({ pad: 5, step: o + 8, vel: 55 });
  }
  return out;
}

/** Chord progression on melodic pads (whole-bar changes). */
function chordSong(pads: number[], bars = 4): DemoHit[] {
  const out: DemoHit[] = [];
  for (let bar = 0; bar < bars; bar++) {
    const o = bar * 16;
    const p = pads[bar % pads.length];
    out.push({ pad: p, step: o, vel: 95 });
    out.push({ pad: p, step: o + 8, vel: 80 });
  }
  return out;
}

/** Arpeggio cycling through pad indices. */
function arpSong(pads: number[], bars = 4, speed = 2): DemoHit[] {
  const out: DemoHit[] = [];
  let idx = 0;
  for (let bar = 0; bar < bars; bar++) {
    for (let s = 0; s < 16; s += speed) {
      out.push({ pad: pads[idx % pads.length], step: bar * 16 + s, vel: 70 + (idx % 3) * 15 });
      idx++;
    }
  }
  return out;
}

/** Melody + optional bank for layered full beats. */
function layerMelody(
  drumHits: DemoHit[],
  melodyPads: number[],
  bars: number,
  melodyBank = 1,
): DemoHit[] {
  const mel = arpSong(melodyPads, bars, 2).map((h) => ({ ...h, bank: melodyBank, vel: (h.vel ?? 80) - 10 }));
  const chords = chordSong(melodyPads.slice(0, 4), bars).map((h) => ({
    ...h,
    bank: melodyBank,
    vel: 75,
  }));
  return [...drumHits, ...mel, ...chords];
}

function buildDemos(): FactoryDemoMeta[] {
  const demos: FactoryDemoMeta[] = [];

  const drumBeats: { id: string; kit: string; name: string; desc: string; bpm: number; bars: number; hits: DemoHit[]; swing?: number }[] = [
    { id: 'beat-classic-01', kit: 'drums-classic-01', name: 'Boom Bap 01', desc: '4-bar dusty boom bap — hit PLAY and jam', bpm: 92, bars: 4, hits: boomBap(4), swing: 58 },
    { id: 'beat-classic-02', kit: 'drums-classic-02', name: 'Boom Bap 02', desc: '8-bar head-nod groove', bpm: 88, bars: 8, hits: boomBap(8), swing: 62 },
    { id: 'beat-lofi-01', kit: 'drums-lofi-01', name: 'Lo-Fi Chill', desc: '8-bar mellow lo-fi loop', bpm: 78, bars: 8, hits: lofiBeat(8), swing: 60 },
    { id: 'beat-lofi-02', kit: 'drums-lofi-03', name: 'Lo-Fi Swing', desc: 'Swung 4-bar pocket', bpm: 82, bars: 4, hits: lofiBeat(4), swing: 65 },
    { id: 'beat-trap-01', kit: 'drums-trap-01', name: 'Trap Bounce', desc: 'Hard 4-bar trap loop', bpm: 140, bars: 4, hits: trapBeat(4) },
    { id: 'beat-trap-02', kit: 'drums-trap-03', name: 'Trap Roll', desc: '8-bar trap with hat rolls', bpm: 145, bars: 8, hits: trapBeat(8) },
    { id: 'beat-house-01', kit: 'drums-classic-01', name: 'House Groove', desc: '4-bar four-on-the-floor', bpm: 124, bars: 4, hits: houseBeat(4) },
    { id: 'beat-classic-03', kit: 'drums-classic-03', name: 'Pocket Groove', desc: '4-bar tight pocket', bpm: 96, bars: 4, hits: boomBap(4), swing: 54 },
    { id: 'beat-lofi-03', kit: 'drums-lofi-05', name: 'Dusty 8', desc: 'Long lo-fi loop for vibing', bpm: 75, bars: 8, hits: lofiBeat(8), swing: 63 },
  ];

  for (const b of drumBeats) {
    demos.push({
      id: b.id,
      name: b.name,
      description: b.desc,
      category: 'beats',
      kitId: b.kit,
      bpm: b.bpm,
      bars: b.bars,
      swing: b.swing,
      hits: b.hits,
    });
  }

  const melodicSongs: { id: string; kit: string; name: string; desc: string; bpm: number; bars: number; hits: DemoHit[] }[] = [
    { id: 'song-keys-01', kit: 'melodic-keys-01', name: 'Key Progression', desc: '4-bar chord cycle — add your drums', bpm: 90, bars: 4, hits: chordSong([0, 4, 7, 11], 4) },
    { id: 'song-keys-02', kit: 'melodic-keys-02', name: 'Key Arp', desc: '8-bar arpeggio melody', bpm: 100, bars: 8, hits: arpSong([0, 2, 4, 7, 9, 11], 8, 2) },
    { id: 'song-pads-01', kit: 'melodic-pads-01', name: 'Pad Wash', desc: '4-bar lush pad movement', bpm: 72, bars: 4, hits: chordSong([0, 5, 3, 7], 4) },
    { id: 'song-pads-02', kit: 'melodic-pads-03', name: 'Ambient Drift', desc: '8-bar slow pad swell', bpm: 68, bars: 8, hits: chordSong([0, 4, 8, 11, 7, 3], 8) },
    { id: 'song-chords-01', kit: 'melodic-chords-01', name: 'Chord Stack', desc: '4-bar triad hits', bpm: 85, bars: 4, hits: chordSong([0, 3, 5, 7], 4) },
    { id: 'song-minor-01', kit: 'melodic-minor-01', name: 'Minor Mood', desc: '4-bar minor progression', bpm: 88, bars: 4, hits: chordSong([0, 3, 5, 8], 4) },
    { id: 'song-plucks-01', kit: 'melodic-plucks-01', name: 'Pluck Pattern', desc: '4-bar plucked melody', bpm: 110, bars: 4, hits: arpSong([0, 4, 7, 11, 9, 7, 4, 0], 4, 1) },
    { id: 'song-arp-01', kit: 'melodic-arp-02', name: 'Arp Drive', desc: '4-bar fast arpeggio', bpm: 120, bars: 4, hits: arpSong([0, 2, 4, 7, 9, 7, 4, 2], 4, 1) },
    { id: 'song-strings-01', kit: 'melodic-strings-01', name: 'String Suite', desc: '8-bar string pads', bpm: 70, bars: 8, hits: chordSong([0, 4, 7, 11], 8) },
    { id: 'song-organ-01', kit: 'melodic-organ-02', name: 'Organ Groove', desc: '4-bar organ stabs', bpm: 95, bars: 4, hits: chordSong([0, 5, 7, 10], 4) },
    { id: 'song-bells-01', kit: 'melodic-bells-01', name: 'Bell Melody', desc: '4-bar bell pattern', bpm: 105, bars: 4, hits: arpSong([0, 4, 7, 12, 11, 7, 4, 0], 4, 2) },
    { id: 'song-ambient-01', kit: 'melodic-ambient-01', name: 'Ambient Loop', desc: '8-bar evolving texture', bpm: 65, bars: 8, hits: chordSong([0, 7, 3, 10, 5, 12], 8) },
  ];

  for (const m of melodicSongs) {
    demos.push({
      id: m.id,
      name: m.name,
      description: m.desc,
      category: 'melodic',
      kitId: m.kit,
      bpm: m.bpm,
      bars: m.bars,
      hits: m.hits,
    });
  }

  const fullBeats: { id: string; drumKit: string; melKit: string; name: string; desc: string; bpm: number; bars: number; swing?: number }[] = [
    { id: 'full-lofi-keys', drumKit: 'drums-lofi-02', melKit: 'melodic-keys-03', name: 'Lo-Fi + Keys', desc: '8-bar lo-fi beat with key melody — full song', bpm: 80, bars: 8, swing: 61 },
    { id: 'full-trap-pads', drumKit: 'drums-trap-02', melKit: 'melodic-pads-02', name: 'Trap + Pads', desc: '4-bar trap with pad layer', bpm: 142, bars: 4 },
    { id: 'full-boom-chords', drumKit: 'drums-classic-04', melKit: 'melodic-chords-02', name: 'Boom + Chords', desc: '4-bar boom bap with chords', bpm: 90, bars: 4, swing: 58 },
    { id: 'full-lofi-minor', drumKit: 'drums-lofi-04', melKit: 'melodic-minor-02', name: 'Lo-Fi Minor', desc: '8-bar minor key beat', bpm: 76, bars: 8, swing: 64 },
    { id: 'full-classic-pluck', drumKit: 'drums-classic-05', melKit: 'melodic-plucks-02', name: 'Classic + Pluck', desc: '4-bar groove with pluck top line', bpm: 94, bars: 4, swing: 56 },
    { id: 'full-trap-arp', drumKit: 'drums-trap-04', melKit: 'melodic-arp-01', name: 'Trap + Arp', desc: '4-bar trap with arpeggio', bpm: 138, bars: 4 },
    { id: 'full-lofi-ambient', drumKit: 'drums-lofi-01', melKit: 'melodic-ambient-02', name: 'Lo-Fi Ambient', desc: '8-bar atmospheric full beat', bpm: 74, bars: 8, swing: 62 },
    { id: 'full-boom-strings', drumKit: 'drums-classic-02', melKit: 'melodic-strings-02', name: 'Boom + Strings', desc: '8-bar cinematic boom bap', bpm: 86, bars: 8, swing: 60 },
  ];

  for (const f of fullBeats) {
    const drums = f.bars === 8 ? lofiBeat(8) : f.id.includes('trap') ? trapBeat(f.bars) : boomBap(f.bars);
    demos.push({
      id: f.id,
      name: f.name,
      description: f.desc,
      category: 'full',
      kitId: f.drumKit,
      melodyKitId: f.melKit,
      bpm: f.bpm,
      bars: f.bars,
      swing: f.swing,
      hits: layerMelody(drums, [0, 2, 4, 7, 9, 11], f.bars, 1),
    });
  }

  return demos;
}

export const FACTORY_DEMOS: FactoryDemoMeta[] = buildDemos();

export const FACTORY_DEMO_COUNT = FACTORY_DEMOS.length;

export function getFactoryDemo(id: string): FactoryDemoMeta | undefined {
  return FACTORY_DEMOS.find((d) => d.id === id);
}

/** Approximate loop length in seconds for UI. */
export function demoDurationSec(demo: FactoryDemoMeta): number {
  const [num, den] = [4, 4];
  return demo.bars * (60 / demo.bpm) * num * (4 / den);
}
