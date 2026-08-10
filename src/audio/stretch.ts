/**
 * Offline granular time-stretch (overlap-add with WSOLA-style pitch correction).
 * Uses a 2048-sample Hann window with 75% overlap for smooth, artifact-free
 * stretching across the 0.25–4× range. Pitch is preserved via nearest-neighbour
 * grain selection within a search window.
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

  // Larger grain = fewer artifacts. 2048 at 44100 Hz = ~46ms per grain.
  const grainSize = 2048;
  // 75% overlap gives a clean Hann-window reconstruction sum.
  const hopOut = grainSize >> 2; // 512 samples
  const hopIn = Math.max(1, Math.round(hopOut / factor));
  // Search window for WSOLA pitch correction (±half a hop).
  const searchHalf = Math.max(0, Math.min(hopIn >> 1, 128));

  // Pre-compute Hann window.
  const hann = new Float32Array(grainSize);
  for (let i = 0; i < grainSize; i++) {
    hann[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (grainSize - 1)));
  }

  for (let ch = 0; ch < channels; ch++) {
    const inData = src.getChannelData(ch);
    const outData = out.getChannelData(ch);
    const norm = new Float32Array(outLen);

    let inPos = 0;
    let outPos = 0;
    let prevGrainStart = startFrame; // used for WSOLA cross-correlation

    while (outPos < outLen) {
      // WSOLA: find best matching grain within ±searchHalf of the nominal position.
      let bestOffset = 0;
      if (searchHalf > 0 && outPos > 0) {
        let bestCorr = -Infinity;
        for (let d = -searchHalf; d <= searchHalf; d++) {
          const candidateStart = startFrame + inPos + d;
          if (candidateStart < startFrame || candidateStart + grainSize > startFrame + inLen) continue;
          // Cross-correlate candidate grain with previous grain's tail.
          let corr = 0;
          const prevTailStart = prevGrainStart + grainSize - hopOut;
          for (let k = 0; k < hopOut; k++) {
            const prevIdx = prevTailStart + k;
            const candIdx = candidateStart + k;
            if (prevIdx >= 0 && prevIdx < inData.length && candIdx >= 0 && candIdx < inData.length) {
              corr += inData[prevIdx] * inData[candIdx];
            }
          }
          if (corr > bestCorr) {
            bestCorr = corr;
            bestOffset = d;
          }
        }
      }

      const grainStart = startFrame + inPos + bestOffset;
      prevGrainStart = grainStart;

      for (let i = 0; i < grainSize; i++) {
        const srcIdx = grainStart + i;
        const dstIdx = outPos + i;
        if (srcIdx < startFrame || srcIdx >= startFrame + inLen || dstIdx >= outLen) continue;
        const w = hann[i];
        outData[dstIdx] += inData[srcIdx] * w;
        norm[dstIdx] += w;
      }

      inPos += hopIn;
      outPos += hopOut;
      // Safety: stop if we've exhausted the input region.
      if (inPos >= inLen) break;
    }

    // Normalise by the accumulated window weight to avoid amplitude bumps.
    for (let i = 0; i < outLen; i++) {
      if (norm[i] > 1e-6) outData[i] /= norm[i];
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
