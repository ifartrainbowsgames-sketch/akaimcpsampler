import { useMemo } from 'react'
import { usePianoSongStore } from '../store/pianoSongStore'
import { getPattern, patternStepCount, PIANO_STEPS_PER_BAR } from '../song/types'
import { melodicPadToMidi } from '../song/mapping'

export function PatternGrid() {
  const song = usePianoSongStore((s) => s.song)
  const activePatternId = usePianoSongStore((s) => s.activePatternId)
  const playStep = usePianoSongStore((s) => s.playStep)
  const patternPlaying = usePianoSongStore((s) => s.patternPlaying)
  const toggleNote = usePianoSongStore((s) => s.toggleNote)

  const pat = getPattern(song, activePatternId)
  const steps = pat ? patternStepCount(pat.bars) : 0
  const bars = pat?.bars ?? 0

  const noteSet = useMemo(() => {
    const set = new Set<string>()
    if (!pat) return set
    for (const n of pat.notes) {
      set.add(`${n.step}:${n.midi}`)
    }
    return set
  }, [pat])

  if (!pat) return null

  const padLabels = Array.from({ length: 16 }, (_, pad) => {
    const midi = melodicPadToMidi(pad)
    const names = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
    return `${names[midi % 12]}${Math.floor(midi / 12) - 1}`
  })

  return (
    <div className="piano-pattern">
      <div className="piano-pattern__scroll">
        <div className="piano-pattern__ruler" style={{ gridTemplateColumns: `48px repeat(${steps}, 18px)` }}>
          <div className="piano-pattern__corner" />
          {Array.from({ length: bars }, (_, bar) => (
            <div
              key={`bar-${bar}`}
              className="piano-pattern__bar-label"
              style={{ gridColumn: `span ${PIANO_STEPS_PER_BAR}` }}
            >
              {bar + 1}
            </div>
          ))}
        </div>

        {padLabels.map((rowLabel, pad) => {
          const midi = melodicPadToMidi(pad)
          return (
            <div
              key={`row-${pad}`}
              className="piano-pattern__row"
              style={{ gridTemplateColumns: `48px repeat(${steps}, 18px)` }}
            >
              <span className="piano-pattern__pad-lbl">{rowLabel}</span>
              {Array.from({ length: steps }, (_, step) => {
                const on = noteSet.has(`${step}:${midi}`)
                const isPlayhead = patternPlaying && playStep === step
                const beat = step % PIANO_STEPS_PER_BAR
                const isDownbeat = beat === 0
                const isBarEnd = beat === PIANO_STEPS_PER_BAR - 1
                return (
                  <button
                    key={step}
                    type="button"
                    className={[
                      'piano-pattern__cell',
                      on ? 'piano-pattern__cell--on' : '',
                      isDownbeat ? 'piano-pattern__cell--beat' : '',
                      isBarEnd ? 'piano-pattern__cell--bar' : '',
                      isPlayhead ? 'piano-pattern__cell--play' : '',
                    ].filter(Boolean).join(' ')}
                    aria-label={`${rowLabel} step ${step + 1}`}
                    aria-pressed={on}
                    onClick={() => toggleNote(step, midi)}
                  />
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
