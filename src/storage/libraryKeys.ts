const FREESOUND_KEY = 'sampler.freesoundApiKey';

export function getFreesoundApiKey(): string {
  return localStorage.getItem(FREESOUND_KEY) ?? '';
}

export function setFreesoundApiKey(key: string) {
  if (key.trim()) localStorage.setItem(FREESOUND_KEY, key.trim());
  else localStorage.removeItem(FREESOUND_KEY);
}
