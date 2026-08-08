export type ChopLoadMode = 'auto' | 'manual';

const CHOP_LOAD_KEY = 'sampler.chopLoadMode';

export function getChopLoadMode(): ChopLoadMode | null {
  const v = localStorage.getItem(CHOP_LOAD_KEY);
  if (v === 'auto' || v === 'manual') return v;
  return null;
}

export function setChopLoadMode(mode: ChopLoadMode) {
  localStorage.setItem(CHOP_LOAD_KEY, mode);
}
