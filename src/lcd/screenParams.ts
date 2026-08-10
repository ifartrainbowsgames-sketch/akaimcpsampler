import type { ScreenId } from '../state/store';
import type { KParam } from './pages';
import { resolveSamplePage } from './samplePage';
import type { Pad, Project } from '../audio/types';
import { KNOB_FX } from '../audio/fx/knobfx';
import { useStore } from '../state/store';
import { TICKS_PER_16TH } from '../audio/types';

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export interface ScreenParamContext {
  screen: ScreenId;
  bGroup: 1 | 2 | 3;
  bPage: [number, number, number];
  project: Project;
  bank: number;
  selectedPad: number;
  pad: Pad;
  chopActive: boolean;
  selectedSlice: number;
  updatePad: (i: number, patch: Partial<Pad>) => void;
}

/** Resolve K1–K3 parameters for the active LCD screen. */
export function resolveScreenParams(ctx: ScreenParamContext): KParam[] {
  const s = useStore.getState();

  switch (ctx.screen) {
    case 'sample': {
      const { params } = resolveSamplePage(
        ctx.bGroup, ctx.bPage, ctx.chopActive, ctx.selectedSlice, ctx.pad, ctx.project,
      );
      return params;
    }

    case 'comp': {
      const { attack: a, release: r, amount: amt, color, inBoost } = s.compressor;
      return [
        {
          name: 'Attack',
          display: `${(0.1 + a * 150).toFixed(1)} ms`,
          norm: a,
          set: (n) => s.setCompressorSettings(n, r, amt, color, s.compressor.bypass, inBoost),
        },
        {
          name: 'Release',
          display: `${Math.round(3 + r * 297)} ms`,
          norm: r,
          set: (n) => s.setCompressorSettings(a, n, amt, color, s.compressor.bypass, inBoost),
        },
        {
          name: s.shift ? 'In Boost' : 'Amount',
          display: s.shift ? `${Math.round(inBoost * 100)}%` : `${Math.round(amt * 100)}%`,
          norm: s.shift ? inBoost : amt,
          set: (n) => s.shift
            ? s.setCompressorSettings(a, r, amt, color, s.compressor.bypass, n)
            : s.setCompressorSettings(a, r, n, color, s.compressor.bypass, inBoost),
        },
      ];
    }

    case 'knobfx': {
      const def = KNOB_FX.find((f) => f.id === s.knobFX) ?? KNOB_FX[0];
      const vals = s.shift && def.shiftParams ? s.knobFXShiftParams : s.knobFXParams;
      const labels = s.shift && def.shiftParams ? def.shiftParams : def.params;
      return [0, 1, 2].map((k) => ({
        name: labels[k],
        display: labels[k] === '—' ? '—' : `${Math.round(vals[k] * 100)}%`,
        norm: vals[k],
        set: (n) => (s.shift && def.shiftParams
          ? s.setKnobFXShiftParam(k as 0 | 1 | 2, n)
          : s.setKnobFXParam(k as 0 | 1 | 2, n)),
      }));
    }

    case 'flexbeat':
      return [
        {
          name: 'Mode',
          display: s.flexBeat.mode === 'oneshot' ? 'ONE SHOT' : 'LOOP',
          norm: s.flexBeat.mode === 'oneshot' ? 0 : 1,
          set: (n) => s.setFlexBeat({ mode: n < 0.5 ? 'oneshot' : 'loop' }),
        },
        {
          name: 'Quantize',
          display: s.flexBeat.quantize ? 'ON' : 'OFF',
          norm: s.flexBeat.quantize ? 1 : 0,
          set: (n) => s.setFlexBeat({ quantize: n >= 0.5 }),
        },
        {
          name: 'Mix',
          display: `${Math.round(s.flexBeat.mix * 100)}%`,
          norm: s.flexBeat.mix,
          set: (n) => s.setFlexBeat({ mix: n }),
        },
      ];

    case 'stepedit': {
      const seq = ctx.project.sequences[ctx.bank][s.seqSlot];
      const atTick = s.stepEditTick * ctx.project.quantize;
      const atEvents = seq.events
        .map((e, i) => ({ e, i }))
        .filter(({ e }) => Math.abs(e.tick - atTick) < ctx.project.quantize / 2);
      const current = atEvents[s.stepEditEvent]?.e;
      if (s.shift) {
        const [num, den] = ctx.project.timeSignature;
        return [
          {
            name: 'Numerator',
            display: String(num),
            norm: clamp01((num - 1) / 15),
            set: (n) => {
              const v = Math.round(n * 15) + 1;
              s.updateProject({ timeSignature: [v, den] });
            },
          },
          {
            name: 'Denominator',
            display: String(den),
            norm: clamp01((den - 1) / 15),
            set: (n) => {
              const v = Math.round(n * 15) + 1;
              s.updateProject({ timeSignature: [num, v] });
            },
          },
          { name: '—', display: '—', norm: 0, set: () => {} },
        ];
      }
      return [
        {
          name: 'Length',
          display: `${seq.bars}b`,
          norm: clamp01((seq.bars - 1) / 15),
          set: (n) => {
            const bars = Math.round(n * 15) + 1;
            const banks = ctx.project.sequences.map((row, bi) =>
              bi === ctx.bank
                ? row.map((seqRow, si) => (si === s.seqSlot ? { ...seqRow, bars } : seqRow))
                : row
            );
            s.updateProject({ sequences: banks });
          },
        },
        {
          name: 'Q',
          display: `1/${16 / (ctx.project.quantize / (TICKS_PER_16TH / 16))}`,
          norm: clamp01([TICKS_PER_16TH, TICKS_PER_16TH / 2, TICKS_PER_16TH / 4, TICKS_PER_16TH / 8, TICKS_PER_16TH / 16, TICKS_PER_16TH / 32].indexOf(ctx.project.quantize) / 5),
          set: (n) => {
            const divs = [TICKS_PER_16TH, TICKS_PER_16TH / 2, TICKS_PER_16TH / 4, TICKS_PER_16TH / 8, TICKS_PER_16TH / 16, TICKS_PER_16TH / 32];
            s.updateProject({ quantize: divs[Math.round(n * 5)] ?? TICKS_PER_16TH });
          },
        },
        {
          name: 'Velocity',
          display: current ? String(current.velocity) : '—',
          norm: current ? current.velocity / 127 : 0,
          set: (n) => { if (current) s.setStepEditVelocity(Math.round(n * 127)); },
        },
      ];
    }

    case 'timecorr':
      return [
        {
          name: 'Q Grid',
          display: `1/${16 / (ctx.project.quantize / (TICKS_PER_16TH / 16))}`,
          norm: clamp01([TICKS_PER_16TH, TICKS_PER_16TH / 2, TICKS_PER_16TH / 4, TICKS_PER_16TH / 8, TICKS_PER_16TH / 16, TICKS_PER_16TH / 32].indexOf(ctx.project.quantize) / 5),
          set: (n) => {
            const divs = [TICKS_PER_16TH, TICKS_PER_16TH / 2, TICKS_PER_16TH / 4, TICKS_PER_16TH / 8, TICKS_PER_16TH / 16, TICKS_PER_16TH / 32];
            s.updateProject({ quantize: divs[Math.round(n * 5)] ?? TICKS_PER_16TH });
          },
        },
        {
          name: 'Shift',
          display: `${s.timeCorrectShift > 0 ? '+' : ''}${s.timeCorrectShift}`,
          norm: clamp01((s.timeCorrectShift + 48) / 96),
          set: (n) => s.setTimeCorrectShift(Math.round(n * 96 - 48)),
        },
        {
          name: 'Swing',
          display: `${ctx.project.swing.toFixed(1)}%`,
          norm: clamp01((ctx.project.swing - 50) / 17),
          set: (n) => s.updateProject({ swing: 50 + n * 17 }),
        },
      ];

    case 'inputcfg':
      return [
        {
          name: 'Threshold',
          display: `${Math.round(s.inputConfig.threshold)} dB`,
          norm: clamp01((s.inputConfig.threshold + 96) / 96),
          set: (n) => s.setInputConfig({ threshold: Math.round(n * 96 - 96) }),
        },
        {
          name: 'Rec Length',
          display: s.inputConfig.recLength,
          norm: s.inputConfig.recLength === 'FREE' ? 0 : 1,
          set: (n) => s.setInputConfig({ recLength: n < 0.5 ? 'FREE' : 'SEQ' }),
        },
        {
          name: 'Rec FX',
          display: s.inputConfig.recFx ? 'ON' : 'OFF',
          norm: s.inputConfig.recFx ? 1 : 0,
          set: (n) => s.setInputConfig({ recFx: n >= 0.5 }),
        },
      ];

    case 'fadermenu':
      return [];

    default:
      return [];
  }
}
