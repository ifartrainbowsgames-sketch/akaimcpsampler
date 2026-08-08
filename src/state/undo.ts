import type { Project } from '../audio/types';

/**
 * Bounded undo history. The hardware doesn't make slice edits undoable; we do,
 * because there's no reason to inherit that.
 */
const LIMIT = 50;

export class History {
  private past: string[] = [];
  private future: string[] = [];

  push(p: Project) {
    this.past.push(JSON.stringify(p));
    if (this.past.length > LIMIT) this.past.shift();
    this.future = [];
  }

  canUndo() { return this.past.length > 1; }
  canRedo() { return this.future.length > 0; }

  undo(current: Project): Project | null {
    if (!this.canUndo()) return null;
    this.future.push(JSON.stringify(current));
    this.past.pop();
    const prev = this.past[this.past.length - 1];
    return prev ? (JSON.parse(prev) as Project) : null;
  }

  redo(current: Project): Project | null {
    const next = this.future.pop();
    if (!next) return null;
    this.past.push(JSON.stringify(current));
    return JSON.parse(next) as Project;
  }

  clear() { this.past = []; this.future = []; }
}

export const history = new History();
