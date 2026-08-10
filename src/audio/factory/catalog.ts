/**
 * Factory kit catalog — 100 WAV kits baked at build time.
 */

export interface FactoryKitMeta {
  id: string;
  name: string;
  category: 'drums' | 'bass' | 'perc' | 'synth' | 'fx';
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

const DRUM_TEMPLATES: { template: string; name: string; desc: string }[] = [
  { template: 'classic', name: 'Classic', desc: 'Punchy kicks, snares and hats' },
  { template: 'lofi', name: 'Lo-Fi', desc: 'Dusty warm drum machine' },
  { template: 'trap', name: 'Trap', desc: '808 kicks and snappy snares' },
  { template: 'house', name: 'House', desc: 'Four-on-the-floor club drums' },
  { template: 'techno', name: 'Techno', desc: 'Metallic hats and industrial punch' },
  { template: 'vinyl', name: 'Vinyl', desc: 'Warm drums with crackle' },
  { template: 'boom', name: 'Boom Bap', desc: 'Sample-style hip-hop drums' },
  { template: 'dnb', name: 'DnB', desc: 'Breakbeat kicks and tight snares' },
  { template: 'electro', name: 'Electro', desc: 'Sharp electronic drum hits' },
  { template: 'breakbeat', name: 'Breakbeat', desc: 'Broken rhythm drum kit' },
];

const BASS_TEMPLATES: { template: string; name: string; desc: string }[] = [
  { template: '808', name: '808', desc: 'Sub bass tones C1–D3' },
  { template: 'sub', name: 'Sub', desc: 'Deep sub bass one octave down' },
  { template: 'acid', name: 'Acid', desc: 'Saturated 303-style bass' },
  { template: 'fm', name: 'FM', desc: 'FM synthesis bass tones' },
];

const PERC_TEMPLATES: { template: string; name: string; desc: string }[] = [
  { template: 'world', name: 'World', desc: 'Congas, bells and hand percussion' },
  { template: 'latin', name: 'Latin', desc: 'Claves, shakers and timbales' },
  { template: 'electronic-perc', name: 'E-Perc', desc: 'Electronic percussion hits' },
];

const SYNTH_TEMPLATES: { template: string; name: string; desc: string }[] = [
  { template: 'stabs', name: 'Stabs', desc: 'Short synth chord stabs' },
  { template: 'plucks', name: 'Plucks', desc: 'Plucked synth tones' },
];

const FX_TEMPLATE = { template: 'fx', name: 'FX', desc: 'Impacts, risers and transitions' };

const BASS_PADS = ['C1', 'D1', 'E1', 'F1', 'G1', 'A1', 'B1', 'C2',
  'D2', 'E2', 'F2', 'G2', 'A2', 'B2', 'C3', 'D3'];

const SYNTH_PADS = ['Stab 1', 'Stab 2', 'Stab 3', 'Stab 4', 'Pluck 1', 'Pluck 2', 'Pluck 3', 'Pluck 4',
  'Pad 1', 'Pad 2', 'Lead', 'Lead 2', 'Chord', 'Chord 2', 'FX', 'FX 2'];

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
  pushVariants(kits, 'synth', 'synth', SYNTH_TEMPLATES, 5, SYNTH_PADS);
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

export const FACTORY_KITS: FactoryKitMeta[] = buildCatalog();

export const FACTORY_KIT_COUNT = FACTORY_KITS.length;

/** URL path to a pad WAV inside a kit folder. */
export function factoryPadWavUrl(kitId: string, padIndex: number): string {
  const n = String(padIndex + 1).padStart(2, '0');
  return `/factory/wav/${kitId}/pad-${n}.wav`;
}
