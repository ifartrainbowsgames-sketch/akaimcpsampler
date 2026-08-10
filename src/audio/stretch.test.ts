import { describe, expect, it } from 'vitest';
import { stretchFactorFromWarp } from './stretch';

describe('stretchFactorFromWarp', () => {
  it('returns 1 when warp is off', () => {
    expect(stretchFactorFromWarp('off', 4, 120, 2)).toBe(1);
  });

  it('computes factor from beats/bpm/buffer duration in seq mode', () => {
    // target = (4 beats * 60) / 120 bpm = 2s; buffer is 2s -> factor 1
    expect(stretchFactorFromWarp('seq', 4, 120, 2)).toBe(1);
    // target = (8 beats * 60) / 120 bpm = 4s; buffer is 2s -> factor 2
    expect(stretchFactorFromWarp('seq', 8, 120, 2)).toBe(2);
  });

  it('clamps seq mode factor to [0.25, 4]', () => {
    // target would be far below buffer duration -> clamp to 0.25
    expect(stretchFactorFromWarp('seq', 1, 120, 100)).toBe(0.25);
    // target would be far above buffer duration -> clamp to 4
    expect(stretchFactorFromWarp('seq', 1000, 120, 0.1)).toBe(4);
  });

  it('converts a numeric percentage to a factor', () => {
    expect(stretchFactorFromWarp(100, 4, 120, 2)).toBe(1);
    expect(stretchFactorFromWarp(200, 4, 120, 2)).toBe(2);
    expect(stretchFactorFromWarp(50, 4, 120, 2)).toBe(0.5);
  });

  it('clamps numeric percentage factor to [0.25, 4]', () => {
    expect(stretchFactorFromWarp(10, 4, 120, 2)).toBe(0.25);
    expect(stretchFactorFromWarp(1000, 4, 120, 2)).toBe(4);
  });
});
