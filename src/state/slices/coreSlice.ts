import type { StateCreator } from 'zustand';
import { makeProject, migrateProject, type Pad, type Project } from '../../audio/types';
import { engine } from '../../audio/engine';
import { loadAutosave, loadProject } from '../../storage/projects';
import { readSample } from '../../storage/opfs';
import { downloadBlob } from '../../audio/export';
import { midi } from '../../midi/midi';
import { history } from '../undo';
import type { UIState, ScreenId } from '../store';
import { scheduleAutosave } from './shared';

const initial = migrateProject(loadAutosave() ?? makeProject('Startup'));

export type CoreSlice = Pick<UIState,
  | 'booted' | 'project' | 'bank' | 'seqSlot' | 'queuedSeqSlot' | 'selectedPad' | 'pausedAt'
  | 'screen' | 'bGroup' | 'bPage' | 'shift'
  | 'boot' | 'setScreen' | 'cycleB' | 'setBGroup' | 'setShift' | 'setBank' | 'setSequenceSlot'
  | 'queueSequenceSlot' | 'selectPad' | 'updatePad' | 'updateProject' | 'newProject'
  | 'loadSavedProject' | 'importProject' | 'exportProject' | 'undo' | 'redo'
>;

export const createCoreSlice: StateCreator<UIState, [], [], CoreSlice> = (set, get) => ({
  booted: false,
  project: initial,
  bank: 0,
  seqSlot: 0,
  queuedSeqSlot: null,
  selectedPad: 0,
  pausedAt: 0,
  screen: 'sample' as ScreenId,
  bGroup: 1,
  bPage: [0, 0, 0],
  shift: false,

  async boot() {
    // Apply persisted theme
    document.body.dataset.theme = get().theme;
    await engine.init();
    engine.setProject(get().project);
    engine.setSequenceSlot(get().seqSlot);
    engine.setKitVolume(get().kitVolume);
    engine.setCompressor(
      0.1 + get().compressor.attack * 150,
      3 + get().compressor.release * 297,
      get().compressor.amount * 100,
      get().compressor.color,
      get().compressor.bypass,
      get().compressor.inBoost,
    );
    engine.setKnobFXRouting(get().knobFXRouting, get().knobFXBypass);
    engine.setFlexBeat(get().flexBeat);
    for (let k = 0; k < 3; k++) {
      engine.setKnobFXParam(k as 0 | 1 | 2, get().knobFXParams[k]);
    }
    engine.onRecordHit = () => {
      const { project, bank, seqSlot } = get();
      const banks = project.sequences.map((row, bi) =>
        bi === bank
          ? row.map((s, si) => (si === seqSlot ? { ...s, events: [...s.events] } : s))
          : row
      );
      get().updateProject({ sequences: banks });
    };
    engine.onSongStepChange = (b, slot) => {
      engine.setBank(b);
      engine.setSequenceSlot(slot);
      set({ bank: b, seqSlot: slot, queuedSeqSlot: null });
    };
    engine.onSeqLoopEnd = () => {
      const q = get().queuedSeqSlot;
      if (q === null || !engine.telemetry.playing) return;
      get().setSequenceSlot(q);
      set({ queuedSeqSlot: null });
    };
    midi.setConfig(get().midiConfig);
    // Re-hydrate any samples referenced by the restored project.
    const seen = new Set<string>();
    for (const bank of get().project.banks) {
      for (const pad of bank) {
        if (!pad.sampleId || seen.has(pad.sampleId)) continue;
        seen.add(pad.sampleId);
        const data = await readSample(pad.sampleId);
        if (data) {
          try {
            await engine.loadSample(pad.sampleId, data);
          } catch {
            /* undecodable — leave the pad empty */
          }
        }
      }
    }
    set({ booted: true });
  },

  setScreen(s) {
    set({ screen: s, bGroup: 1 });
  },

  cycleB(n) {
    const pages = [...get().bPage] as [number, number, number];
    pages[n - 1] += 1;
    set({ bGroup: n, bPage: pages });
  },

  setBGroup(n) {
    set({ bGroup: n });
  },

  setShift(v) {
    set({ shift: v });
  },

  setBank(b) {
    engine.setBank(b);
    set({ bank: b });
  },

  setSequenceSlot(i) {
    const slot = Math.max(0, Math.min(15, i));
    engine.setSequenceSlot(slot);
    set({ seqSlot: slot });
  },

  queueSequenceSlot(i) {
    const slot = Math.max(0, Math.min(15, i));
    if (get().queuedSeqSlot === slot) {
      set({ queuedSeqSlot: null });
      return;
    }
    set({ queuedSeqSlot: slot });
  },

  selectPad(i) {
    engine.selectedPad = i;
    set({ selectedPad: i, selectedSlice: 0 });
  },

  updatePad(i, patch: Partial<Pad>) {
    const project = get().project;
    history.push(project);
    const banks = project.banks.map((b, bi) =>
      bi === get().bank ? b.map((p, pi) => (pi === i ? { ...p, ...patch } : p)) : b
    );
    const next = { ...project, banks };
    engine.setProject(next);
    if ('warpAmount' in patch || 'warpMode' in patch || 'beats' in patch) {
      engine.clearStretchCache();
    }
    scheduleAutosave(next);
    set({ project: next });
  },

  updateProject(patch: Partial<Project>) {
    const next = { ...get().project, ...patch };
    engine.setProject(next);
    scheduleAutosave(next);
    set({ project: next });
  },

  newProject() {
    history.push(get().project);
    const p = makeProject('New Project');
    engine.setProject(p);
    set({
      project: p,
      bank: 0,
      seqSlot: 0,
      selectedPad: 0,
      screen: 'sample',
    });
  },

  async loadSavedProject(id) {
    const raw = loadProject(id);
    if (!raw) return;
    const p = migrateProject(raw);
    history.push(get().project);
    engine.setProject(p);
    engine.setBank(0);
    engine.setSequenceSlot(0);
    const seen = new Set<string>();
    for (const bank of p.banks) {
      for (const pad of bank) {
        if (!pad.sampleId || seen.has(pad.sampleId)) continue;
        seen.add(pad.sampleId);
        const data = await readSample(pad.sampleId);
        if (data) {
          try { await engine.loadSample(pad.sampleId, data); } catch { /* skip */ }
        }
      }
    }
    set({ project: p, bank: 0, seqSlot: 0, selectedPad: 0, screen: 'sample' });
  },

  async importProject(file: File) {
    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object') return;
      const proj = parsed as Record<string, unknown>;
      if (typeof proj.id !== 'string' || typeof proj.name !== 'string' ||
          !Array.isArray(proj.banks) || !Array.isArray(proj.sequences)) {
        return;
      }
      const p = migrateProject(parsed as Project);
      history.push(get().project);
      engine.setProject(p);
      engine.setBank(0);
      engine.setSequenceSlot(0);
      // Re-hydrate samples
      const seen = new Set<string>();
      for (const b of p.banks) {
        for (const pad of b) {
          if (!pad.sampleId || seen.has(pad.sampleId)) continue;
          seen.add(pad.sampleId);
          const data = await readSample(pad.sampleId);
          if (data) {
            try { await engine.loadSample(pad.sampleId, data); } catch { /* skip */ }
          }
        }
      }
      scheduleAutosave(p);
      set({ project: p, bank: 0, seqSlot: 0, selectedPad: 0, screen: 'sample' });
    } catch {
      /* invalid file — silently ignore */
    }
  },

  exportProject() {
    const { project } = get();
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `${project.name || 'project'}.json`);
  },

  undo() {
    const prev = history.undo(get().project);
    if (!prev) return;
    engine.setProject(prev);
    set({ project: prev });
  },

  redo() {
    const next = history.redo(get().project);
    if (!next) return;
    engine.setProject(next);
    set({ project: next });
  },
});
