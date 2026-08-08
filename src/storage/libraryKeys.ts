const FREESOUND_KEY = 'sampler.freesoundApiKey';

/** Built-in key from Vercel env (VITE_FREESOUND_API_KEY at build time). */
function builtInKey(): string {
  return import.meta.env.VITE_FREESOUND_API_KEY?.trim() ?? '';
}

export function getFreesoundApiKey(): string {
  return localStorage.getItem(FREESOUND_KEY)?.trim() || builtInKey();
}

export function hasFreesoundApiKey(): boolean {
  return getFreesoundApiKey().length > 0;
}

export function setFreesoundApiKey(key: string) {
  if (key.trim()) localStorage.setItem(FREESOUND_KEY, key.trim());
  else localStorage.removeItem(FREESOUND_KEY);
}

export function usingBuiltInFreesoundKey(): boolean {
  return !localStorage.getItem(FREESOUND_KEY) && builtInKey().length > 0;
}
