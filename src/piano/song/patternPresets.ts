import type { PianoNote } from './types'
import { PIANO_STEPS_PER_BAR } from './types'

/** Simple chord stabs — root triads in C major at common positions. */
function chord(midiRoot: number, steps: number[], vel = 90): PianoNote[] {
  const notes: PianoNote[] = []
  for (const step of steps) {
    notes.push({ step, midi: midiRoot, vel })
    notes.push({ step, midi: midiRoot + 4, vel: vel - 5 })
    notes.push({ step, midi: midiRoot + 7, vel: vel - 8 })
  }
  return notes
}

/** Arpeggio up/down over 1 bar. */
function arp(midiRoot: number, barStart = 0): PianoNote[] {
  const base = barStart * PIANO_STEPS_PER_BAR
  const scale = [0, 4, 7, 12, 7, 4]
  return scale.map((interval, i) => ({
    step: base + i * 2,
    midi: midiRoot + interval,
    vel: 75 + i * 3,
    len: 2,
  }))
}

export type PatternPreset = {
  id: string
  name: string
  bars: number
  notes: PianoNote[]
}

export const PATTERN_PRESETS: PatternPreset[] = [
  {
    id: 'blank',
    name: 'Blank',
    bars: 4,
    notes: [],
  },
  {
    id: 'chord-stabs',
    name: 'Chord Stabs',
    bars: 4,
    notes: [
      ...chord(60, [0, 8]),
      ...chord(57, [16, 24]),
      ...chord(55, [32, 40]),
      ...chord(60, [48, 56]),
    ],
  },
  {
    id: 'arp-c',
    name: 'Arp C',
    bars: 2,
    notes: [...arp(60, 0), ...arp(57, 1)],
  },
  {
    id: 'melody-hook',
    name: 'Melody Hook',
    bars: 4,
    notes: [
      { step: 0, midi: 72, vel: 100 },
      { step: 4, midi: 74, vel: 95 },
      { step: 8, midi: 76, vel: 100 },
      { step: 12, midi: 74, vel: 90 },
      { step: 16, midi: 72, vel: 95 },
      { step: 20, midi: 69, vel: 100 },
      { step: 24, midi: 67, vel: 90 },
      { step: 32, midi: 60, vel: 110 },
    ],
  },
  {
    id: 'bass-line',
    name: 'Bass Line',
    bars: 4,
    notes: [
      { step: 0, midi: 48, vel: 110 },
      { step: 8, midi: 48, vel: 100 },
      { step: 16, midi: 45, vel: 110 },
      { step: 24, midi: 45, vel: 100 },
      { step: 32, midi: 43, vel: 110 },
      { step: 40, midi: 43, vel: 100 },
      { step: 48, midi: 48, vel: 110 },
      { step: 56, midi: 50, vel: 100 },
    ],
  },
]
