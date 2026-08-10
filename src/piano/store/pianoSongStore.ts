import { create } from 'zustand'
import type { PianoNote, PianoSong } from '../song/types'
import {
  createDefaultSong,
  createPattern,
  getPattern,
  patternStepCount,
  PIANO_DEFAULT_BARS,
  PIANO_MAX_BARS,
} from '../song/types'
import { midiToMelodicPad, melodicPadToMidi } from '../song/mapping'
import { PATTERN_PRESETS } from '../song/patternPresets'
import { exportPianoSongToMpc, stepMs } from '../song/exportToMpc'
import { pianoEngine } from '../audio/PianoEngine'
import { usePianoStore } from './pianoStore'

export type PianoTab = 'play' | 'song'

interface PianoSongState {
  tab: PianoTab
  song: PianoSong
  activePatternId: string
  recordEnabled: boolean
  patternPlaying: boolean
  playStep: number
  exportBank: number
  exportSlot: number
  exportStatus: string

  setTab(tab: PianoTab): void
  selectPattern(id: string): void
  setSongName(name: string): void
  setSongBpm(bpm: number): void
  addPattern(bars?: number): void
  removePattern(id: string): void
  renamePattern(id: string, name: string): void
  setPatternBars(id: string, bars: number): void
  loadPreset(presetId: string): void
  toggleNote(step: number, midi: number, vel?: number): void
  clearPattern(id: string): void
  recordNote(midi: number, vel: number): void
  toggleRecord(): void
  playPattern(): void
  stopPattern(): void
  tickPattern(): void
  addArrangementBlock(patternId: string): void
  removeArrangementBlock(id: string): void
  setBlockRepeats(id: string, repeats: number): void
  moveBlock(id: string, dir: -1 | 1): void
  setExportTarget(bank: number, slot: number): void
  exportToMpc(): Promise<boolean>
}

function upsertNote(notes: PianoNote[], note: PianoNote): PianoNote[] {
  const idx = notes.findIndex((n) => n.step === note.step && n.midi === note.midi)
  if (idx >= 0) return notes.filter((_, i) => i !== idx)
  return [...notes, note].sort((a, b) => a.step - b.step || a.midi - b.midi)
}

let playTimer: ReturnType<typeof setInterval> | null = null

export const usePianoSongStore = create<PianoSongState>((set, get) => {
  const defaultSong = createDefaultSong()

  return {
    tab: 'play',
    song: defaultSong,
    activePatternId: defaultSong.patterns[1]?.id ?? defaultSong.patterns[0].id,
    recordEnabled: false,
    patternPlaying: false,
    playStep: 0,
    exportBank: 0,
    exportSlot: 1,
    exportStatus: '',

    setTab(tab) {
      if (tab === 'play') get().stopPattern()
      set({ tab })
    },

    selectPattern(id) {
      get().stopPattern()
      set({ activePatternId: id })
    },

    setSongName(name) {
      set((s) => ({ song: { ...s.song, name } }))
    },

    setSongBpm(bpm) {
      const clamped = Math.max(40, Math.min(200, Math.round(bpm)))
      set((s) => ({ song: { ...s.song, bpm: clamped } }))
      if (get().patternPlaying) {
        get().stopPattern()
        get().playPattern()
      }
    },

    addPattern(bars = PIANO_DEFAULT_BARS) {
      const pat = createPattern(`Pattern ${get().song.patterns.length + 1}`, bars)
      set((s) => ({
        song: {
          ...s.song,
          patterns: [...s.song.patterns, pat],
          arrangement: [...s.song.arrangement, { id: `blk-${Date.now()}`, patternId: pat.id, repeats: 1 }],
        },
        activePatternId: pat.id,
      }))
    },

    removePattern(id) {
      const { song } = get()
      if (song.patterns.length <= 1) return
      const patterns = song.patterns.filter((p) => p.id !== id)
      const arrangement = song.arrangement.filter((b) => b.patternId !== id)
      set({
        song: { ...song, patterns, arrangement },
        activePatternId: patterns[0]?.id ?? '',
      })
    },

    renamePattern(id, name) {
      set((s) => ({
        song: {
          ...s.song,
          patterns: s.song.patterns.map((p) => (p.id === id ? { ...p, name } : p)),
        },
      }))
    },

    setPatternBars(id, bars) {
      const clamped = Math.max(1, Math.min(PIANO_MAX_BARS, bars))
      set((s) => ({
        song: {
          ...s.song,
          patterns: s.song.patterns.map((p) => {
            if (p.id !== id) return p
            const maxStep = patternStepCount(clamped)
            return {
              ...p,
              bars: clamped,
              notes: p.notes.filter((n) => n.step < maxStep),
            }
          }),
        },
      }))
    },

    loadPreset(presetId) {
      const preset = PATTERN_PRESETS.find((p) => p.id === presetId)
      if (!preset) return
      const { activePatternId } = get()
      set((s) => ({
        song: {
          ...s.song,
          patterns: s.song.patterns.map((p) =>
            p.id === activePatternId
              ? { ...p, bars: preset.bars, notes: [...preset.notes] }
              : p,
          ),
        },
      }))
    },

    toggleNote(step, midi, vel = 100) {
      const pad = midiToMelodicPad(midi)
      if (pad === null) return
      const { activePatternId, song } = get()
      const pat = getPattern(song, activePatternId)
      if (!pat || step < 0 || step >= patternStepCount(pat.bars)) return
      set((s) => ({
        song: {
          ...s.song,
          patterns: s.song.patterns.map((p) => {
            if (p.id !== activePatternId) return p
            return {
              ...p,
              notes: upsertNote(p.notes, { step, midi, vel }),
            }
          }),
        },
      }))
    },

    clearPattern(id) {
      set((s) => ({
        song: {
          ...s.song,
          patterns: s.song.patterns.map((p) => (p.id === id ? { ...p, notes: [] } : p)),
        },
      }))
    },

    recordNote(midi, vel) {
      if (!get().recordEnabled || get().tab !== 'song') return
      if (midiToMelodicPad(midi) === null) return
      const step = get().playStep
      const { activePatternId, song } = get()
      const pat = getPattern(song, activePatternId)
      if (!pat || step < 0 || step >= patternStepCount(pat.bars)) return
      set((s) => ({
        song: {
          ...s.song,
          patterns: s.song.patterns.map((p) => {
            if (p.id !== activePatternId) return p
            const exists = p.notes.some((n) => n.step === step && n.midi === midi)
            if (exists) return p
            return {
              ...p,
              notes: [...p.notes, { step, midi, vel }].sort((a, b) => a.step - b.step || a.midi - b.midi),
            }
          }),
        },
      }))
    },

    toggleRecord() {
      set((s) => ({ recordEnabled: !s.recordEnabled }))
    },

    playPattern() {
      get().stopPattern()
      const { song, activePatternId } = get()
      const pat = getPattern(song, activePatternId)
      if (!pat) return

      const ms = stepMs(song.bpm)
      let step = 0
      const total = patternStepCount(pat.bars)

      const fireStep = () => {
        set({ playStep: step })
        for (const n of pat.notes) {
          if (n.step === step) {
            pianoEngine.noteOn(n.midi, n.vel, 'touch', `pat-${n.step}-${n.midi}`)
            window.setTimeout(() => {
              pianoEngine.noteOff(n.midi, 'touch', `pat-${n.step}-${n.midi}`)
            }, ms * 0.85)
          }
        }
        step = (step + 1) % total
      }

      fireStep()
      playTimer = setInterval(fireStep, ms)
      set({ patternPlaying: true, playStep: 0 })
    },

    stopPattern() {
      if (playTimer) {
        clearInterval(playTimer)
        playTimer = null
      }
      pianoEngine.allNotesOff()
      set({ patternPlaying: false, playStep: 0 })
    },

    tickPattern() {
      /* driven by playPattern interval */
    },

    addArrangementBlock(patternId) {
      set((s) => ({
        song: {
          ...s.song,
          arrangement: [
            ...s.song.arrangement,
            { id: `blk-${Date.now()}`, patternId, repeats: 1 },
          ],
        },
      }))
    },

    removeArrangementBlock(id) {
      set((s) => ({
        song: {
          ...s.song,
          arrangement: s.song.arrangement.filter((b) => b.id !== id),
        },
      }))
    },

    setBlockRepeats(id, repeats) {
      const r = Math.max(1, Math.min(8, repeats))
      set((s) => ({
        song: {
          ...s.song,
          arrangement: s.song.arrangement.map((b) => (b.id === id ? { ...b, repeats: r } : b)),
        },
      }))
    },

    moveBlock(id, dir) {
      set((s) => {
        const arr = [...s.song.arrangement]
        const i = arr.findIndex((b) => b.id === id)
        if (i < 0) return s
        const j = i + dir
        if (j < 0 || j >= arr.length) return s
        ;[arr[i], arr[j]] = [arr[j], arr[i]]
        return { song: { ...s.song, arrangement: arr } }
      })
    },

    setExportTarget(bank, slot) {
      set({ exportBank: bank, exportSlot: slot })
    },

    async exportToMpc() {
      const { song, exportBank, exportSlot } = get()
      set({ exportStatus: 'EXPORTING…' })
      try {
        const ok = await exportPianoSongToMpc(song, exportBank, exportSlot)
        set({ exportStatus: ok ? 'EXPORTED TO MPC' : 'EXPORT FAILED' })
        if (ok) {
          usePianoSongStore.getState().stopPattern()
          return true
        }
        return false
      } catch {
        set({ exportStatus: 'EXPORT FAILED' })
        return false
      }
    },
  }
})

/** Wire piano engine notes into song recorder. */
export function bindPianoSongRecorder() {
  const prevVisual = pianoEngine.onNoteVisual
  pianoEngine.onNoteVisual = (note, on) => {
    prevVisual?.(note, on)
    if (on) {
      const vel = usePianoStore.getState().lastVelocity || usePianoStore.getState().velocity
      usePianoSongStore.getState().recordNote(note, vel)
    }
  }
}

/** Pad row labels for pattern grid (C4–D6). */
export const GRID_PAD_LABELS = Array.from({ length: 16 }, (_, i) => {
  const names = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
  const midi = melodicPadToMidi(i)
  const oct = Math.floor(midi / 12) - 1
  const name = names[midi % 12]
  return `${name}${oct}`
})
