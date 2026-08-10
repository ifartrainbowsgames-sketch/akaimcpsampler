const FREESOUND_KEY = 'sampler.freesoundApiKey';

export function getFreesoundApiKey(): string {
  return localStorage.getItem(FREESOUND_KEY)?.trim() ?? '';
}

export function hasFreesoundApiKey(): boolean {
  return getFreesoundApiKey().length > 0;
}

export function setFreesoundApiKey(key: string) {
  if (key.trim()) localStorage.setItem(FREESOUND_KEY, key.trim());
  else localStorage.removeItem(FREESOUND_KEY);
}

/** Always false — the built-in shared key has been removed for security. */
export function usingBuiltInFreesoundKey(): boolean {
  return false;
}
