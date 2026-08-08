import type { Pad } from './types';
import { stretchFactorFromWarp, timeStretchBuffer } from './stretch';

/** Mirror a sample for reverse playback. */
export function reverseBuffer(ctx: BaseAudioContext, src: AudioBuffer): AudioBuffer {
  const out = ctx.createBuffer(src.numberOfChannels, src.length, src.sampleRate);
  for (let ch = 0; ch < src.numberOfChannels; ch++) {
    const from = src.getChannelData(ch);
    const to = out.getChannelData(ch);
    for (let i = 0, j = from.length - 1; i < from.length; i++, j--) {
      to[i] = from[j];
    }
  }
  return out;
}

export function warpRate(pad: Pad, buffer: AudioBuffer, bpm: number): number {
  if (pad.warpAmount === 'off') return 1;
  if (pad.warpAmount === 'seq') {
    const sampleSeconds = buffer.duration;
    const targetSeconds = (pad.beats * 60) / bpm;
    return sampleSeconds / targetSeconds;
  }
  return 100 / pad.warpAmount;
}

export interface ResolvedPlayback {
  buffer: AudioBuffer;
  rate: number;
  padOverride: Partial<Pad> | null;
}

/** Shared by live engine and offline export so both paths stay in sync. */
export function resolvePlayback(
  ctx: BaseAudioContext,
  pad: Pad,
  buffer: AudioBuffer,
  bpm: number,
  stretchCache: Map<string, AudioBuffer>,
  region?: { start: number; end: number },
): ResolvedPlayback {
  const start = region?.start ?? pad.start;
  const end = region?.end ?? (pad.end || buffer.length);
  const regionDur = (end - start) / buffer.sampleRate;

  if (pad.warpMode === 'stretch' && pad.warpAmount !== 'off') {
    const factor = stretchFactorFromWarp(pad.warpAmount, pad.beats, bpm, regionDur);
    if (Math.abs(factor - 1) > 0.02) {
      const key = `${pad.sampleId}-${start}-${end}-${factor.toFixed(3)}-${pad.warpAmount}-${pad.beats}-${bpm}`;
      let stretched = stretchCache.get(key);
      if (!stretched) {
        stretched = timeStretchBuffer(ctx as AudioContext, buffer, start, end, factor);
        stretchCache.set(key, stretched);
      }
      return {
        buffer: stretched,
        rate: 1,
        padOverride: { start: 0, end: stretched.length, loopStart: 0 },
      };
    }
    return { buffer, rate: 1, padOverride: null };
  }

  return { buffer, rate: warpRate(pad, buffer, bpm), padOverride: null };
}

/** Trim region for reverse buffers — frame offsets mirror around length. */
export function reverseRegion(
  bufferLength: number,
  region: { start: number; end: number } | undefined,
  pad: Pad,
): { start: number; end: number } | undefined {
  if (!pad.reverse) return region;
  const L = bufferLength;
  if (region) return { start: L - region.end, end: L - region.start };
  const s = pad.start;
  const e = pad.end || L;
  return { start: L - e, end: L - s };
}
