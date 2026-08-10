import type { PianoQuality } from '../types/piano';

/** Tone.js Salamander Grand Piano — open multisample set. */
export const SALAMANDER_BASE = 'https://tonejs.github.io/audio/salamander/';

/** Full studio multisample map (Salamander). */
export const STUDIO_SAMPLE_URLS: Record<string, string> = {
  A0: 'A0.mp3',
  C1: 'C1.mp3',
  'D#1': 'Ds1.mp3',
  'F#1': 'Fs1.mp3',
  A1: 'A1.mp3',
  C2: 'C2.mp3',
  'D#2': 'Ds2.mp3',
  'F#2': 'Fs2.mp3',
  A2: 'A2.mp3',
  C3: 'C3.mp3',
  'D#3': 'Ds3.mp3',
  'F#3': 'Fs3.mp3',
  A3: 'A3.mp3',
  C4: 'C4.mp3',
  'D#4': 'Ds4.mp3',
  'F#4': 'Fs4.mp3',
  A4: 'A4.mp3',
  C5: 'C5.mp3',
  'D#5': 'Ds5.mp3',
  'F#5': 'Fs5.mp3',
  A5: 'A5.mp3',
  C6: 'C6.mp3',
  'D#6': 'Ds6.mp3',
  'F#6': 'Fs6.mp3',
  A6: 'A6.mp3',
  C7: 'C7.mp3',
  'D#7': 'Ds7.mp3',
  'F#7': 'Fs7.mp3',
  A7: 'A7.mp3',
  C8: 'C8.mp3',
};

/** Reduced set — fewer downloads, pitch-shift between zones. */
export const STANDARD_SAMPLE_URLS: Record<string, string> = {
  A0: 'A0.mp3',
  A2: 'A2.mp3',
  C4: 'C4.mp3',
  'F#4': 'Fs4.mp3',
  A4: 'A4.mp3',
  C5: 'C5.mp3',
  'F#5': 'Fs5.mp3',
  A5: 'A5.mp3',
  C7: 'C7.mp3',
};

export function sampleUrlsForQuality(quality: PianoQuality): Record<string, string> {
  return quality === 'studio' ? STUDIO_SAMPLE_URLS : STANDARD_SAMPLE_URLS;
}

export function sampleCount(quality: PianoQuality): number {
  return Object.keys(sampleUrlsForQuality(quality)).length;
}

/** Pre-warm browser cache for sample URLs (non-blocking progress). */
export async function prefetchSamples(
  quality: PianoQuality,
  onProgress: (pct: number) => void,
): Promise<void> {
  const urls = sampleUrlsForQuality(quality);
  const entries = Object.entries(urls);
  let done = 0;
  await Promise.all(
    entries.map(async ([, file]) => {
      try {
        const res = await fetch(`${SALAMANDER_BASE}${file}`, { cache: 'force-cache' });
        await res.arrayBuffer();
      } catch {
        /* offline / blocked — Tone.Sampler will retry */
      }
      done++;
      onProgress(Math.round((done / entries.length) * 100));
    }),
  );
}
