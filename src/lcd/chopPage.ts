import type { Pad } from '../audio/types';
import type { KParam, Page } from './pages';

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const CHOP_TYPES = ['threshold', 'regions4', 'regions8', 'regions16', 'manual'] as const;
const CHOP_LABELS: Record<string, string> = {
  threshold: 'THRESH',
  regions4: 'REG 4',
  regions8: 'REG 8',
  regions16: 'REG 16',
  manual: 'MANUAL',
};

/**
 * When Chop is active the Trim controls are replaced by Chop controls, exactly
 * as on the reference hardware. K1/K2 edit the *selected slice*, not the whole
 * sample. See BUILD_PLAN.md Appendix A.2.
 */
export function chopPage(selectedSlice: number): Page {
  return {
    title: 'Chop',
    params: (pad: Pad): KParam[] => {
      const slice = pad.slices[selectedSlice];
      const span = slice ? Math.max(1, slice.end - slice.start) : 1;

      return [
        {
          name: 'Slice Start',
          display: slice ? `${slice.start}` : '—',
          norm: slice ? clamp01((slice.start % span) / span) : 0,
          set: (n, update, i) => {
            if (!slice) return;
            const slices = pad.slices.slice();
            const width = slices[selectedSlice].end - slices[selectedSlice].start;
            const shift = Math.round((n - 0.5) * width * 0.5);
            slices[selectedSlice] = {
              start: Math.max(0, slice.start + shift),
              end: slice.end,
            };
            update(i, { slices });
          },
        },
        {
          name: 'Slice End',
          display: slice ? `${slice.end}` : '—',
          norm: slice ? 1 : 0,
          set: (n, update, i) => {
            if (!slice) return;
            const slices = pad.slices.slice();
            const width = slice.end - slice.start;
            const shift = Math.round((n - 0.5) * width * 0.5);
            slices[selectedSlice] = {
              start: slice.start,
              end: Math.max(slice.start + 1, slice.end + shift),
            };
            update(i, { slices });
          },
        },
        {
          name: 'Chop Type',
          display: CHOP_LABELS[pad.chopType] ?? pad.chopType,
          norm: clamp01(CHOP_TYPES.indexOf(pad.chopType) / (CHOP_TYPES.length - 1)),
          set: (n, update, i) => {
            const idx = Math.round(n * (CHOP_TYPES.length - 1));
            update(i, { chopType: CHOP_TYPES[idx] });
          },
        },
      ];
    },
  };
}

export function thresholdParam(pad: Pad): KParam {
  return {
    name: 'Threshold',
    display: `${pad.chopThreshold}%`,
    norm: clamp01(pad.chopThreshold / 100),
    set: (n, update, i) => update(i, { chopThreshold: Math.round(n * 100) }),
  };
}
