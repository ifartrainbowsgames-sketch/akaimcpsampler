import type { ScreenId } from '../state/store';

/**
 * Secondary function printed under each pad. Pad 1 is bottom-left.
 * These are the app's keyboard shortcuts and all of them must exist.
 */
export const SHIFT_FUNCTIONS: string[] = [
  'FULL LEVEL',   // 1
  'HALF SEQ',     // 2
  'DOUBLE SEQ',   // 3
  'COUNT-IN',     // 4
  'COMPRESSOR',   // 5
  'HALF SPEED',   // 6
  'DOUBLE SPEED', // 7
  'MIDI CONFIG',  // 8
  'FADER',        // 9
  'REC QUANTIZE', // 10
  'RESAMPLE',     // 11
  'SONG',         // 12
  'TRIM SAMPLE',  // 13
  'TIME CORRECT', // 14
  'WARP',         // 15
  'PROJECT',      // 16
];

/** Pads that open a menu screen rather than performing an action. */
export const SHIFT_SCREENS: Record<number, ScreenId | undefined> = {
  4: 'comp',        // pad 5
  7: 'midi',        // pad 8
  8: 'fadermenu',   // pad 9
  11: 'song',       // pad 12
  13: 'timecorr',   // pad 14
  15: 'project',    // pad 16
};
