import { usePianoStore } from '../store/pianoStore';
import { PianoPresetSelector } from './PianoPresetSelector';
import { MidiSelector } from './MidiSelector';

export function PianoControls() {
  const octave = usePianoStore((s) => s.octave);
  const setOctave = usePianoStore((s) => s.setOctave);
  const sustain = usePianoStore((s) => s.sustain);
  const toggleSustain = usePianoStore((s) => s.toggleSustain);
  const setSustain = usePianoStore((s) => s.setSustain);
  const transpose = usePianoStore((s) => s.transpose);
  const setTranspose = usePianoStore((s) => s.setTranspose);

  return (
    <div className="piano-controls">
      <button type="button" className="piano-btn" onClick={() => setOctave(octave - 1)} aria-label="Octave down">
        OCT −
      </button>
      <button type="button" className="piano-btn" onClick={() => setOctave(octave + 1)} aria-label="Octave up">
        OCT +
      </button>
      <button
        type="button"
        className={`piano-btn piano-btn--wide${sustain ? ' piano-btn--lit' : ''}`}
        onPointerDown={() => setSustain(true)}
        onPointerUp={() => setSustain(false)}
        onPointerLeave={() => setSustain(false)}
        onClick={toggleSustain}
        aria-label="Sustain"
        aria-pressed={sustain}
      >
        SUSTAIN
      </button>
      <PianoPresetSelector />
      <MidiSelector />
      <div className="piano-controls__transpose">
        <button type="button" className="piano-btn piano-btn--sm" onClick={() => setTranspose(transpose - 1)} aria-label="Transpose down">♭</button>
        <span className="piano-controls__trans-lbl">TRANS {transpose >= 0 ? `+${transpose}` : transpose}</span>
        <button type="button" className="piano-btn piano-btn--sm" onClick={() => setTranspose(transpose + 1)} aria-label="Transpose up">♯</button>
      </div>
    </div>
  );
}
