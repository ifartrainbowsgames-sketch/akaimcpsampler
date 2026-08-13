import type { StateCreator } from 'zustand';
import { engine } from '../../audio/engine';
import { ticksPerBar } from '../../audio/scheduler';
import { makeArrangement } from '../../audio/types';
import type { Arrangement, PlaylistClip, Project } from '../../audio/types';
import type { UIState } from '../store';

export type ArrangementSlice = Pick<UIState,
  | 'playArrangement' | 'addClip' | 'moveClip' | 'deleteClip'
  | 'toggleClipMute' | 'setArrangementLength' | 'seedArrangementFromSong'
>;

/** Current arrangement, or a fresh one if the project predates the feature. */
function currentArrangement(project: Project): Arrangement {
  return project.arrangement ?? makeArrangement();
}

/** Natural length in ticks of the pattern at (bank, slot). */
function patternLength(project: Project, bank: number, slot: number): number {
  const bars = project.sequences[bank]?.[slot]?.bars ?? 1;
  return bars * ticksPerBar(project.timeSignature);
}

export const createArrangementSlice: StateCreator<UIState, [], [], ArrangementSlice> = (set, get) => ({
  playArrangement() {
    // Seed from the linear song chain the first time so there's something to
    // hear immediately rather than an empty timeline.
    const { project } = get();
    if (currentArrangement(project).clips.length === 0 && project.song.length) {
      get().seedArrangementFromSong();
    }
    get().stop(true);
    engine.startArrangement();
    set({});
  },

  addClip(track, bank, slot, startTick) {
    const { project } = get();
    const arr = currentArrangement(project);
    const clip: PlaylistClip = {
      id: crypto.randomUUID(),
      track: Math.max(0, Math.min(track, arr.tracks - 1)),
      bank,
      slot,
      startTick: Math.max(0, Math.round(startTick)),
      lengthTicks: patternLength(project, bank, slot),
    };
    get().updateProject({ arrangement: { ...arr, clips: [...arr.clips, clip] } });
  },

  moveClip(id, track, startTick) {
    const { project } = get();
    const arr = currentArrangement(project);
    const clips = arr.clips.map((c) =>
      c.id === id
        ? {
            ...c,
            track: Math.max(0, Math.min(track, arr.tracks - 1)),
            startTick: Math.max(0, Math.round(startTick)),
          }
        : c
    );
    get().updateProject({ arrangement: { ...arr, clips } });
  },

  deleteClip(id) {
    const { project } = get();
    const arr = currentArrangement(project);
    get().updateProject({ arrangement: { ...arr, clips: arr.clips.filter((c) => c.id !== id) } });
  },

  toggleClipMute(id) {
    const { project } = get();
    const arr = currentArrangement(project);
    const clips = arr.clips.map((c) => (c.id === id ? { ...c, muted: !c.muted } : c));
    get().updateProject({ arrangement: { ...arr, clips } });
  },

  setArrangementLength(bars) {
    const { project } = get();
    const arr = currentArrangement(project);
    get().updateProject({ arrangement: { ...arr, lengthBars: Math.max(1, Math.round(bars)) } });
  },

  seedArrangementFromSong() {
    const { project } = get();
    const arr = currentArrangement(project);
    const bar = ticksPerBar(project.timeSignature);
    let cursor = 0;
    const clips: PlaylistClip[] = project.song.map((step) => {
      const len = patternLength(project, step.bank, step.slot);
      const clip: PlaylistClip = {
        id: crypto.randomUUID(),
        track: 0,
        bank: step.bank,
        slot: step.slot,
        startTick: cursor,
        lengthTicks: len,
      };
      cursor += len;
      return clip;
    });
    // Grow the timeline so the seeded clips fit.
    const neededBars = Math.max(arr.lengthBars, Math.ceil(cursor / bar));
    get().updateProject({ arrangement: { ...arr, lengthBars: neededBars, clips } });
  },
});
