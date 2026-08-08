/**
 * Offline granular time-stretch (overlap-add). Preserves pitch while changing
 * duration — used when pad.warpMode === 'stretch'.
 */
export function timeStretchBuffer(
  ctx: AudioContext,
  src: AudioBuffer,
  startFrame: number,
  endFrame: number,
  /** Output length / input length. 2 = twice as long (slower). */
  stretchFactor: number,
): AudioBuffer {
  const factor = Math.max(0.25, Math.min(4, stretchFactor));
  const channels = src.numberOfChannels;
  const sr = src.sampleRate;
  const inLen = Math.max(1, endFrame - startFrame);
  const outLen = Math.max(1, Math.floor(inLen * factor));
  const out = ctx.createBuffer(channels, outLen, sr);

  const grainSize = 1024;
  const hopIn = grainSize >> 1;
  const hopOut = Math.max(1, Math.floor(hopIn * factor));

  const window = new Float32Array(grainSize);
  for (let i = 0; i < grainSize; i++) {
    window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / grainSize));
  }

  for (let ch = 0; ch < channels; ch++) {
    const inData = src.getChannelData(ch);
    const outData = out.getChannelData(ch);
    const norm = new Float32Array(outLen);

    let inPos = 0;
    let outPos = 0;
    while (outPos < outLen) {
      for (let i = 0; i < grainSize; i++) {
        const srcIdx = startFrame + inPos + i;
        const dstIdx = outPos + i;
        if (srcIdx >= startFrame + inLen || dstIdx >= outLen) continue;
        const w = window[i];
        outData[dstIdx] += inData[srcIdx] * w;
        norm[dstIdx] += w;
      }
      inPos += hopIn;
      outPos += hopOut;
      if (inPos + grainSize >= inLen) break;
    }

    for (let i = 0; i < outLen; i++) {
      if (norm[i] > 0.0001) outData[i] /= norm[i];
    }
  }

  return out;
}

/** Duration multiplier for stretch mode from warp settings. */
export function stretchFactorFromWarp(
  warpAmount: number | 'off' | 'seq',
  beats: number,
  bpm: number,
  bufferDurationSec: number,
): number {
  if (warpAmount === 'off') return 1;
  if (warpAmount === 'seq') {
    const target = (beats * 60) / bpm;
    return Math.max(0.25, Math.min(4, target / bufferDurationSec));
  }
  return Math.max(0.25, Math.min(4, warpAmount / 100));
}
