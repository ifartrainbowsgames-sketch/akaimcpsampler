import type { Pad, Project } from '../audio/types';
import { PAGE_GROUPS, type KParam } from './pages';

/**
 * Q-Link style free knob assignment. Reuses the exact same KParam
 * definitions already declared in PAGE_GROUPS (pages.ts) — this only
 * indexes them by stable coordinates, it does not duplicate any
 * get/set/display logic. Knob FX is intentionally excluded: its params
 * are raw [number,number,number] + label arrays, a different shape, and
 * it already has its own dedicated K1-K3 context via the KNOB FX screen.
 */
export interface AssignableParamRef {
  id: string;
  pageTitle: string;
  groupIndex: number;
  pageIndex: number;
  paramIndex: 0 | 1 | 2;
}

export const ASSIGNABLE_PARAMS: AssignableParamRef[] = PAGE_GROUPS.flatMap((group, groupIndex) =>
  group.flatMap((page, pageIndex) =>
    ([0, 1, 2] as const).map((paramIndex) => ({
      id: `${groupIndex}.${pageIndex}.${paramIndex}`,
      pageTitle: page.title,
      groupIndex,
      pageIndex,
      paramIndex,
    }))
  )
);

/** Resolve a stable assignment id to a live KParam for the current pad/project. */
export function resolveAssignedParam(id: string, pad: Pad, project: Project): KParam | null {
  const ref = ASSIGNABLE_PARAMS.find((p) => p.id === id);
  if (!ref) return null;
  const page = PAGE_GROUPS[ref.groupIndex][ref.pageIndex];
  return page.params(pad, project)[ref.paramIndex] ?? null;
}
