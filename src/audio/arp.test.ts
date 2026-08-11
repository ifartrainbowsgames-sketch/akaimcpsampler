import { describe, it, expect } from 'vitest';
import { arpSequence } from './arp';

describe('arpSequence', () => {
  it('returns empty for no held notes', () => {
    expect(arpSequence([], 'up', 1)).toEqual([]);
  });

  it('up = ascending, sorted and de-duplicated', () => {
    expect(arpSequence([67, 60, 64, 60], 'up', 1)).toEqual([60, 64, 67]);
  });

  it('down = descending', () => {
    expect(arpSequence([60, 64, 67], 'down', 1)).toEqual([67, 64, 60]);
  });

  it('updown = up then down without repeating the endpoints', () => {
    expect(arpSequence([60, 64, 67], 'updown', 1)).toEqual([60, 64, 67, 64]);
  });

  it('octaves expand the held set by +12 per octave', () => {
    expect(arpSequence([60, 64], 'up', 2)).toEqual([60, 64, 72, 76]);
  });

  it('single note updown stays a single note', () => {
    expect(arpSequence([60], 'updown', 1)).toEqual([60]);
  });

  it('random returns the full pool (clock chooses the index)', () => {
    expect(arpSequence([60, 64, 67], 'random', 1).sort((a, b) => a - b)).toEqual([60, 64, 67]);
  });
});
