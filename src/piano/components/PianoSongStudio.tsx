import { usePianoSongStore } from '../store/pianoSongStore'
import { usePianoStore } from '../store/pianoStore'
import { PATTERN_PRESETS } from '../song/patternPresets'
import { PIANO_MAX_BARS } from '../song/types'
import { PatternGrid } from './PatternGrid'
import { ArrangementTimeline } from './ArrangementTimeline'
import { PianoSongLCD } from './PianoSongLCD'

export function PianoSongStudio() {
  const song = usePianoSongStore((s) => s.song)
  const activePatternId = usePianoSongStore((s) => s.activePatternId)
  const recordEnabled = usePianoSongStore((s) => s.recordEnabled)
  const patternPlaying = usePianoSongStore((s) => s.patternPlaying)
  const exportBank = usePianoSongStore((s) => s.exportBank)
  const exportSlot = usePianoSongStore((s) => s.exportSlot)
  const exportStatus = usePianoSongStore((s) => s.exportStatus)

  const setSongName = usePianoSongStore((s) => s.setSongName)
  const setSongBpm = usePianoSongStore((s) => s.setSongBpm)
  const selectPattern = usePianoSongStore((s) => s.selectPattern)
  const addPattern = usePianoSongStore((s) => s.addPattern)
  const removePattern = usePianoSongStore((s) => s.removePattern)
  const renamePattern = usePianoSongStore((s) => s.renamePattern)
  const setPatternBars = usePianoSongStore((s) => s.setPatternBars)
  const loadPreset = usePianoSongStore((s) => s.loadPreset)
  const clearPattern = usePianoSongStore((s) => s.clearPattern)
  const toggleRecord = usePianoSongStore((s) => s.toggleRecord)
  const playPattern = usePianoSongStore((s) => s.playPattern)
  const stopPattern = usePianoSongStore((s) => s.stopPattern)
  const setExportTarget = usePianoSongStore((s) => s.setExportTarget)
  const exportToMpc = usePianoSongStore((s) => s.exportToMpc)
  const setOpen = usePianoStore((s) => s.setOpen)

  const pat = song.patterns.find((p) => p.id === activePatternId)

  const handleExport = async () => {
    const ok = await exportToMpc()
    if (ok) setOpen(false)
  }

  return (
    <div className="piano-studio">
      <PianoSongLCD />

      <div className="piano-studio__toolbar">
        <label className="piano-studio__field">
          <span>SONG</span>
          <input
            className="piano-studio__input"
            value={song.name}
            onChange={(e) => setSongName(e.target.value)}
          />
        </label>
        <label className="piano-studio__field">
          <span>BPM</span>
          <input
            className="piano-studio__input piano-studio__input--num"
            type="number"
            min={40}
            max={200}
            value={song.bpm}
            onChange={(e) => setSongBpm(Number(e.target.value))}
          />
        </label>
        <select
          className="piano-select"
          value={activePatternId}
          onChange={(e) => selectPattern(e.target.value)}
        >
          {song.patterns.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <button type="button" className="piano-btn piano-btn--sm" onClick={() => addPattern()}>+ PAT</button>
        <button
          type="button"
          className="piano-btn piano-btn--sm"
          onClick={() => pat && removePattern(pat.id)}
          disabled={song.patterns.length <= 1}
        >
          − PAT
        </button>
      </div>

      <div className="piano-studio__pattern-tools">
        {pat && (
          <>
            <input
              className="piano-studio__input"
              value={pat.name}
              onChange={(e) => renamePattern(pat.id, e.target.value)}
            />
            <label className="piano-studio__field">
              <span>BARS</span>
              <input
                className="piano-studio__input piano-studio__input--num"
                type="number"
                min={1}
                max={PIANO_MAX_BARS}
                value={pat.bars}
                onChange={(e) => setPatternBars(pat.id, Number(e.target.value))}
              />
            </label>
            <select className="piano-select" defaultValue="" onChange={(e) => { if (e.target.value) loadPreset(e.target.value); e.target.value = '' }}>
              <option value="">LOAD TEMPLATE…</option>
              {PATTERN_PRESETS.filter((p) => p.id !== 'blank').map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button type="button" className="piano-btn piano-btn--sm" onClick={() => clearPattern(pat.id)}>CLEAR</button>
          </>
        )}
        <button
          type="button"
          className={`piano-btn piano-btn--sm${recordEnabled ? ' piano-btn--lit' : ''}`}
          onClick={toggleRecord}
        >
          REC
        </button>
        {!patternPlaying ? (
          <button type="button" className="piano-btn piano-btn--sm piano-btn--lit" onClick={playPattern}>▶ PLAY</button>
        ) : (
          <button type="button" className="piano-btn piano-btn--sm" onClick={stopPattern}>■ STOP</button>
        )}
      </div>

      <PatternGrid />
      <ArrangementTimeline />

      <div className="piano-studio__export">
        <span className="piano-studio__export-lbl">EXPORT TO MPC</span>
        <label className="piano-studio__field">
          <span>BANK</span>
          <select
            className="piano-select"
            value={exportBank}
            onChange={(e) => setExportTarget(Number(e.target.value), exportSlot)}
          >
            {Array.from({ length: 8 }, (_, i) => (
              <option key={i} value={i}>Bank {String.fromCharCode(65 + i)}</option>
            ))}
          </select>
        </label>
        <label className="piano-studio__field">
          <span>SLOT</span>
          <select
            className="piano-select"
            value={exportSlot}
            onChange={(e) => setExportTarget(exportBank, Number(e.target.value))}
          >
            {Array.from({ length: 8 }, (_, i) => (
              <option key={i} value={i}>Seq {i + 1}</option>
            ))}
          </select>
        </label>
        <button type="button" className="piano-btn piano-btn--wide piano-btn--lit" onClick={() => void handleExport()}>
          SEND TO PADS →
        </button>
        {exportStatus && <span className="piano-studio__export-status">{exportStatus}</span>}
      </div>
    </div>
  )
}
