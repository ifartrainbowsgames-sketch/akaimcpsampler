/**
 * Load factory kits — prefers pre-baked WAV files, falls back to live synthesis.
 */

import { FACTORY_KITS, type FactoryKitMeta, factoryPadWavUrl } from './catalog';
import { browserSynthCtx, synthesizeKit, type SynthBuffer } from './synthCore';

export type { FactoryKitMeta };
export { FACTORY_KITS, FACTORY_KIT_COUNT } from './catalog';
export { FACTORY_DEMOS, FACTORY_DEMO_COUNT, demoDurationSec, isLongDemo, LONG_DEMO_BAR_THRESHOLD } from './demos';

function synthToAudioBuffer(ctx: AudioContext, buf: SynthBuffer): AudioBuffer {
  const out = ctx.createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    out.getChannelData(ch).set(buf.getChannelData(ch));
  }
  return out;
}

/** Try loading 16 WAV files from /factory/wav/{kitId}/. */
export async function loadFactoryKitWavs(
  ctx: AudioContext,
  kitId: string,
): Promise<AudioBuffer[] | null> {
  const meta = FACTORY_KITS.find((k) => k.id === kitId);
  if (!meta) return null;

  const buffers: AudioBuffer[] = [];
  for (let i = 0; i < 16; i++) {
    try {
      const res = await fetch(factoryPadWavUrl(kitId, i, meta.real));
      if (!res.ok) return null;
      const ab = await res.arrayBuffer();
      buffers.push(await ctx.decodeAudioData(ab.slice(0)));
    } catch {
      return null;
    }
  }
  return buffers;
}

/** Synthesize a kit in-browser (fallback when WAV assets are missing). */
export function synthesizeFactoryKit(
  ctx: AudioContext,
  kitId: string,
): { id: string; name: string; buffers: AudioBuffer[] } | null {
  const meta = FACTORY_KITS.find((k) => k.id === kitId);
  if (!meta) return null;

  const synth = browserSynthCtx(ctx);
  const raw = synthesizeKit(synth, meta.template, meta.variant);
  return {
    id: kitId,
    name: meta.name,
    buffers: raw.map((b) => synthToAudioBuffer(ctx, b)),
  };
}

/** Load kit: WAV files first, then live synthesis. */
export async function generateFactoryKit(
  ctx: AudioContext,
  kitId: string,
): Promise<{ id: string; name: string; buffers: AudioBuffer[] } | null> {
  const meta = FACTORY_KITS.find((k) => k.id === kitId);
  if (!meta) return null;

  const wavs = await loadFactoryKitWavs(ctx, kitId);
  if (wavs) {
    return { id: kitId, name: meta.name, buffers: wavs };
  }
  if (meta.real) return null; // real kits have no synth fallback
  return synthesizeFactoryKit(ctx, kitId);
}
