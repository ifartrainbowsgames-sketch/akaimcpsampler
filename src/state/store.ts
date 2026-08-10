import { create } from 'zustand';
import {
  makeProject,
  migrateProject,
  MAX_SLICES,
  TICKS_PER_16TH,
  type Pad,
  type Project,
} from '../audio/types';
import { engine } from '../audio/engine';
import { autosave, loadAutosave, loadProject } from '../storage/projects';
import { readSample, writeSample } from '../storage/opfs';
import { chopByRegions, chopByThreshold, mergeSlice, splitSlice } from '../audio/chop';
import { downloadBlob, renderToWav } from '../audio/export';
import type { KnobFXId } from '../audio/fx/knobfx';
import type { PadFXId } from '../audio/fx/padfx';
import { midi, type MidiConfig } from '../midi/midi';
import { getMidiConfig, saveMidiConfig } from '../storage/midiConfig';
import { history } from './undo';
import { getChopLoadMode, type ChopLoadMode } from '../storage/preferences';
import { listSamples, deleteSample } from '../storage/opfs';
import { ticksPerBar } from '../audio/scheduler';
import { FACTORY_KITS, generateFactoryKit } from '../audio/factory/kits';
import type { LibrarySound } from '../library/types';
import { fetchFreesoundPreview, searchFreesound, checkFreesoundProxy } from '../library/freesound';

export type ScreenId =
  | 'sample' | 'seq' | 'stepedit' | 'song'
  | 'browser' | 'kits' | 'library' | 'smprec'
  | 'padfx' | 'flexbeat' | 'knobfx'
  | 'comp' | 'inputcfg' | 'fadermenu' | 'timecorr' | 'midi' | 'project' | 'loadproj';

export type PadPlayMode = 'chop' | 'loop' | 'mute' | 'levels';

interface UIState {
  booted: boolean;
  project: Project;
  bank: number;
  seqSlot: number;
  /** Sequence slot queued to play at the next loop boundary. */
  queuedSeqSlot: number | null;
  selectedPad: number;
  pausedAt: number;
  kitVolume: number;
  compressor: { attack: number; release: number; amount: number };
  noteRepeat: boolean;
  noteRepeatTriplet: boolean;
  eraseMode: boolean;

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
  setSequenceSlot(i: number): void;
  queueSequenceSlot(i: number): void;
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
  play(continueFromPaused?: boolean): void;
  stop(hardReset?: boolean): void;
  toggleRecord(): void;
  playSong(): void;
  tapTempo(): void;
  toggleMetronome(): void;
  toggleNoteRepeat(): void;
  toggleTriplet(): void;
  toggleEraseMode(): void;
  eraseSequence(): void;
  copySequence(): void;
  recallSample(): Promise<void>;
  setFaderParam(p: string): void;
  setKitVolume(db: number): void;
  setCompressorSettings(a: number, r: number, amt: number): void;
  loadSavedProject(id: string): Promise<void>;
  deleteBrowserSample(id: string): Promise<void>;
  selectStepEditPad(pad: number): void;
  erasePadFromStep(pad: number): void;

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

  waveformZoom: number;
  setWaveformZoom(z: number): void;
  setTrimRegion(start: number, end: number, loopStart: number): void;
  previewAtFrame(frame: number): void;
  addManualChopPoint(frame: number): void;

  browserEntries: { id: string; name: string }[];
  refreshBrowser(): Promise<void>;
  loadBrowserSample(id: string): Promise<void>;
  loadFactoryKit(kitId: string): Promise<void>;

  libraryResults: LibrarySound[];
  libraryPage: number;
  libraryNumPages: number;
  libraryQuery: string;
  libraryError: string | null;
  libraryLoading: boolean;
  libraryProxyReady: boolean;
  searchLibrary(query: string, filter?: string, page?: number): Promise<void>;
  loadLibrarySound(sound: LibrarySound): Promise<void>;
  checkLibraryProxy(): Promise<void>;

  stepEditTick: number;
  stepEditEvent: number;
  setStepEditTick(t: number): void;
  setStepEditEvent(i: number): void;
  eraseStepEvent(): void;
  nudgeStepEvent(delta: number): void;

  halfSeq(): void;
  doubleSeq(): void;
  toggleCountIn(): void;
  halfSpeed(): void;
  doubleSpeed(): void;
  toggleRecQuantize(): void;
  resampleToPad(padIndex: number): Promise<void>;
  toggleWarpMode(): void;
  cycleFaderParam(): void;

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
  recordError: string | null;
  openInput(): Promise<boolean>;
  startSampleRecord(): Promise<boolean>;
  stopSampleRecord(): Promise<boolean>;
  connectMidi(): Promise<void>;
  midiConnected: boolean;
  midiConfig: MidiConfig;
  midiInputs: string[];
  midiOutputs: string[];
  setMidiConfig(c: MidiConfig): void;
  undo(): void;
  redo(): void;
}

const initial = migrateProject(loadAutosave() ?? makeProject('Startup'));

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
  queuedSeqSlot: null,
  selectedPad: 0,
  pausedAt: 0,
  kitVolume: 0,
  compressor: { attack: 0.1, release: 0.35, amount: 0.3 },
  noteRepeat: false,
  noteRepeatTriplet: false,
  eraseMode: false,

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
  waveformZoom: 1,
  browserEntries: [],
  libraryResults: [],
  libraryPage: 1,
  libraryNumPages: 1,
  libraryQuery: 'kick drum',
  libraryError: null,
  libraryLoading: false,
  libraryProxyReady: false,
  stepEditTick: 0,
  stepEditEvent: 0,

  knobFX: 'off',
  activePadFX: null,
  inputOpen: false,
  recordError: null,
  midiConnected: false,
  midiConfig: getMidiConfig(),
  midiInputs: [] as string[],
  midiOutputs: [] as string[],

  async boot() {
    await engine.init();
    engine.setProject(get().project);
    engine.setSequenceSlot(get().seqSlot);
    engine.setKitVolume(get().kitVolume);
    engine.setCompressor(
      0.1 + get().compressor.attack * 150,
      3 + get().compressor.release * 297,
      get().compressor.amount * 100,
    );
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

  togglePadMode(m) {
    const modes = { ...get().padModes, [m]: !get().padModes[m] };
    if (m === 'chop' && modes.chop) modes.levels = false;
    if (m === 'levels' && modes.levels) modes.chop = false;
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

  hitPad(i, velocity = 100) {
    const { padModes, project, bank, screen, eraseMode } = get();

    if (screen === 'seq' && engine.telemetry.playing) {
      get().queueSequenceSlot(i);
      return;
    }

    if (screen === 'seq' && !engine.telemetry.playing) {
      set({ queuedSeqSlot: null });
      get().setSequenceSlot(i);
      return;
    }

    if (screen === 'stepedit' && get().shift && eraseMode) {
      get().erasePadFromStep(i);
      return;
    }

    if (screen === 'stepedit' && !get().shift) {
      get().selectStepEditPad(i);
    }

    if (padModes.mute) {
      const pad = project.banks[bank][i];
      get().updatePad(i, { muted: !pad.muted });
      return;
    }

    const recordPad = padModes.chop || padModes.levels ? get().selectedPad : i;
    engine.trigger(i, velocity);
    engine.recordHit(i, velocity, recordPad, bank);

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
    if ('warpAmount' in patch || 'warpMode' in patch || 'beats' in patch) {
      engine.clearStretchCache();
    }
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
      polyphony: 'mono',
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

  play(continueFromPaused = false) {
    if (engine.telemetry.playing) return;
    engine.play(continueFromPaused);
  },

  stop(hardReset = false) {
    const pos = engine.telemetry.positionTicks;
    engine.stop(hardReset);
    engine.setRecording(false);
    set({ pausedAt: hardReset ? 0 : pos, queuedSeqSlot: null });
  },

  playSong() {
    get().stop(true);
    engine.startSongMode();
    set({});
  },

  tapTempo() {
    const taps = (get() as UIState & { _taps?: number[] })._taps ?? [];
    const now = performance.now();
    taps.push(now);
    while (taps.length > 4) taps.shift();
    (get() as UIState & { _taps?: number[] })._taps = taps;
    if (taps.length >= 2) {
      const span = taps[taps.length - 1] - taps[0];
      const bpm = (60000 * (taps.length - 1)) / span;
      if (bpm >= 40 && bpm <= 200) get().updateProject({ bpm: Math.round(bpm * 10) / 10 });
    }
  },

  toggleMetronome() {
    const order = ['off', 'on', 'record'] as const;
    const cur = get().project.metronome;
    const next = order[(order.indexOf(cur) + 1) % order.length];
    get().updateProject({ metronome: next });
  },

  toggleNoteRepeat() {
    set({ noteRepeat: !get().noteRepeat });
  },

  toggleTriplet() {
    set({ noteRepeatTriplet: !get().noteRepeatTriplet });
  },

  toggleEraseMode() {
    set({ eraseMode: !get().eraseMode });
  },

  eraseSequence() {
    const { project, bank, seqSlot } = get();
    history.push(project);
    const banks = project.sequences.map((row, bi) =>
      bi === bank
        ? row.map((s, si) => (si === seqSlot ? { ...s, events: [] } : s))
        : row
    );
    get().updateProject({ sequences: banks });
  },

  copySequence() {
    const { project, bank, seqSlot } = get();
    const target = (seqSlot + 1) % 16;
    history.push(project);
    const src = project.sequences[bank][seqSlot];
    const banks = project.sequences.map((row, bi) =>
      bi === bank
        ? row.map((s, si) =>
            si === target
              ? { ...s, events: src.events.map((e) => ({ ...e })), bars: src.bars, name: `${src.name} copy` }
              : s
          )
        : row
    );
    get().updateProject({ sequences: banks });
    get().setSequenceSlot(target);
  },

  async recallSample() {
    const buffer = engine.recall();
    if (!buffer) return;
    const id = crypto.randomUUID();
    engine.putBuffer(id, buffer);
    const { project, bank, selectedPad } = get();
    const free = project.banks[bank].findIndex((p) => !p.sampleId);
    const target = free === -1 ? selectedPad : free;
    void engine.bufferToWav(buffer).arrayBuffer().then((ab) => writeSample(id, ab));
    get().updatePad(target, {
      sampleId: id,
      sampleName: `Recall ${new Date().toTimeString().slice(0, 5)}`,
      start: 0,
      end: buffer.length,
      loopStart: 0,
      slices: [],
    });
    set({ selectedPad: target, screen: 'sample' });
  },

  setFaderParam(p) {
    set({ faderParam: p });
  },

  setKitVolume(db) {
    engine.setKitVolume(db);
    set({ kitVolume: db });
  },

  setCompressorSettings(a, r, amt) {
    engine.setCompressor(0.1 + a * 150, 3 + r * 297, amt * 100);
    set({ compressor: { attack: a, release: r, amount: amt } });
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

  async deleteBrowserSample(id) {
    await deleteSample(id);
    await get().refreshBrowser();
  },

  selectStepEditPad(pad) {
    const { project, bank, seqSlot, stepEditTick } = get();
    const seq = project.sequences[bank][seqSlot];
    const atTick = stepEditTick * project.quantize;
    const matches = seq.events
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => e.pad === pad && Math.abs(e.tick - atTick) < project.quantize / 2);
    if (matches.length > 0) {
      set({ stepEditEvent: matches[0].i, selectedPad: pad });
      engine.selectedPad = pad;
    } else {
      get().selectPad(pad);
      engine.trigger(pad, 100);
    }
  },

  erasePadFromStep(pad) {
    const { project, bank, seqSlot, stepEditTick } = get();
    const seq = project.sequences[bank][seqSlot];
    const atTick = stepEditTick * project.quantize;
    const events = seq.events.filter(
      (e) => !(e.pad === pad && Math.abs(e.tick - atTick) < project.quantize / 2)
    );
    const banks = project.sequences.map((row, bi) =>
      bi === bank ? row.map((s, si) => (si === seqSlot ? { ...s, events } : s)) : row
    );
    get().updateProject({ sequences: banks });
  },

  selectSlice(i) {
    set({ selectedSlice: i });
  },

  setWaveformZoom(z) {
    set({ waveformZoom: Math.max(1, Math.min(16, z)) });
  },

  setTrimRegion(start, end, loopStart) {
    const { selectedPad } = get();
    get().updatePad(selectedPad, { start, end, loopStart });
  },

  previewAtFrame(frame) {
    const { selectedPad } = get();
    engine.previewAtFrame(selectedPad, frame);
  },

  addManualChopPoint(frame) {
    const { project, bank, selectedPad } = get();
    const pad = project.banks[bank][selectedPad];
    const buffer = engine.getBuffer(pad.sampleId);
    if (!buffer) return;
    const from = pad.start;
    const to = pad.end || buffer.length;
    const f = Math.max(from + 1, Math.min(to - 1, Math.round(frame)));

    let slices = pad.slices.length ? pad.slices.slice() : [{ start: from, end: to }];
    const idx = slices.findIndex((s) => f > s.start && f < s.end);
    if (idx < 0) return;
    const s = slices[idx];
    slices.splice(idx, 1, { start: s.start, end: f }, { start: f, end: s.end });
    get().updatePad(selectedPad, { slices: slices.slice(0, MAX_SLICES), chopType: 'manual' });
  },

  async refreshBrowser() {
    const ids = await listSamples();
    const { project } = get();
    const names = new Map<string, string>();
    for (const bank of project.banks) {
      for (const pad of bank) {
        if (pad.sampleId) names.set(pad.sampleId, pad.sampleName || pad.sampleId.slice(0, 8));
      }
    }
    const entries = ids.map((id) => ({ id, name: names.get(id) ?? id.slice(0, 8) }));
    entries.sort((a, b) => a.name.localeCompare(b.name));
    set({ browserEntries: entries });
  },

  async loadBrowserSample(id) {
    const data = await readSample(id);
    if (!data) return;
    try {
      await engine.loadSample(id, data);
    } catch {
      return;
    }
    const buffer = engine.getBuffer(id);
    if (!buffer) return;
    const { selectedPad } = get();
    get().updatePad(selectedPad, {
      sampleId: id,
      sampleName: get().browserEntries.find((e) => e.id === id)?.name ?? 'Sample',
      start: 0,
      end: buffer.length,
      loopStart: 0,
      slices: [],
    });
    set({ screen: 'sample' });
  },

  async loadFactoryKit(kitId) {
    if (!engine.ctx) await engine.init();
    const ctx = engine.ctx;
    if (!ctx) return;

    const kit = await generateFactoryKit(ctx, kitId);
    if (!kit) return;

    const meta = FACTORY_KITS.find((k) => k.id === kitId);

    for (let i = 0; i < 16; i++) {
      const id = crypto.randomUUID();
      const buffer = kit.buffers[i];
      engine.putBuffer(id, buffer);
      const wav = await engine.bufferToWav(buffer).arrayBuffer();
      await writeSample(id, wav);

      const label = meta?.padNames[i] ?? `Pad ${i + 1}`;

      get().updatePad(i, {
        sampleId: id,
        sampleName: `${meta?.name ?? kit.name}-${label}`.slice(0, 24),
        start: 0,
        end: buffer.length,
        loopStart: 0,
        slices: [],
        gain: meta?.defaultGain ?? 0,
        polyphony: 'mono',
      });
    }

    set({ selectedPad: 0, screen: 'sample' });
    engine.selectedPad = 0;
  },

  async checkLibraryProxy() {
    const ready = await checkFreesoundProxy();
    set({ libraryProxyReady: ready });
  },

  async searchLibrary(query, filter = 'duration:[0 TO 8]', page = 1) {
    set({ libraryLoading: true, libraryError: null, libraryQuery: query });
    try {
      const result = await searchFreesound(query, page, filter);
      set({
        libraryResults: result.sounds,
        libraryPage: result.page,
        libraryNumPages: result.numPages,
        libraryLoading: false,
      });
    } catch (e) {
      set({
        libraryError: e instanceof Error ? e.message : 'Search failed',
        libraryLoading: false,
        libraryResults: [],
      });
    }
  },

  async loadLibrarySound(sound) {
    set({ libraryLoading: true, libraryError: null });
    try {
      const data = await fetchFreesoundPreview(sound.id, sound.previewUrl);
      const id = `fs-${sound.id}`;
      const buffer = await engine.loadSample(id, data);
      await writeSample(id, data);
      const { selectedPad } = get();
      get().updatePad(selectedPad, {
        sampleId: id,
        sampleName: sound.name.slice(0, 24),
        start: 0,
        end: buffer.length,
        loopStart: 0,
        slices: [],
      });
      set({ screen: 'sample', libraryLoading: false });
    } catch (e) {
      set({
        libraryError: e instanceof Error ? e.message : 'Load failed',
        libraryLoading: false,
      });
    }
  },

  setStepEditTick(t) {
    set({ stepEditTick: Math.max(0, t), stepEditEvent: 0 });
  },

  setStepEditEvent(i) {
    set({ stepEditEvent: Math.max(0, i) });
  },

  eraseStepEvent() {
    const { project, bank, seqSlot, stepEditTick, stepEditEvent } = get();
    const seq = project.sequences[bank][seqSlot];
    const atTick = stepEditTick * project.quantize;
    const matches = seq.events
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => Math.abs(e.tick - atTick) < project.quantize / 2);
    const target = matches[stepEditEvent];
    if (!target) return;
    const events = seq.events.filter((_, i) => i !== target.i);
    const banks = project.sequences.map((row, bi) =>
      bi === bank ? row.map((s, si) => (si === seqSlot ? { ...s, events } : s)) : row
    );
    get().updateProject({ sequences: banks });
  },

  nudgeStepEvent(delta) {
    const { project, bank, seqSlot, stepEditTick, stepEditEvent } = get();
    const seq = project.sequences[bank][seqSlot];
    const atTick = stepEditTick * project.quantize;
    const matches = seq.events
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => Math.abs(e.tick - atTick) < project.quantize / 2);
    const target = matches[stepEditEvent];
    if (!target) return;
    const barLen = seq.bars * ticksPerBar(project.timeSignature);
    const events = seq.events.map((e, i) =>
      i === target.i
        ? { ...e, tick: (e.tick + delta + barLen) % barLen }
        : e
    );
    const banks = project.sequences.map((row, bi) =>
      bi === bank ? row.map((s, si) => (si === seqSlot ? { ...s, events } : s)) : row
    );
    get().updateProject({ sequences: banks });
  },

  halfSeq() {
    const { project, bank, seqSlot } = get();
    const seq = project.sequences[bank][seqSlot];
    const bars = Math.max(1, Math.floor(seq.bars / 2));
    const limit = bars * ticksPerBar(project.timeSignature);
    const events = seq.events.filter((e) => e.tick < limit);
    const banks = project.sequences.map((row, bi) =>
      bi === bank
        ? row.map((s, si) => (si === seqSlot ? { ...s, bars, events } : s))
        : row
    );
    get().updateProject({ sequences: banks });
  },

  doubleSeq() {
    const { project, bank, seqSlot } = get();
    const seq = project.sequences[bank][seqSlot];
    const bars = Math.min(128, seq.bars * 2);
    const oldLen = seq.bars * ticksPerBar(project.timeSignature);
    const dup = seq.events.map((e) => ({ ...e, tick: e.tick + oldLen }));
    const events = [...seq.events, ...dup].sort((a, b) => a.tick - b.tick);
    const banks = project.sequences.map((row, bi) =>
      bi === bank
        ? row.map((s, si) => (si === seqSlot ? { ...s, bars, events } : s))
        : row
    );
    get().updateProject({ sequences: banks });
  },

  toggleCountIn() {
    const p = get().project;
    get().updateProject({ countIn: !p.countIn });
  },

  halfSpeed() {
    const { project, bank, seqSlot } = get();
    const seq = project.sequences[bank][seqSlot];
    const bars = Math.min(128, seq.bars * 2);
    const events = seq.events.map((e) => ({ ...e, tick: e.tick * 2 }));
    const banks = project.sequences.map((row, bi) =>
      bi === bank
        ? row.map((s, si) => (si === seqSlot ? { ...s, bars, events } : s))
        : row
    );
    get().updateProject({ sequences: banks });
  },

  doubleSpeed() {
    const { project, bank, seqSlot } = get();
    const seq = project.sequences[bank][seqSlot];
    const bars = Math.max(1, Math.floor(seq.bars / 2));
    const events = seq.events
      .map((e) => ({ ...e, tick: Math.floor(e.tick / 2) }))
      .filter((e) => e.tick < bars * ticksPerBar(project.timeSignature));
    const banks = project.sequences.map((row, bi) =>
      bi === bank
        ? row.map((s, si) => (si === seqSlot ? { ...s, bars, events } : s))
        : row
    );
    get().updateProject({ sequences: banks });
  },

  toggleRecQuantize() {
    const p = get().project;
    get().updateProject({ recordQuantize: !p.recordQuantize });
  },

  async resampleToPad(padIndex) {
    const p = get().project;
    const { kitVolume, compressor } = get();
    const blob = await renderToWav({
      project: p,
      order: [{ bank: get().bank, slot: get().seqSlot }],
      getBuffer: (id) => engine.getBuffer(id),
      kitVolumeDb: kitVolume,
      compressor,
    });
    if (!blob) return;
    const data = await blob.arrayBuffer();
    const id = crypto.randomUUID();
    await engine.loadSample(id, data);
    await writeSample(id, data);
    const buffer = engine.getBuffer(id);
    if (!buffer) return;
    get().updatePad(padIndex, {
      sampleId: id,
      sampleName: `Resample ${new Date().toTimeString().slice(0, 5)}`,
      start: 0,
      end: buffer.length,
      loopStart: 0,
      slices: [],
    });
    set({ selectedPad: padIndex, screen: 'sample' });
  },

  toggleWarpMode() {
    const { project, bank, selectedPad } = get();
    const pad = project.banks[bank][selectedPad];
    get().updatePad(selectedPad, {
      warpMode: pad.warpMode === 'pitch' ? 'stretch' : 'pitch',
    });
  },

  cycleFaderParam() {
    const order = [
      'Pad Volume', 'Pad Pan', 'Pad Tune', 'Pad Filter Cutoff', 'Kit Volume',
    ];
    const i = order.indexOf(get().faderParam);
    set({ faderParam: order[(i + 1) % order.length] });
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
    const { kitVolume, compressor } = get();
    const order = p.song.length ? p.song : [{ bank: get().bank, slot: get().seqSlot }];
    const blob = await renderToWav({
      project: p,
      order,
      getBuffer: (id) => engine.getBuffer(id),
      kitVolumeDb: kitVolume,
      compressor,
    });
    if (blob) downloadBlob(blob, `${p.name || 'song'}.wav`);
  },

  async exportSequence() {
    const p = get().project;
    const { kitVolume, compressor, bank, seqSlot } = get();
    const blob = await renderToWav({
      project: p,
      order: [{ bank, slot: seqSlot }],
      getBuffer: (id) => engine.getBuffer(id),
      kitVolumeDb: kitVolume,
      compressor,
    });
    if (blob) {
      const seq = p.sequences[get().bank][get().seqSlot];
      downloadBlob(blob, `${seq.name}.wav`);
    }
  },

  // ---------------------------------------------- recording, MIDI, history

  async openInput() {
    set({ recordError: null });
    const ok = await engine.openInput();
    set({ inputOpen: ok, recordError: ok ? null : 'Microphone access denied or unavailable.' });
    return ok;
  },

  async startSampleRecord() {
    set({ recordError: null });
    if (!get().inputOpen) {
      const ok = await get().openInput();
      if (!ok) return false;
    }
    if (engine.ctx?.state === 'suspended') {
      try {
        await engine.ctx.resume();
      } catch {
        set({ recordError: 'Could not start audio — tap Start on the boot screen again.' });
        return false;
      }
    }
    engine.startRecording();
    set({});
    return true;
  },

  async stopSampleRecord() {
    const result = engine.stopRecording();
    if (!result) {
      set({ recordError: 'Nothing recorded — check the input meter moves when you speak.' });
      return false;
    }

    const id = crypto.randomUUID();
    engine.putBuffer(id, result.buffer);

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
    set({ selectedPad: target, screen: 'sample', recordError: null });
    return true;
  },

  async connectMidi() {
    const ok = await midi.connect();
    if (ok) {
      midi.onPadOn = (pad, velocity) => get().hitPad(pad, velocity);
      midi.onPadOff = (pad) => get().releasePad(pad);
    }
    set({
      midiConnected: ok,
      midiInputs: midi.inputs,
      midiOutputs: midi.outputs,
    });
  },

  setMidiConfig(c) {
    midi.setConfig(c);
    saveMidiConfig(c);
    set({ midiConfig: c });
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
    if (on) {
      if (!engine.telemetry.playing) {
        engine.setRecording(true);
        get().play(false);
      } else {
        engine.setRecording(true);
      }
    } else {
      engine.setRecording(false);
    }
    if (on && get().project.recordQuantize) {
      engine.setProject({ ...get().project, quantize: get().project.quantize || TICKS_PER_16TH });
    }
    set({});
  },
}));
