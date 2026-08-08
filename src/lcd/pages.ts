import type { Pad, Project } from '../audio/types';

export interface KParam {
  name: string;
  /** Formatted for display. */
  display: string;
  /** 0..1 for the UI control. */
  norm: number;
  set(norm: number, update: UpdatePad, padIndex: number): void;
}

type UpdatePad = (i: number, patch: Partial<Pad>) => void;

export interface Page {
  title: string;
  params(pad: Pad, project: Project): KParam[];
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function pct(name: string, value: number, key: keyof Pad, max: number): KParam {
  return {
    name,
    display: `${((value / max) * 100).toFixed(1)}%`,
    norm: clamp01(value / max),
    set: (n, update, i) => update(i, { [key]: Math.round(n * max) } as Partial<Pad>),
  };
}

function int0to127(name: string, value: number, apply: (v: number) => Partial<Pad>): KParam {
  return {
    name,
    display: String(Math.round(value)).padStart(3, '0'),
    norm: clamp01(value / 127),
    set: (n, update, i) => update(i, apply(Math.round(n * 127))),
  };
}

/**
 * B1 group — Trim / Mix / Amp Env
 * B2 group — Tune / Play
 * B3 group — Filter / Filt Env
 *
 * Ranges follow the reference hardware exactly. See BUILD_PLAN.md Appendix A.1.
 */
export const PAGE_GROUPS: Page[][] = [
  // ---- B1 ----
  [
    {
      title: 'Trim',
      params: (pad) => {
        const len = Math.max(1, pad.end || 1);
        return [
          pct('Start', pad.start, 'start', len),
          pct('End', pad.end, 'end', len),
          pct('Loop', pad.loopStart, 'loopStart', len),
        ];
      },
    },
    {
      title: 'Mix',
      params: (pad) => [
        {
          name: 'Volume',
          display: pad.gain <= -74 ? '-INF' : `${pad.gain.toFixed(2)} dB`,
          norm: clamp01((pad.gain + 74) / 80),
          set: (n, update, i) => update(i, { gain: n * 80 - 74 }),
        },
        {
          name: 'Kit Vol',
          display: '0.00 dB',
          norm: 0.925,
          set: () => {},
        },
        {
          name: 'Pan',
          display:
            pad.pan === 0 ? 'C'
              : pad.pan < 0 ? `${Math.round(-pad.pan * 50)}L`
              : `${Math.round(pad.pan * 50)}R`,
          norm: clamp01((pad.pan + 1) / 2),
          set: (n, update, i) => update(i, { pan: n * 2 - 1 }),
        },
      ],
    },
    {
      title: 'Amp Env',
      params: (pad) => [
        int0to127('Attack', pad.ampEnv.attack, (v) => ({
          ampEnv: { ...pad.ampEnv, attack: v },
        })),
        int0to127(pad.noteOn ? 'Release' : 'Decay', pad.ampEnv.decay, (v) => ({
          ampEnv: { ...pad.ampEnv, decay: v },
        })),
        int0to127('Vel Sens', pad.ampEnv.amount, (v) => ({
          ampEnv: { ...pad.ampEnv, amount: v },
        })),
      ],
    },
  ],

  // ---- B2 ----
  [
    {
      title: 'Tune',
      params: (pad) => [
        {
          name: 'Semi',
          display: `${pad.semi > 0 ? '+' : ''}${pad.semi}`,
          norm: clamp01((pad.semi + 24) / 48),
          set: (n, update, i) => update(i, { semi: Math.round(n * 48 - 24) }),
        },
        {
          name: 'Fine',
          display: `${pad.fine > 0 ? '+' : ''}${pad.fine} ct`,
          norm: clamp01((pad.fine + 90) / 180),
          set: (n, update, i) => update(i, { fine: Math.round(n * 180 - 90) }),
        },
        {
          name: 'Warp',
          display:
            pad.warpAmount === 'off' ? 'OFF'
              : pad.warpAmount === 'seq' ? 'SEQ'
              : `${pad.warpAmount}%`,
          norm:
            pad.warpAmount === 'off' ? 0
              : pad.warpAmount === 'seq' ? 1
              : clamp01((pad.warpAmount - 50) / 150),
          set: (n, update, i) => {
            if (n < 0.02) update(i, { warpAmount: 'off' });
            else if (n > 0.98) update(i, { warpAmount: 'seq' });
            else update(i, { warpAmount: Math.round(50 + n * 150) });
          },
        },
      ],
    },
    {
      title: 'Play',
      params: (pad) => [
        {
          name: 'Polyphony',
          display: pad.polyphony.toUpperCase(),
          norm: pad.polyphony === 'poly' ? 1 : 0,
          set: (n, update, i) => update(i, { polyphony: n > 0.5 ? 'poly' : 'mono' }),
        },
        {
          name: 'Mute Grp',
          display: pad.muteGroup === null ? 'OFF' : String(pad.muteGroup).padStart(2, '0'),
          norm: clamp01((pad.muteGroup ?? 0) / 16),
          set: (n, update, i) => {
            const v = Math.round(n * 16);
            update(i, { muteGroup: v === 0 ? null : v });
          },
        },
        {
          name: 'Offset',
          display: `${pad.offset}%`,
          norm: clamp01(pad.offset / 100),
          set: (n, update, i) => update(i, { offset: Math.round(n * 100) }),
        },
      ],
    },
  ],

  // ---- B3 ----
  [
    {
      title: 'Filter',
      params: (pad) => [
        int0to127('Cutoff', pad.cutoff, (v) => ({ cutoff: v })),
        int0to127('Reso', pad.reso, (v) => ({ reso: v })),
        {
          name: 'Type',
          display: pad.filterType.toUpperCase(),
          norm: clamp01(FILTER_TYPES.indexOf(pad.filterType) / (FILTER_TYPES.length - 1)),
          set: (n, update, i) => {
            const idx = Math.round(n * (FILTER_TYPES.length - 1));
            update(i, { filterType: FILTER_TYPES[idx] });
          },
        },
      ],
    },
    {
      title: 'Filt Env',
      params: (pad) => [
        int0to127('Attack', pad.filterEnv.attack, (v) => ({
          filterEnv: { ...pad.filterEnv, attack: v },
        })),
        int0to127(pad.noteOn ? 'Release' : 'Decay', pad.filterEnv.decay, (v) => ({
          filterEnv: { ...pad.filterEnv, decay: v },
        })),
        int0to127('Depth', pad.filterEnv.amount, (v) => ({
          filterEnv: { ...pad.filterEnv, amount: v },
        })),
      ],
    },
  ],
];

const FILTER_TYPES = [
  'off', 'classic', 'lpf2', 'lpf4', 'hpf2', 'hpf4', 'bpf2', 'bpf4',
] as const;
