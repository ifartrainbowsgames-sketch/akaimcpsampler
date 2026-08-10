export type PianoQuality = 'standard' | 'studio';

export interface PianoPreset {
  id: string;
  name: string;
  sampleSet: string;
  volume: number;
  reverb: number;
  brightness: number;
  release: number;
  stereoWidth: number;
}

export interface PianoDisplayState {
  presetName: string;
  lastNote: string;
  octave: number;
  transpose: number;
  velocity: number;
  sustain: boolean;
  midiStatus: string;
  audioStatus: string;
  loadProgress: number;
  loadLabel: string;
}

export interface PianoParams {
  velocity: number;
  volume: number;
  reverb: number;
  tone: number;
  release: number;
  stereoWidth: number;
  octave: number;
  transpose: number;
  sustain: boolean;
}

export const PIANO_MIN_NOTE = 21; // A0
export const PIANO_MAX_NOTE = 108; // C8
export const OCTAVE_MIN = -3;
export const OCTAVE_MAX = 3;
export const TRANSPOSE_MIN = -12;
export const TRANSPOSE_MAX = 12;

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export function isBlackKey(midi: number): boolean {
  const pc = midi % 12;
  return pc === 1 || pc === 3 || pc === 6 || pc === 8 || pc === 10;
}

export function midiToName(midi: number): string {
  const pc = midi % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[pc]}${octave}`;
}

/** White-key index from A0 (0 = A0). */
export function whiteKeyIndex(midi: number): number {
  let count = 0;
  for (let n = PIANO_MIN_NOTE; n < midi; n++) {
    if (!isBlackKey(n)) count++;
  }
  return count;
}

export function totalWhiteKeys(): number {
  let count = 0;
  for (let n = PIANO_MIN_NOTE; n <= PIANO_MAX_NOTE; n++) {
    if (!isBlackKey(n)) count++;
  }
  return count;
}

/** MIDI note for white-key index from A0. */
export function whiteKeyMidi(index: number): number {
  let count = -1;
  for (let n = PIANO_MIN_NOTE; n <= PIANO_MAX_NOTE; n++) {
    if (!isBlackKey(n)) count++;
    if (count === index) return n;
  }
  return PIANO_MAX_NOTE;
}

export function visibleWhiteKeyCount(width: number): number {
  if (width < 400) return Math.max(7, Math.min(9, Math.floor(width / 42)));
  if (width < 640) return Math.max(10, Math.min(14, Math.floor(width / 48)));
  if (width < 1024) return Math.max(14, Math.min(18, Math.floor(width / 52)));
  return Math.max(21, Math.min(28, Math.floor(width / 56)));
}
