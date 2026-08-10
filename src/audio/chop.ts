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

/**
 * Estimate the tempo of an AudioBuffer by analysing onset intervals.
 *
 * Algorithm:
 *  1. Compute RMS envelope (reuses the existing helper).
 *  2. Detect upward threshold crossings (onsets).
 *  3. Build a histogram of inter-onset intervals (IOIs).
 *  4. Pick the most common IOI → convert to BPM.
 *  5. Fold into the 60–180 BPM range.
 *
 * Returns 0 if detection fails.
 */
export function detectBpm(buffer: AudioBuffer): number {
  const data = buffer.getChannelData(0);
  const env = rmsEnvelope(data);

  let peak = 0;
  for (const v of env) if (v > peak) peak = v;
  if (peak === 0) return 0;

  const level = peak * 0.3;
  const refractoryFrames = Math.floor((0.08 * buffer.sampleRate) / HOP);
  const onsets: number[] = [];
  let above = false;
  let lastOnset = -Infinity;

  for (let f = 0; f < env.length; f++) {
    if (!above && env[f] > level) {
      above = true;
      if (f - lastOnset > refractoryFrames) {
        onsets.push(f);
        lastOnset = f;
      }
    } else if (above && env[f] < level * 0.6) {
      above = false;
    }
  }

  if (onsets.length < 2) return 0;

  const hopSec = HOP / buffer.sampleRate;
  const intervals: number[] = [];
  for (let i = 1; i < onsets.length; i++) {
    intervals.push((onsets[i] - onsets[i - 1]) * hopSec);
  }

  // Histogram with 20ms bins over 0.25–2.0 s range.
  const binWidth = 0.02;
  const bins = new Map<number, number>();
  for (const ioi of intervals) {
    if (ioi < 0.25 || ioi > 2.0) continue;
    const bin = Math.round(ioi / binWidth);
    bins.set(bin, (bins.get(bin) ?? 0) + 1);
  }

  let bestBin = -1;
  let bestCount = 0;
  bins.forEach((count, bin) => {
    if (count > bestCount) { bestCount = count; bestBin = bin; }
  });

  if (bestBin < 0) return 0;

  const ioi = bestBin * binWidth;
  let bpm = 60 / ioi;
  // Fold into 60–180 BPM.
  while (bpm < 60) bpm *= 2;
  while (bpm > 180) bpm /= 2;
  bpm = Math.round(bpm * 10) / 10;

  return bpm >= 40 && bpm <= 200 ? bpm : 0;
}

/** Peak-per-pixel waveform summary for drawing. */
export function waveformPeaks(
  buffer: AudioBuffer,
  width: number,
  region?: { start: number; end: number },
): Float32Array {
  const data = buffer.getChannelData(0);
  const from = region?.start ?? 0;
  const to = region?.end ?? data.length;
  const span = Math.max(1, to - from);
  const peaks = new Float32Array(width);
  const step = span / width;
  for (let i = 0; i < width; i++) {
    const start = from + Math.floor(i * step);
    const end = Math.min(to, from + Math.floor((i + 1) * step));
    let max = 0;
    for (let j = start; j < end; j++) {
      const v = Math.abs(data[j]);
      if (v > max) max = v;
    }
    peaks[i] = max;
  }
  return peaks;
}
