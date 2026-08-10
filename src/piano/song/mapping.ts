import type { PianoNote } from './types'
import type { DemoHit } from '../../audio/factory/demos'
import { demoHitsToEvents } from '../../audio/factory/demos'
import type { SeqEvent } from '../../audio/types'
import { PIANO_STEPS_PER_BAR } from './types'

/** C4 = pad 0 on melodic factory kit (pads 0–15 chromatic C4–D6). */
export const MELODIC_PAD_ROOT = 60

export function midiToMelodicPad(midi: number): number | null {
  const pad = midi - MELODIC_PAD_ROOT
  if (pad < 0 || pad > 15) return null
  return pad
}

export function melodicPadToMidi(pad: number): number {
  return MELODIC_PAD_ROOT + pad
}

export function pianoNotesToDemoHits(notes: PianoNote[], barOffset = 0): DemoHit[] {
  const hits: DemoHit[] = []
  for (const n of notes) {
    const pad = midiToMelodicPad(n.midi)
    if (pad === null) continue
    hits.push({
      pad,
      step: barOffset * PIANO_STEPS_PER_BAR + n.step,
      vel: n.vel,
    })
  }
  return hits
}

export function demoHitsToPianoNotes(hits: DemoHit[], bars: number): PianoNote[] {
  const maxStep = bars * PIANO_STEPS_PER_BAR
  return hits
    .filter((h) => h.step >= 0 && h.step < maxStep)
    .map((h) => ({
      step: h.step,
      midi: melodicPadToMidi(h.pad),
      vel: h.vel ?? 100,
      len: 1,
    }))
}

export function pianoNotesToSeqEvents(notes: PianoNote[], barOffset = 0): SeqEvent[] {
  return demoHitsToEvents(pianoNotesToDemoHits(notes, barOffset))
}

/** Flatten arrangement into one linear sequence of events. */
export function songToSeqEvents(
  patterns: { id: string; bars: number; notes: PianoNote[] }[],
  arrangement: { patternId: string; repeats: number }[],
): SeqEvent[] {
  const byId = new Map(patterns.map((p) => [p.id, p]))
  const out: SeqEvent[] = []
  let barCursor = 0
  for (const block of arrangement) {
    const pat = byId.get(block.patternId)
    if (!pat) continue
    for (let r = 0; r < block.repeats; r++) {
      out.push(...pianoNotesToSeqEvents(pat.notes, barCursor))
      barCursor += pat.bars
    }
  }
  return out.sort((a, b) => a.tick - b.tick || a.pad - b.pad)
}

export function totalSongBars(
  patterns: { id: string; bars: number }[],
  arrangement: { patternId: string; repeats: number }[],
): number {
  const byId = new Map(patterns.map((p) => [p.id, p]))
  let total = 0
  for (const block of arrangement) {
    const pat = byId.get(block.patternId)
    if (!pat) continue
    total += pat.bars * block.repeats
  }
  return total
}
