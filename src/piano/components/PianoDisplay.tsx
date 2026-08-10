import { usePianoStore } from '../store/pianoStore';

export function PianoDisplay() {
  const presetName = usePianoStore((s) => s.presetName);
  const lastNote = usePianoStore((s) => s.lastNote);
  const octave = usePianoStore((s) => s.octave);
  const transpose = usePianoStore((s) => s.transpose);
  const velocity = usePianoStore((s) => s.velocity);
  const sustain = usePianoStore((s) => s.sustain);
  const midiStatus = usePianoStore((s) => s.midiStatus);
  const audioStatus = usePianoStore((s) => s.audioStatus);
  const loadLabel = usePianoStore((s) => s.loadLabel);

  const status = loadLabel || audioStatus;

  return (
    <div className="piano-lcd" role="status" aria-live="polite">
      <div className="piano-lcd__row piano-lcd__row--title">
        <span className="piano-lcd__preset">{presetName.toUpperCase()}</span>
        <span className="piano-lcd__midi">{midiStatus}</span>
      </div>
      <div className="piano-lcd__row">
        <span className="piano-lcd__note">{lastNote}</span>
        <span>OCT {octave >= 0 ? `+${octave}` : octave}</span>
        <span>TRANS {transpose >= 0 ? `+${transpose}` : transpose}</span>
      </div>
      <div className="piano-lcd__row piano-lcd__row--sub">
        <span>VEL {velocity}</span>
        <span className={sustain ? 'piano-lcd__on' : ''}>SUSTAIN {sustain ? 'ON' : 'OFF'}</span>
        <span className="piano-lcd__status">{status}</span>
      </div>
    </div>
  );
}
