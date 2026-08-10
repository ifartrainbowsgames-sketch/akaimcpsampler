import { usePianoStore } from '../store/pianoStore'
import { usePianoSongStore } from '../store/pianoSongStore'
import { getPattern } from '../song/types'
import { totalSongBars } from '../song/mapping'

export function PianoSongLCD() {
  const octave = usePianoStore((s) => s.octave)
  const setOctave = usePianoStore((s) => s.setOctave)
  const song = usePianoSongStore((s) => s.song)
  const activePatternId = usePianoSongStore((s) => s.activePatternId)
  const recordEnabled = usePianoSongStore((s) => s.recordEnabled)
  const patternPlaying = usePianoSongStore((s) => s.patternPlaying)
  const playStep = usePianoSongStore((s) => s.playStep)
  const exportStatus = usePianoSongStore((s) => s.exportStatus)

  const pat = getPattern(song, activePatternId)
  const totalBars = totalSongBars(song.patterns, song.arrangement)
  const stepBar = pat ? Math.floor(playStep / 16) + 1 : 0
  const stepBeat = pat ? (playStep % 16) + 1 : 0

  return (
    <div className="piano-song-lcd" role="status" aria-live="polite">
      <div className="piano-song-lcd__row piano-song-lcd__row--title">
        <span className="piano-song-lcd__song">{song.name.toUpperCase()}</span>
        <span className="piano-song-lcd__bpm">{song.bpm} BPM</span>
      </div>
      <div className="piano-song-lcd__row">
        <span className="piano-song-lcd__pattern">{pat?.name ?? '—'}</span>
        <span>{pat?.bars ?? 0} BAR PATTERN</span>
        <span>{totalBars} BAR SONG</span>
      </div>
      <div className="piano-song-lcd__row piano-song-lcd__row--controls">
        <div className="piano-song-lcd__octave">
          <button type="button" className="piano-btn piano-btn--sm" onClick={() => setOctave(octave - 1)} aria-label="Octave down">OCT −</button>
          <span>OCT {octave >= 0 ? `+${octave}` : octave}</span>
          <button type="button" className="piano-btn piano-btn--sm" onClick={() => setOctave(octave + 1)} aria-label="Octave up">OCT +</button>
        </div>
        <span className={recordEnabled ? 'piano-song-lcd__rec-on' : ''}>
          REC {recordEnabled ? '●' : '○'}
        </span>
        <span className={patternPlaying ? 'piano-song-lcd__play-on' : ''}>
          {patternPlaying ? `PLAY BAR ${stepBar} · ${stepBeat}/16` : 'STOPPED'}
        </span>
        {exportStatus && <span className="piano-song-lcd__export">{exportStatus}</span>}
      </div>
    </div>
  )
}
