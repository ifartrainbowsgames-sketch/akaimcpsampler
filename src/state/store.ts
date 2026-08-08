import { create } from 'zustand';
import {
  makeProject,
  TICKS_PER_16TH,
  type Pad,
  type Project,
} from '../audio/types';
import { engine } from '../audio/engine';
import { autosave, loadAutosave } from '../storage/projects';
import { readSample, writeSample } from '../storage/opfs';
import { chopByRegions, chopByThreshold, mergeSlice, splitSlice } from '../audio/chop';
import { downloadBlob, renderToWav } from '../audio/export';
import type { KnobFXId } from '../audio/fx/knobfx';
import type { PadFXId } from '../audio/fx/padfx';
import { midi } from '../midi/midi';
import { history } from './undo';
import { getChopLoadMode, type ChopLoadMode } from '../storage/preferences';

export type ScreenId =
  | 'sample' | 'seq' | 'stepedit' | 'song'
  | 'browser' | 'smprec'
  | 'padfx' | 'flexbeat' | 'knobfx'
  | 'comp' | 'inputcfg' | 'fadermenu' | 'timecorr' | 'midi' | 'project';

export type PadPlayMode = 'chop' | 'loop' | 'mute' | 'levels';

interface UIState {
  booted: boolean;
  project: Project;
  bank: number;
  seqSlot: number;
  selectedPad: number;

  screen: ScreenId;
  /** Which B-button group is showing, and how far through its page cycle. */
  bGroup: 1 | 2 | 3;
  bPage: [number, number, number];

  shift: boolean;
  padModes: Record<PadPlayMode, boolean>;
  faderParam: string;

  boot(): Promise<void>;
  setScreen(s: ScreenId): void;
  cycleB(n: 1 | 2 | 3): void;
  setBGroup(n: 1 | 2 | 3): void;
  setShift(v: boolean): void;
  togglePadMode(m: PadPlayMode): void;
  setBank(b: number): void;
  selectPad(i: number): void;

  hitPad(i: number, velocity?: number): void;
  releasePad(i: number): void;

  updatePad(i: number, patch: Partial<Pad>): void;
  updateProject(patch: Partial<Project>): void;

  importSample(file: File, padIndex: number): Promise<void>;
  pendingChopPad: number | null;
  resolveChopChoice(mode: ChopLoadMode): void;
  autoChopPad(padIndex: number, sliceToPads: boolean): void;
  sliceAllToPads(): void;
  play(): void;
  stop(): void;
  toggleRecord(): void;

  // ---- Phase 4: sample editing ----
  selectedSlice: number;
  levelsType: 'velocity' | 'filter' | 'tune';
  fullLevel: boolean;
  runChop(): void;
  splitSelectedSlice(): void;
  mergeSelectedSlice(): void;
  extractSelectedSlice(): void;
  trimSelected(): void;
  toggleFullLevel(): void;
  cycleLevelsType(): void;
  selectSlice(i: number): void;

  // ---- Phase 6: FX ----
  knobFX: KnobFXId;
  setKnobFX(id: KnobFXId): void;
  activePadFX: PadFXId | null;
  pressPadFX(id: PadFXId, amount: number): void;
  releasePadFX(id: PadFXId): void;

  // ---- Phase 7: song + export ----
  addSongStep(bank: number, slot: number): void;
  removeSongStep(i: number): void;
  exportSong(): Promise<void>;
  exportSequence(): Promise<void>;

  // ---- Phase 8: recording, MIDI, undo ----
  inputOpen: boolean;
  openInput(): Promise<void>;
  startSampleRecord(): void;
  stopSampleRecord(): Promise<void>;
  connectMidi(): Promise<void>;
  midiConnected: boolean;
  undo(): void;
  redo(): void;
}

const initial = loadAutosave() ?? makeProject('Startup');

let autosaveTimer: number | null = null;
function scheduleAutosave(p: Project) {
  if (autosaveTimer !== null) clearTimeout(autosaveTimer);
  autosaveTimer = window.setTimeout(() => autosave(p), 800);
}

export const useStore = create<UIState>((set, get) => ({
  booted: false,
  project: initial,
  bank: 0,
  seqSlot: 0,
  selectedPad: 0,

  screen: 'sample',
  bGroup: 1,
  bPage: [0, 0, 0],

  shift: false,
  padModes: { chop: false, loop: false, mute: false, levels: false },
  faderParam: 'Pad Volume',
  pendingChopPad: null,

  selectedSlice: 0,
  levelsType: 'velocity',
  fullLevel: false,

  knobFX: 'off',
  activePadFX: null,
  inputOpen: false,
  midiConnected: false,

  async boot() {
    await engine.init();
    engine.setProject(get().project);
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

  togglePadMode(m) {
    const modes = { ...get().padModes, [m]: !get().padModes[m] };
    const { selectedPad, bank, project } = get();

    // Chop and 16 Levels remap what the pads do, so the engine needs to know.
    engine.chopMode = modes.chop;
    engine.levelsMode = modes.levels;
    engine.selectedPad = selectedPad;

    // Loop is a per-pad property, not a global mode.
    if (m === 'loop') {
      const pad = project.banks[bank][selectedPad];
      get().updatePad(selectedPad, { loop: !pad.loop });
    }

    // Entering chop with no slices yet? Chop immediately so there's something
    // to play — waiting for the user to hit a second button is friction.
    if (m === 'chop' && modes.chop) {
      const pad = project.banks[bank][selectedPad];
      if (pad.sampleId && pad.slices.length === 0) {
        set({ padModes: modes });
        get().runChop();
        return;
      }
    }

    set({ padModes: modes });
  },

  setBank(b) {
    engine.setBank(b);
    set({ bank: b });
  },

  selectPad(i) {
    engine.selectedPad = i;
    set({ selectedPad: i, selectedSlice: 0 });
  },

  hitPad(i, velocity = 100) {
    const { padModes, project, bank } = get();

    // Mute mode: pads toggle mute instead of triggering.
    if (padModes.mute) {
      const pad = project.banks[bank][i];
      get().updatePad(i, { muted: !pad.muted });
      return;
    }

    engine.trigger(i, velocity);
    engine.recordHit(i, velocity);

    // In chop mode the pads address slices, so keep the source pad selected
    // and track which slice is being edited.
    if (get().padModes.chop) set({ selectedSlice: i });
    else if (!get().padModes.levels) {
      engine.selectedPad = i;
      set({ selectedPad: i, selectedSlice: 0 });
    }
  },

  releasePad(i) {
    engine.release(i);
  },

  updatePad(i, patch) {
    const project = get().project;
    history.push(project);
    const banks = project.banks.map((b, bi) =>
      bi === get().bank ? b.map((p, pi) => (pi === i ? { ...p, ...patch } : p)) : b
    );
    const next = { ...project, banks };
    engine.setProject(next);
    scheduleAutosave(next);
    set({ project: next });
  },

  updateProject(patch) {
    const next = { ...get().project, ...patch };
    engine.setProject(next);
    scheduleAutosave(next);
    set({ project: next });
  },

  async importSample(file, padIndex) {
    const id = crypto.randomUUID();
    const data = await file.arrayBuffer();
    let buffer: AudioBuffer;
    try {
      buffer = await engine.loadSample(id, data);
    } catch {
      return; // unsupported format
    }
    await writeSample(id, data);
    get().updatePad(padIndex, {
      sampleId: id,
      sampleName: file.name.replace(/\.[^.]+$/, '').slice(0, 24),
      start: 0,
      end: buffer.length,
      loopStart: 0,
      slices: [],
      chopType: 'threshold',
    });
    engine.selectedPad = padIndex;
    set({ selectedPad: padIndex, screen: 'sample' });

    const mode = getChopLoadMode();
    if (mode === null) {
      set({ pendingChopPad: padIndex });
      return;
    }
    if (mode === 'auto') {
      get().autoChopPad(padIndex, true);
    }
  },

  resolveChopChoice(mode) {
    const padIndex = get().pendingChopPad;
    set({ pendingChopPad: null });
    if (padIndex === null) return;
    if (mode === 'auto') get().autoChopPad(padIndex, true);
  },

  autoChopPad(padIndex, sliceToPads) {
    const modes = { ...get().padModes, chop: true };
    engine.chopMode = true;
    engine.selectedPad = padIndex;
    set({ padModes: modes, selectedPad: padIndex, screen: 'sample', bGroup: 1 });
    get().runChop();
    if (sliceToPads) get().sliceAllToPads();
  },

  sliceAllToPads() {
    const { project, bank, selectedPad } = get();
    const pad = project.banks[bank][selectedPad];
    if (!pad.sampleId || pad.slices.length === 0) return;

    const sourceName = pad.sampleName || 'slice';
    for (let i = 0; i < Math.min(16, pad.slices.length); i++) {
      const slice = pad.slices[i];
      const result = engine.extractSlice(pad.sampleId, slice.start, slice.end);
      if (!result) continue;

      void engine
        .bufferToWav(result.buffer)
        .arrayBuffer()
        .then((ab) => writeSample(result.id, ab));

      get().updatePad(i, {
        sampleId: result.id,
        sampleName: `${sourceName}-${i + 1}`.slice(0, 24),
        start: 0,
        end: result.buffer.length,
        loopStart: 0,
        slices: [],
      });
    }

    engine.chopMode = false;
    set({
      padModes: { ...get().padModes, chop: false },
      selectedPad: 0,
    });
    engine.selectedPad = 0;
  },

  play() {
    engine.play();
  },

  stop() {
    engine.stop();
    engine.setRecording(false);
  },

  selectSlice(i) {
    set({ selectedSlice: i });
  },

  /** Run the current chop type over the selected pad's sample. */
  runChop() {
    const { project, bank, selectedPad } = get();
    const pad = project.banks[bank][selectedPad];
    const buffer = engine.getBuffer(pad.sampleId);
    if (!buffer) return;

    const region = { start: pad.start, end: pad.end || buffer.length };
    let slices;
    switch (pad.chopType) {
      case 'threshold':
        slices = chopByThreshold(buffer, pad.chopThreshold, region);
        break;
      case 'regions4':
        slices = chopByRegions(buffer, 4, region);
        break;
      case 'regions8':
        slices = chopByRegions(buffer, 8, region);
        break;
      case 'regions16':
        slices = chopByRegions(buffer, 16, region);
        break;
      default:
        return; // manual — the user places these by tapping
    }
    get().updatePad(selectedPad, { slices });
    set({ selectedSlice: 0 });
  },

  splitSelectedSlice() {
    const { project, bank, selectedPad, selectedSlice } = get();
    const pad = project.banks[bank][selectedPad];
    // Editing slices switches Chop Type to Manual, as on the hardware.
    get().updatePad(selectedPad, {
      slices: splitSlice(pad.slices, selectedSlice),
      chopType: 'manual',
    });
  },

  mergeSelectedSlice() {
    const { project, bank, selectedPad, selectedSlice } = get();
    const pad = project.banks[bank][selectedPad];
    get().updatePad(selectedPad, {
      slices: mergeSlice(pad.slices, selectedSlice),
      chopType: 'manual',
    });
    set({ selectedSlice: Math.max(0, selectedSlice - 1) });
  },

  /** Non-destructive: the slice becomes a new sample on the next free pad. */
  extractSelectedSlice() {
    const { project, bank, selectedPad, selectedSlice } = get();
    const pad = project.banks[bank][selectedPad];
    const slice = pad.slices[selectedSlice];
    if (!slice || !pad.sampleId) return;

    const result = engine.extractSlice(pad.sampleId, slice.start, slice.end);
    if (!result) return;

    const free = project.banks[bank].findIndex((p) => !p.sampleId);
    if (free === -1) return;

    // Persist the extracted audio as WAV so it survives a reload.
    void engine
      .bufferToWav(result.buffer)
      .arrayBuffer()
      .then((ab) => writeSample(result.id, ab));

    get().updatePad(free, {
      sampleId: result.id,
      sampleName: `${pad.sampleName}-${selectedSlice + 1}`.slice(0, 24),
      start: 0,
      end: result.buffer.length,
      loopStart: 0,
      slices: [],
    });
  },

  /** Destructive: discard audio outside Start/End. */
  trimSelected() {
    const { project, bank, selectedPad } = get();
    const pad = project.banks[bank][selectedPad];
    if (!pad.sampleId) return;
    const buffer = engine.getBuffer(pad.sampleId);
    if (!buffer) return;
    const trimmed = engine.trimSample(
      pad.sampleId,
      pad.start,
      pad.end || buffer.length
    );
    if (!trimmed) return;
    void engine
      .bufferToWav(trimmed)
      .arrayBuffer()
      .then((ab) => writeSample(pad.sampleId!, ab));
    get().updatePad(selectedPad, {
      start: 0,
      end: trimmed.length,
      loopStart: 0,
      slices: [],
    });
  },

  toggleFullLevel() {
    const next = !get().fullLevel;
    engine.fullLevel = next;
    set({ fullLevel: next });
  },

  cycleLevelsType() {
    const order = ['velocity', 'filter', 'tune'] as const;
    const next = order[(order.indexOf(get().levelsType) + 1) % order.length];
    engine.levelsType = next;
    set({ levelsType: next });
  },

  // ---------------------------------------------------------------- FX

  setKnobFX(id) {
    void engine.setKnobFX(id);
    set({ knobFX: id });
  },

  pressPadFX(id, amount) {
    engine.pressPadFX(id, amount);
    set({ activePadFX: id });
  },

  releasePadFX(id) {
    engine.releasePadFX(id);
    set({ activePadFX: null });
  },

  // ------------------------------------------------------- song and export

  addSongStep(bank, slot) {
    const p = get().project;
    get().updateProject({ song: [...p.song, { bank, slot }] });
  },

  removeSongStep(i) {
    const p = get().project;
    get().updateProject({ song: p.song.filter((_, idx) => idx !== i) });
  },

  async exportSong() {
    const p = get().project;
    const order = p.song.length ? p.song : [{ bank: get().bank, slot: get().seqSlot }];
    const blob = await renderToWav({
      project: p,
      order,
      getBuffer: (id) => engine.getBuffer(id),
    });
    if (blob) downloadBlob(blob, `${p.name || 'song'}.wav`);
  },

  async exportSequence() {
    const p = get().project;
    const blob = await renderToWav({
      project: p,
      order: [{ bank: get().bank, slot: get().seqSlot }],
      getBuffer: (id) => engine.getBuffer(id),
    });
    if (blob) {
      const seq = p.sequences[get().bank][get().seqSlot];
      downloadBlob(blob, `${seq.name}.wav`);
    }
  },

  // ---------------------------------------------- recording, MIDI, history

  async openInput() {
    const ok = await engine.openInput();
    set({ inputOpen: ok });
  },

  startSampleRecord() {
    engine.startRecording();
    set({});
  },

  async stopSampleRecord() {
    const result = engine.stopRecording();
    if (!result) return;

    const id = crypto.randomUUID();
    engine.putBuffer(id, result.buffer);

    // Live chop points dropped during recording become slices immediately.
    const slices = result.chops.length
      ? result.chops.map((start, i) => ({
          start,
          end: result.chops[i + 1] ?? result.buffer.length,
        }))
      : [];

    const { project, bank } = get();
    const free = project.banks[bank].findIndex((p) => !p.sampleId);
    const target = free === -1 ? get().selectedPad : free;

    void engine
      .bufferToWav(result.buffer)
      .arrayBuffer()
      .then((ab) => writeSample(id, ab));

    get().updatePad(target, {
      sampleId: id,
      sampleName: `Rec ${new Date().toTimeString().slice(0, 5)}`,
      start: 0,
      end: result.buffer.length,
      loopStart: 0,
      slices,
    });
    set({ selectedPad: target, screen: 'sample' });
  },

  async connectMidi() {
    const ok = await midi.connect();
    if (ok) {
      midi.onPadOn = (pad, velocity) => get().hitPad(pad, velocity);
      midi.onPadOff = (pad) => get().releasePad(pad);
    }
    set({ midiConnected: ok });
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

  toggleRecord() {
    const on = !engine.telemetry.recording;
    engine.setRecording(on);
    // Ensure record quantize snaps to the project's current division.
    if (on && get().project.recordQuantize) {
      engine.setProject({ ...get().project, quantize: get().project.quantize || TICKS_PER_16TH });
    }
    set({});
  },
}));
