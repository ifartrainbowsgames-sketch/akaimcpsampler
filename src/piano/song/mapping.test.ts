import { describe, expect, it } from 'vitest';
import { melodicPadToMidi, midiToMelodicPad, songToSeqEvents, totalSongBars } from './mapping';

describe('midiToMelodicPad', () => {
  it('maps the valid C4-D6 range (midi 60-75) to pads 0-15', () => {
    expect(midiToMelodicPad(60)).toBe(0);
    expect(midiToMelodicPad(67)).toBe(7);
    expect(midiToMelodicPad(75)).toBe(15);
  });

  it('returns null just outside the valid range', () => {
    expect(midiToMelodicPad(59)).toBeNull();
    expect(midiToMelodicPad(76)).toBeNull();
  });

  it('round-trips with melodicPadToMidi', () => {
    for (let pad = 0; pad <= 15; pad++) {
      expect(midiToMelodicPad(melodicPadToMidi(pad))).toBe(pad);
    }
  });
});

describe('songToSeqEvents', () => {
  const patterns = [
    { id: 'a', bars: 1, notes: [{ step: 0, midi: 60, vel: 100 }] },
    { id: 'b', bars: 2, notes: [{ step: 4, midi: 62, vel: 90 }] },
  ];

  it('flattens repeats in arrangement order, sorted by tick then pad', () => {
    const events = songToSeqEvents(patterns, [
      { patternId: 'a', repeats: 1 },
      { patternId: 'b', repeats: 2 },
    ]);
    // pattern 'a' contributes 1 event, pattern 'b' contributes 2 (repeats=2)
    expect(events).toHaveLength(3);
    expect(events.every((e) => e.pad !== undefined)).toBe(true);
    // sorted ascending by tick
    for (let i = 1; i < events.length; i++) {
      expect(events[i].tick).toBeGreaterThanOrEqual(events[i - 1].tick);
    }
  });

  it('skips arrangement blocks referencing unknown patterns', () => {
    const events = songToSeqEvents(patterns, [{ patternId: 'missing', repeats: 3 }]);
    expect(events).toEqual([]);
  });

  it('advances the bar cursor per repeat so later repeats do not overlap ticks', () => {
    const events = songToSeqEvents(
      [{ id: 'a', bars: 1, notes: [{ step: 0, midi: 60, vel: 100 }] }],
      [{ patternId: 'a', repeats: 2 }],
    );
    expect(events).toHaveLength(2);
    expect(events[0].tick).not.toBe(events[1].tick);
  });
});

describe('totalSongBars', () => {
  const patterns = [
    { id: 'a', bars: 2 },
    { id: 'b', bars: 4 },
  ];

  it('sums bars * repeats across the arrangement', () => {
    expect(
      totalSongBars(patterns, [
        { patternId: 'a', repeats: 1 },
        { patternId: 'b', repeats: 2 },
      ]),
    ).toBe(2 * 1 + 4 * 2);
  });

  it('ignores unknown pattern references', () => {
    expect(totalSongBars(patterns, [{ patternId: 'missing', repeats: 5 }])).toBe(0);
  });
});
