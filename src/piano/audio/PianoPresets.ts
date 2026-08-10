import type { PianoPreset } from '../types/piano';

export const PIANO_PRESETS: PianoPreset[] = [
  {
    id: 'grand',
    name: 'Grand Piano',
    sampleSet: 'salamander',
    volume: 0.85,
    reverb: 0.38,
    brightness: 0.55,
    release: 0.45,
    stereoWidth: 0.7,
  },
  {
    id: 'soft',
    name: 'Soft Piano',
    sampleSet: 'salamander',
    volume: 0.72,
    reverb: 0.52,
    brightness: 0.35,
    release: 0.65,
    stereoWidth: 0.55,
  },
  {
    id: 'bright',
    name: 'Bright Piano',
    sampleSet: 'salamander',
    volume: 0.88,
    reverb: 0.28,
    brightness: 0.82,
    release: 0.35,
    stereoWidth: 0.75,
  },
  {
    id: 'dark',
    name: 'Dark Piano',
    sampleSet: 'salamander',
    volume: 0.78,
    reverb: 0.48,
    brightness: 0.22,
    release: 0.55,
    stereoWidth: 0.6,
  },
];

export function getPreset(id: string): PianoPreset {
  return PIANO_PRESETS.find((p) => p.id === id) ?? PIANO_PRESETS[0];
}
