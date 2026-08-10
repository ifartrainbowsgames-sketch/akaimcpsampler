import { usePianoStore } from '../store/pianoStore';
import { PIANO_PRESETS } from '../audio/PianoPresets';

export function PianoPresetSelector() {
  const presetId = usePianoStore((s) => s.presetId);
  const setPreset = usePianoStore((s) => s.setPreset);

  return (
    <label className="piano-select-wrap">
      <span className="piano-select-wrap__lbl">PRESET</span>
      <select
        className="piano-select"
        value={presetId}
        onChange={(e) => setPreset(e.target.value)}
        aria-label="Piano preset"
      >
        {PIANO_PRESETS.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
    </label>
  );
}
