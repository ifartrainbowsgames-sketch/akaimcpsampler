import type { Project } from '../audio/types';

const INDEX_KEY = 'sampler.projects';
const CURRENT_KEY = 'sampler.current';

function isValidProject(p: unknown): p is Project {
  if (!p || typeof p !== 'object') return false;
  const proj = p as Record<string, unknown>;
  return (
    typeof proj.id === 'string' &&
    typeof proj.name === 'string' &&
    Array.isArray(proj.banks) &&
    Array.isArray(proj.sequences)
  );
}

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
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValidProject(parsed) ? parsed : null;
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
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValidProject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
