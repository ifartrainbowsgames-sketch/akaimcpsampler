import { waveformPeaks } from './chop';

type Region = { start: number; end: number };

const cache = new WeakMap<AudioBuffer, Map<string, Float32Array>>();

function cacheKey(width: number, region?: Region): string {
  return `${width}|${region?.start ?? 0}|${region?.end ?? -1}`;
}

/** Cached peak summary — avoids rescanning the buffer when only playhead moves. */
export function cachedWaveformPeaks(
  buffer: AudioBuffer,
  width: number,
  region?: Region,
): Float32Array {
  let map = cache.get(buffer);
  if (!map) {
    map = new Map();
    cache.set(buffer, map);
  }
  const key = cacheKey(width, region);
  const hit = map.get(key);
  if (hit) return hit;
  const peaks = waveformPeaks(buffer, width, region);
  map.set(key, peaks);
  return peaks;
}

export function clearPeakCache(buffer?: AudioBuffer): void {
  if (buffer) cache.delete(buffer);
}
