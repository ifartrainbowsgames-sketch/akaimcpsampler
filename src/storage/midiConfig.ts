import type { MidiConfig } from '../midi/midi';
import { DEFAULT_MIDI } from '../midi/midi';

const MIDI_KEY = 'sampler.midiConfig';

export function getMidiConfig(): MidiConfig {
  try {
    const raw = localStorage.getItem(MIDI_KEY);
    if (!raw) return { ...DEFAULT_MIDI };
    return { ...DEFAULT_MIDI, ...JSON.parse(raw) as Partial<MidiConfig> };
  } catch {
    return { ...DEFAULT_MIDI };
  }
}

export function saveMidiConfig(config: MidiConfig) {
  localStorage.setItem(MIDI_KEY, JSON.stringify(config));
}
