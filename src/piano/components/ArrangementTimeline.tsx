import { usePianoSongStore } from '../store/pianoSongStore'
import { getPattern } from '../song/types'

export function ArrangementTimeline() {
  const song = usePianoSongStore((s) => s.song)
  const activePatternId = usePianoSongStore((s) => s.activePatternId)
  const selectPattern = usePianoSongStore((s) => s.selectPattern)
  const removeArrangementBlock = usePianoSongStore((s) => s.removeArrangementBlock)
  const setBlockRepeats = usePianoSongStore((s) => s.setBlockRepeats)
  const moveBlock = usePianoSongStore((s) => s.moveBlock)
  const addArrangementBlock = usePianoSongStore((s) => s.addArrangementBlock)

  return (
    <div className="piano-arrange">
      <div className="piano-arrange__hdr">
        <span>SONG ARRANGEMENT</span>
        <button
          type="button"
          className="piano-btn piano-btn--sm"
          onClick={() => addArrangementBlock(activePatternId)}
        >
          + BLOCK
        </button>
      </div>
      <div className="piano-arrange__track">
        {song.arrangement.map((block) => {
          const pat = getPattern(song, block.patternId)
          if (!pat) return null
          const active = pat.id === activePatternId
          return (
            <div
              key={block.id}
              className={`piano-arrange__block${active ? ' piano-arrange__block--active' : ''}`}
            >
              <button
                type="button"
                className="piano-arrange__block-main"
                onClick={() => selectPattern(pat.id)}
              >
                <span className="piano-arrange__name">{pat.name}</span>
                <span className="piano-arrange__meta">{pat.bars} bars × {block.repeats}</span>
              </button>
              <div className="piano-arrange__block-tools">
                <button type="button" className="piano-arrange__tool" onClick={() => moveBlock(block.id, -1)} aria-label="Move left">◀</button>
                <button
                  type="button"
                  className="piano-arrange__tool"
                  onClick={() => setBlockRepeats(block.id, block.repeats + 1)}
                  aria-label="More repeats"
                >
                  ×{block.repeats}
                </button>
                <button type="button" className="piano-arrange__tool" onClick={() => moveBlock(block.id, 1)} aria-label="Move right">▶</button>
                <button
                  type="button"
                  className="piano-arrange__tool piano-arrange__tool--del"
                  onClick={() => removeArrangementBlock(block.id)}
                  aria-label="Remove block"
                >
                  ✕
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
