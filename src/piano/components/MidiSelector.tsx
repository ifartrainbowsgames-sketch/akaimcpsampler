import { useEffect, useState } from 'react';
import { usePianoStore } from '../store/pianoStore';
import { pianoMidi } from '../audio/MidiEngine';

export function MidiSelector() {
  const deviceId = usePianoStore((s) => s.midiDeviceId);
  const selectMidiDevice = usePianoStore((s) => s.selectMidiDevice);
  const [labels, setLabels] = useState<string[]>([]);
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    const refresh = () => {
      setIds(pianoMidi.deviceNames);
      setLabels(pianoMidi.deviceLabels);
    };
    refresh();
    void pianoMidi.connect().then(refresh);
  }, []);

  if (!pianoMidi.available) {
    return <span className="piano-midi-off">MIDI N/A</span>;
  }

  return (
    <label className="piano-select-wrap">
      <span className="piano-select-wrap__lbl">MIDI</span>
      <select
        className="piano-select"
        value={deviceId ?? ''}
        onChange={(e) => selectMidiDevice(e.target.value || null)}
        aria-label="MIDI input device"
      >
        <option value="">OFF</option>
        {ids.map((id, i) => (
          <option key={id} value={id}>{labels[i] ?? id}</option>
        ))}
      </select>
    </label>
  );
}
