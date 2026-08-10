import { describe, expect, it } from 'vitest';
import {
  createDefaultSong,
  createPattern,
  getPattern,
  patternStepCount,
  PIANO_DEFAULT_BARS,
  PIANO_MAX_BARS,
  PIANO_STEPS_PER_BAR,
} from './types';

describe('patternStepCount', () => {
  it('multiplies bars by steps-per-bar', () => {
    expect(patternStepCount(1)).toBe(PIANO_STEPS_PER_BAR);
    expect(patternStepCount(4)).toBe(4 * PIANO_STEPS_PER_BAR);
  });
});

describe('createPattern', () => {
  it('defaults to PIANO_DEFAULT_BARS with no notes', () => {
    const p = createPattern('Verse');
    expect(p.name).toBe('Verse');
    expect(p.bars).toBe(PIANO_DEFAULT_BARS);
    expect(p.notes).toEqual([]);
    expect(p.id).toMatch(/^pat-/);
  });

  it('clamps bars into [1, PIANO_MAX_BARS]', () => {
    expect(createPattern('Short', 0).bars).toBe(1);
    expect(createPattern('Short', -5).bars).toBe(1);
    expect(createPattern('Long', 999).bars).toBe(PIANO_MAX_BARS);
  });

  it('uses the requested bar count when in range', () => {
    expect(createPattern('Mid', 8).bars).toBe(8);
  });
});

describe('createDefaultSong', () => {
  it('builds an Intro/Verse/Chorus arrangement referencing real pattern ids', () => {
    const song = createDefaultSong();
    expect(song.bpm).toBe(90);
    expect(song.patterns.map((p) => p.name)).toEqual(['Intro', 'Verse', 'Chorus']);
    expect(song.arrangement).toHaveLength(3);
    for (const block of song.arrangement) {
      expect(getPattern(song, block.patternId)).toBeDefined();
    }
  });
});

describe('getPattern', () => {
  it('returns undefined for an unknown pattern id', () => {
    const song = createDefaultSong();
    expect(getPattern(song, 'nonexistent')).toBeUndefined();
  });
});
