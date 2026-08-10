/**
 * Factory kit catalog — 100 WAV kits baked at build time.
 * Melodic kits are the largest slice — keys, pads, leads, chords, etc.
 */

import type { Polyphony } from '../types';

export interface FactoryKitMeta {
  id: string;
  name: string;
  category: 'drums' | 'bass' | 'perc' | 'melodic' | 'fx';
  description: string;
  source: 'files';
  /** Synthesis recipe id passed to synthCore.recipeForTemplate. */
  template: string;
  /** 0-based variation within the template (timbral offset). */
  variant: number;
  padNames: string[];
  defaultGain?: number;
}

const DRUM_PADS = ['Kick', 'Kick 2', 'Snare', 'Snare 2', 'Hat', 'Hat O', 'Hat C', 'Perc',
  'Clap', 'Clap 2', 'Tom L', 'Tom M', 'Tom H', 'Tom HH', 'Rim', 'Crash'];

/** Core drum kits — melodic content gets the majority of slots. */
const DRUM_TEMPLATES: { template: string; name: string; desc: string }[] = [
  { template: 'classic', name: 'Classic', desc: 'Punchy kicks, snares and hats' },
  { template: 'lofi', name: 'Lo-Fi', desc: 'Dusty warm drum machine' },
  { template: 'trap', name: 'Trap', desc: '808 kicks and snappy snares' },
];

const BASS_TEMPLATES: { template: string; name: string; desc: string }[] = [
  { template: '808', name: '808', desc: 'Sub bass tones C1–D3' },
];

const PERC_TEMPLATES: { template: string; name: string; desc: string }[] = [
  { template: 'world', name: 'World', desc: 'Congas, bells and hand percussion' },
];

/** 14 melodic templates × 5 variants = 70 kits (70% of the library). */
const MELODIC_TEMPLATES: { template: string; name: string; desc: string }[] = [
  { template: 'keys', name: 'Keys', desc: 'Piano-style melodic tones C4–D6' },
  { template: 'pads', name: 'Pads', desc: 'Lush sustained pads — loop-ready' },
  { template: 'leads', name: 'Leads', desc: 'Bright mono synth leads' },
  { template: 'chords', name: 'Chords', desc: 'Major triad chord hits' },
  { template: 'minor', name: 'Minor', desc: 'Minor triad chord hits' },
  { template: 'stabs', name: 'Stabs', desc: 'Short synth chord stabs' },
  { template: 'plucks', name: 'Plucks', desc: 'Plucked melodic synth tones' },
  { template: 'bells', name: 'Bells', desc: 'Mallet and bell tones' },
  { template: 'flute', name: 'Flute', desc: 'Soft breathy flute tones' },
  { template: 'brass', name: 'Brass', desc: 'Brass section stabs' },
  { template: 'arp', name: 'Arp', desc: 'Fast arpeggio plucks' },
  { template: 'strings', name: 'Strings', desc: 'Slow-attack string pads — loop-ready' },
  { template: 'organ', name: 'Organ', desc: 'Drawbar organ tones — loop-ready' },
  { template: 'ambient', name: 'Ambient', desc: 'Evolving ambient textures — loop-ready' },
];

const FX_TEMPLATE = { template: 'fx', name: 'FX', desc: 'Impacts, risers and transitions' };

const BASS_PADS = ['C1', 'D1', 'E1', 'F1', 'G1', 'A1', 'B1', 'C2',
  'D2', 'E2', 'F2', 'G2', 'A2', 'B2', 'C3', 'D3'];

const MELODIC_PADS = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5',
  'D5', 'E5', 'F5', 'G5', 'A5', 'B5', 'C6', 'D6'];

const FX_PADS = ['Impact', 'Impact 2', 'Riser', 'Riser 2', 'Drop', 'Sweep', 'Whoosh', 'Noise',
  'Sub Hit', 'Clang', 'Reverse', 'Glitch', 'Laser', 'Siren', 'Boom', 'Zap'];

function pushVariants(
  out: FactoryKitMeta[],
  prefix: string,
  category: FactoryKitMeta['category'],
  templates: { template: string; name: string; desc: string }[],
  count: number,
  padNames: string[],
  defaultGain?: number,
) {
  for (const t of templates) {
    for (let v = 0; v < count; v++) {
      const n = v + 1;
      out.push({
        id: `${prefix}-${t.template}-${String(n).padStart(2, '0')}`,
        name: `${t.name} ${n}`,
        category,
        description: `${t.desc} — kit ${n}`,
        source: 'files',
        template: t.template,
        variant: v,
        padNames,
        defaultGain,
      });
    }
  }
}

function buildCatalog(): FactoryKitMeta[] {
  const kits: FactoryKitMeta[] = [];
  pushVariants(kits, 'drums', 'drums', DRUM_TEMPLATES, 5, DRUM_PADS);
  pushVariants(kits, 'bass', 'bass', BASS_TEMPLATES, 5, BASS_PADS, -3);
  pushVariants(kits, 'perc', 'perc', PERC_TEMPLATES, 5, DRUM_PADS);
  pushVariants(kits, 'melodic', 'melodic', MELODIC_TEMPLATES, 5, MELODIC_PADS);
  for (let v = 0; v < 5; v++) {
    const n = v + 1;
    kits.push({
      id: `fx-fx-${String(n).padStart(2, '0')}`,
      name: `${FX_TEMPLATE.name} ${n}`,
      category: 'fx',
      description: `${FX_TEMPLATE.desc} — kit ${n}`,
      source: 'files',
      template: FX_TEMPLATE.template,
      variant: v,
      padNames: FX_PADS,
    });
  }
  return kits;
}

const CATEGORY_ORDER: Record<FactoryKitMeta['category'], number> = {
  melodic: 0,
  bass: 1,
  drums: 2,
  perc: 3,
  fx: 4,
};

export const FACTORY_KITS: FactoryKitMeta[] = buildCatalog().sort(
  (a, b) => CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category]
    || a.name.localeCompare(b.name),
);

/** Pad defaults applied when loading a melodic factory kit. */
export function factoryKitPadDefaults(meta: FactoryKitMeta): {
  loop: boolean;
  loopStartRatio: number;
  polyphony: Polyphony;
} {
  if (meta.category !== 'melodic') {
    return { loop: false, loopStartRatio: 0, polyphony: 'mono' };
  }
  const loopTemplates = new Set(['pads', 'strings', 'organ', 'ambient']);
  const polyTemplates = new Set(['keys', 'chords', 'minor', 'stabs', 'plucks', 'bells', 'arp']);
  return {
    loop: loopTemplates.has(meta.template),
    loopStartRatio: loopTemplates.has(meta.template) ? 0.28 : 0,
    polyphony: polyTemplates.has(meta.template) ? 'poly' : 'mono',
  };
}

export const FACTORY_KIT_COUNT = FACTORY_KITS.length;

/** URL path to a pad WAV inside a kit folder. */
export function factoryPadWavUrl(kitId: string, padIndex: number): string {
  const n = String(padIndex + 1).padStart(2, '0');
  return `/factory/wav/${kitId}/pad-${n}.wav`;
}
