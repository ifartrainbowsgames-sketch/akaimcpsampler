import { engine } from '../../audio/engine';
import { autosave } from '../../storage/projects';
import { writeSample } from '../../storage/opfs';
import { FACTORY_KITS, generateFactoryKit } from '../../audio/factory/kits';
import { factoryKitPadDefaults } from '../../audio/factory/catalog';
import type { Pad, Project } from '../../audio/types';

/** Helpers shared across multiple store slices. */

export async function applyFactoryKitToBank(
  project: Project,
  bankIndex: number,
  kitId: string,
  ctx: AudioContext,
): Promise<Project> {
  const kit = await generateFactoryKit(ctx, kitId);
  if (!kit) return project;
  const meta = FACTORY_KITS.find((k) => k.id === kitId);
  const padDefaults = meta ? factoryKitPadDefaults(meta) : null;

  const bank = project.banks[bankIndex].map((pad) => pad);
  for (let i = 0; i < 16; i++) {
    const buffer = kit.buffers[i];
    const id = crypto.randomUUID();
    engine.putBuffer(id, buffer);
    const wav = await engine.bufferToWav(buffer).arrayBuffer();
    await writeSample(id, wav);
    const label = meta?.padNames[i] ?? `Pad ${i + 1}`;
    const loopStart = padDefaults?.loop
      ? Math.floor(buffer.length * padDefaults.loopStartRatio)
      : 0;
    bank[i] = {
      ...bank[i],
      sampleId: id,
      sampleName: `${meta?.name ?? kit.name}-${label}`.slice(0, 24),
      start: 0,
      end: buffer.length,
      loopStart,
      loop: padDefaults?.loop ?? false,
      slices: [],
      gain: meta?.defaultGain ?? 0,
      polyphony: padDefaults?.polyphony ?? 'mono',
    };
  }

  return {
    ...project,
    banks: project.banks.map((b, bi) => (bi === bankIndex ? bank : b)),
  };
}

export function chopTypeForSeconds(sec: number): Pad['chopType'] {
  if (sec >= 20) return 'regions16';
  if (sec >= 6) return 'regions8';
  if (sec >= 2) return 'regions4';
  return 'threshold';
}

let autosaveTimer: number | null = null;
export function scheduleAutosave(p: Project) {
  if (autosaveTimer !== null) clearTimeout(autosaveTimer);
  autosaveTimer = window.setTimeout(() => autosave(p), 800);
}
