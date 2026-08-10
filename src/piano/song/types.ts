/** Piano song authoring — FL-style patterns + arrangement, exports to MPC sequences. */

export const PIANO_STEPS_PER_BAR = 16
export const PIANO_DEFAULT_BARS = 4
export const PIANO_MAX_BARS = 16

/** One note in a pattern (16th-note grid). */
export type PianoNote = {
  /** Step index from pattern start (0 = bar1 beat1). */
  step: number
  /** MIDI note number (21–108). */
  midi: number
  /** 1–127 */
  vel: number
  /** Note length in 16th steps (default 1). */
  len?: number
}

export type PianoPattern = {
  id: string
  name: string
  bars: number
  notes: PianoNote[]
}

/** One block in the song arrangement (playlist). */
export type ArrangementBlock = {
  id: string
  patternId: string
  /** How many times to repeat this pattern block. */
  repeats: number
}

export type PianoSong = {
  id: string
  name: string
  bpm: number
  patterns: PianoPattern[]
  arrangement: ArrangementBlock[]
}

export function patternStepCount(bars: number): number {
  return bars * PIANO_STEPS_PER_BAR
}

export function createPattern(name: string, bars = PIANO_DEFAULT_BARS): PianoPattern {
  return {
    id: `pat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    bars: Math.min(PIANO_MAX_BARS, Math.max(1, bars)),
    notes: [],
  }
}

export function createDefaultSong(): PianoSong {
  const intro = createPattern('Intro', 2)
  const verse = createPattern('Verse', 4)
  const chorus = createPattern('Chorus', 4)
  return {
    id: `song-${Date.now()}`,
    name: 'My Song',
    bpm: 90,
    patterns: [intro, verse, chorus],
    arrangement: [
      { id: `blk-${Date.now()}-1`, patternId: intro.id, repeats: 1 },
      { id: `blk-${Date.now()}-2`, patternId: verse.id, repeats: 2 },
      { id: `blk-${Date.now()}-3`, patternId: chorus.id, repeats: 2 },
    ],
  }
}

export function getPattern(song: PianoSong, patternId: string): PianoPattern | undefined {
  return song.patterns.find((p) => p.id === patternId)
}
