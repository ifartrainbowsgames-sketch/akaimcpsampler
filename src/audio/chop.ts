import { MAX_SLICES } from './types';
import type { Slice } from './types';

/**
 * Onset detection over an RMS envelope.
 *
 * 1. Compute a short-window RMS envelope.
 * 2. Mark a slice where the envelope crosses the threshold going upward.
 * 3. Enforce a refractory period so one hit doesn't split into three.
 * 4. Snap each boundary back to the nearest zero crossing to avoid clicks.
 */
const HOP = 512;
const REFRACTORY_MS = 50;

function rmsEnvelope(data: Float32Array): Float32Array {
  const frames = Math.floor(data.length / HOP);
  const env = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    const off = f * HOP;
    for (let i = 0; i < HOP; i++) {
      const s = data[off + i];
      sum += s * s;
    }
    env[f] = Math.sqrt(sum / HOP);
  }
  return env;
}

function nearestZeroCrossing(data: Float32Array, frame: number, search = 512): number {
  const start = Math.max(1, frame - search);
  const end = Math.min(data.length - 1, frame + search);
  let best = frame;
  let bestDist = Infinity;
  for (let i = start; i < end; i++) {
    if ((data[i - 1] <= 0 && data[i] > 0) || (data[i - 1] >= 0 && data[i] < 0)) {
      const d = Math.abs(i - frame);
      if (d < bestDist) { bestDist = d; best = i; }
    }
  }
  return best;
}

export function chopByThreshold(
  buffer: AudioBuffer,
  thresholdPct: number,
  region?: { start: number; end: number }
): Slice[] {
  const data = buffer.getChannelData(0);
  const from = region?.start ?? 0;
  const to = region?.end ?? buffer.length;

  const env = rmsEnvelope(data);
  let peak = 0;
  for (const v of env) if (v > peak) peak = v;
  if (peak === 0) return [{ start: from, end: to }];

  // Higher threshold => fewer slices.
  const level = peak * (thresholdPct / 100) * 0.9;
  const refractoryFrames = (REFRACTORY_MS / 1000) * buffer.sampleRate;

  const onsets: number[] = [];
  let above = false;
  let lastOnset = -Infinity;

  for (let f = 0; f < env.length; f++) {
    const framePos = f * HOP;
    if (framePos < from || framePos > to) continue;
    if (!above && env[f] > level) {
      above = true;
      if (framePos - lastOnset > refractoryFrames) {
        onsets.push(nearestZeroCrossing(data, framePos));
        lastOnset = framePos;
      }
    } else if (above && env[f] < level * 0.6) {
      above = false;
    }
  }

  if (onsets.length === 0) return [{ start: from, end: to }];
  if (onsets[0] > from) onsets.unshift(from);

  const capped = onsets.slice(0, MAX_SLICES);
  return capped.map((s, i) => ({
    start: s,
    end: i < capped.length - 1 ? capped[i + 1] : to,
  }));
}

export function chopByRegions(
  buffer: AudioBuffer,
  count: 4 | 8 | 16,
  region?: { start: number; end: number }
): Slice[] {
  const from = region?.start ?? 0;
  const to = region?.end ?? buffer.length;
  const size = (to - from) / count;
  return Array.from({ length: count }, (_, i) => ({
    start: Math.round(from + i * size),
    end: Math.round(from + (i + 1) * size),
  }));
}

/** Split a slice in half. Later slices renumber +1 automatically by position. */
export function splitSlice(slices: Slice[], index: number): Slice[] {
  const s = slices[index];
  if (!s) return slices;
  const mid = Math.round((s.start + s.end) / 2);
  const out = slices.slice();
  out.splice(index, 1, { start: s.start, end: mid }, { start: mid, end: s.end });
  return out.slice(0, MAX_SLICES);
}

/** Merge a slice into the previous one. */
export function mergeSlice(slices: Slice[], index: number): Slice[] {
  if (index <= 0 || !slices[index]) return slices;
  const out = slices.slice();
  out[index - 1] = { start: out[index - 1].start, end: out[index].end };
  out.splice(index, 1);
  return out;
}

/** Peak-per-pixel waveform summary for drawing. */
export function waveformPeaks(buffer: AudioBuffer, width: number): Float32Array {
  const data = buffer.getChannelData(0);
  const peaks = new Float32Array(width);
  const step = data.length / width;
  for (let i = 0; i < width; i++) {
    const start = Math.floor(i * step);
    const end = Math.min(data.length, Math.floor((i + 1) * step));
    let max = 0;
    for (let j = start; j < end; j++) {
      const v = Math.abs(data[j]);
      if (v > max) max = v;
    }
    peaks[i] = max;
  }
  return peaks;
}
