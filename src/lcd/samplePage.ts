import type { Pad, Project } from '../audio/types';
import { PAGE_GROUPS, type KParam, type Page } from './pages';
import { chopPage } from './chopPage';

const TAB_LABELS = ['Trim', 'Tune', 'Filter'] as const;

export function sampleTabLabel(groupIndex: number, chopActive: boolean): string {
  if (groupIndex === 0 && chopActive) return 'Chop';
  return TAB_LABELS[groupIndex];
}

export function resolveSamplePage(
  bGroup: 1 | 2 | 3,
  bPage: [number, number, number],
  chopActive: boolean,
  selectedSlice: number,
  pad: Pad,
  project: Project,
): { page: Page; params: KParam[] } {
  const group = PAGE_GROUPS[bGroup - 1];
  let page = group[bPage[bGroup - 1] % group.length];
  if (chopActive && bGroup === 1 && page.title === 'Trim') {
    page = chopPage(selectedSlice);
  }
  return { page, params: page.params(pad, project) };
}
