import type { Project } from '../audio/types';

const INDEX_KEY = 'sampler.projects';
const CURRENT_KEY = 'sampler.current';

type Index = Record<string, { name: string; saved: number }>;

function readIndex(): Index {
  try {
    return JSON.parse(localStorage.getItem(INDEX_KEY) ?? '{}') as Index;
  } catch {
    return {};
  }
}

export function saveProject(p: Project): void {
  localStorage.setItem(`sampler.project.${p.id}`, JSON.stringify(p));
  const idx = readIndex();
  idx[p.id] = { name: p.name, saved: Date.now() };
  localStorage.setItem(INDEX_KEY, JSON.stringify(idx));
}

export function loadProject(id: string): Project | null {
  try {
    const raw = localStorage.getItem(`sampler.project.${id}`);
    return raw ? (JSON.parse(raw) as Project) : null;
  } catch {
    return null;
  }
}

export function listProjects(): { id: string; name: string; saved: number }[] {
  return Object.entries(readIndex())
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.saved - a.saved);
}

export function deleteProject(id: string): void {
  localStorage.removeItem(`sampler.project.${id}`);
  const idx = readIndex();
  delete idx[id];
  localStorage.setItem(INDEX_KEY, JSON.stringify(idx));
}

/**
 * Background autosave, mirroring the hardware: work is continuously saved so a
 * reload restores the last state. Explicit save copies to a named slot.
 */
export function autosave(p: Project): void {
  try {
    localStorage.setItem(CURRENT_KEY, JSON.stringify(p));
  } catch {
    /* quota exceeded — fail quietly, the named saves still work */
  }
}

export function loadAutosave(): Project | null {
  try {
    const raw = localStorage.getItem(CURRENT_KEY);
    return raw ? (JSON.parse(raw) as Project) : null;
  } catch {
    return null;
  }
}
