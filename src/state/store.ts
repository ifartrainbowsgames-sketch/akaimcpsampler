import { create } from 'zustand';
import type { AutoParam, Pad, Project } from '../audio/types';
import type { KnobFXId } from '../audio/fx/knobfx';
import type { PadFXId } from '../audio/fx/padfx';
import type { MidiConfig } from '../midi/midi';
import type { ChopLoadMode } from '../storage/preferences';
import type { LibrarySound } from '../library/types';
import { createCoreSlice } from './slices/coreSlice';
import { createPlaybackSlice } from './slices/playbackSlice';
import { createChopSlice } from './slices/chopSlice';
import { createFxSlice } from './slices/fxSlice';
import { createLibrarySlice } from './slices/librarySlice';
import { createMiscSlice } from './slices/miscSlice';

export type ScreenId =
  | 'sample' | 'seq' | 'stepedit' | 'song'
  | 'browser' | 'beats' | 'kits' | 'library' | 'smprec'
  | 'padfx' | 'flexbeat' | 'knobfx' | 'knobfx-select'
  | 'comp' | 'inputcfg' | 'fadermenu' | 'timecorr' | 'midi' | 'project' | 'loadproj'
  | 'pianoroll' | 'padmixer';

export type FlexBeatMode = 'oneshot' | 'loop';
export type InputRecLength = 'FREE' | 'SEQ';
export type InputSource = 'mic' | 'resample';

interface FlexBeatState {
  mode: FlexBeatMode;
  quantize: boolean;
  mix: number;
  activePad: number;
}

interface InputConfigState {
  source: InputSource;
  monitor: boolean;
  threshold: number;
  recLength: InputRecLength;
  recFx: boolean;
}

export type PadPlayMode = 'chop' | 'loop' | 'mute' | 'levels';

export interface UIState {
  booted: boolean;
  project: Project;
  bank: number;
  seqSlot: number;
  /** Sequence slot queued to play at the next loop boundary. */
  queuedSeqSlot: number | null;
  selectedPad: number;
  pausedAt: number;
  kitVolume: number;
  compressor: {
    attack: number;
    release: number;
    amount: number;
    color: boolean;
    bypass: boolean;
    inBoost: number;
  };
  noteRepeat: boolean;
  noteRepeatTriplet: boolean;
  eraseMode: boolean;
  faderEnabled: boolean;

  flexBeat: FlexBeatState;
  knobFXParams: [number, number, number];
  knobFXShiftParams: [number, number, number];
  knobFXRouting: boolean[];
  knobFXBypass: boolean;
  timeCorrectPads: boolean[];
  timeCorrectShift: number;
  inputConfig: InputConfigState;
  loadProjectCategory: 'demos' | 'kits' | 'user';

  guideMode: boolean;
  guideTopic: string | null;
  toggleGuideMode(): void;
  showGuide(topicId: string): void;
  dismissGuide(): void;

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
  startPadNoteRepeat(i: number, velocity: number): void;

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
  /** Write a mixer-automation point for the current sequence while recording. */
  recordAutomation(pad: number, param: AutoParam, norm: number): void;
  clearAutomation(): void;
  recallSample(): Promise<void>;
  setFaderParam(p: string): void;
  setKitVolume(db: number): void;
  setCompressorSettings(
    a: number, r: number, amt: number,
    color?: boolean, bypass?: boolean, inBoost?: number,
  ): void;
  toggleCompressorColor(): void;
  toggleCompressorBypass(): void;

  setKnobFXParam(k: 0 | 1 | 2, v: number): void;
  setKnobFXShiftParam(k: 0 | 1 | 2, v: number): void;
  toggleKnobFXPad(i: number): void;
  setAllKnobFXPads(on: boolean): void;
  toggleKnobFXBypass(): void;

  setFlexBeat(patch: Partial<FlexBeatState>): void;
  selectFlexBeatPad(pad: number): void;

  setStepEditVelocity(v: number): void;
  setTimeCorrectShift(n: number): void;
  toggleTimeCorrectPad(i: number): void;
  selectAllTimeCorrectPads(): void;
  applyTimeCorrect(): void;

  setInputConfig(patch: Partial<InputConfigState>): void;
  toggleFaderEnabled(): void;
  loadFactoryKitOnly(kitId: string): Promise<void>;
  newProject(): void;
  setLoadProjectCategory(c: 'demos' | 'kits' | 'user'): void;
  loadSavedProject(id: string): Promise<void>;
  deleteBrowserSample(id: string): Promise<void>;
  selectStepEditPad(pad: number): void;
  erasePadFromStep(pad: number): void;
  requestStepErase(pad: number): void;
  confirmStepErase(): void;
  cancelStepErase(): void;
  togglePadFXLatch(id: PadFXId): void;

  // ---- Phase 4: sample editing ----
  selectedSlice: number;
  levelsType: 'velocity' | 'filter' | 'tune';
  fullLevel: boolean;
  runChop(): void;
  /** Split a pad’s sample into slices spread across pads 1–16. */
  chopSongToPads(padIndex?: number): void;
  splitSelectedSlice(): void;
  mergeSelectedSlice(): void;
  extractSelectedSlice(): void;
  trimSelected(): void;
  normalizeSelected(): void;
  loopToEnd(): void;
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
  loadFactoryDemo(demoId: string): Promise<void>;

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
  stepErasePending: number | null;
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

  // ---- Pad Mixer solo ----
  soloPads: boolean[];
  togglePadSolo(i: number): void;
  clearSolos(): void;

  // ---- Phase 6: FX ----
  knobFX: KnobFXId;
  setKnobFX(id: KnobFXId): void;
  activePadFX: PadFXId | null;
  pressPadFX(id: PadFXId, amount: number): void;
  releasePadFX(id: PadFXId): void;

  // ---- Q-Link: free K1-K3 assignment ----
  /** Per-knob override id into ASSIGNABLE_PARAMS (assignableParams.ts), or null = screen-driven default. */
  knobAssign: [string | null, string | null, string | null];
  /** Which knob slot's assign picker is currently open, if any. */
  knobAssignPicker: 0 | 1 | 2 | null;
  setKnobAssign(slot: 0 | 1 | 2, id: string | null): void;
  openKnobAssignPicker(slot: 0 | 1 | 2): void;
  closeKnobAssignPicker(): void;

  // ---- Phase 7: song + export ----
  addSongStep(bank: number, slot: number): void;
  removeSongStep(i: number): void;
  exportSong(): Promise<void>;
  exportSequence(): Promise<void>;
  exportStems(): Promise<void>;
  exportProject(): void;
  importProject(file: File): Promise<void>;

  // ---- Piano Roll ----
  pianoRollAddNote(tick: number, note: number, duration: number, velocity: number): void;
  pianoRollDeleteNote(tick: number, note: number): void;
  pianoRollMoveNote(fromTick: number, fromNote: number, toTick: number, toNote: number): void;
  pianoRollResizeNote(tick: number, note: number, newDuration: number): void;
  pianoRollSetVelocity(tick: number, note: number, velocity: number): void;

  // ---- Theme ----
  theme: 'dark' | 'light';
  toggleTheme(): void;

  // ---- MIDI Learn ----
  midiLearn: { active: boolean; target: string | null };
  midiMappings: Record<string, { channel: number; cc: number }>;
  startMidiLearn(target: string): void;
  stopMidiLearn(): void;
  clearMidiMapping(target: string): void;

  // ---- BPM Detection ----
  detectBpm(): Promise<void>;

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

export const useStore = create<UIState>()((...a) => ({
  ...createCoreSlice(...a),
  ...createPlaybackSlice(...a),
  ...createChopSlice(...a),
  ...createFxSlice(...a),
  ...createLibrarySlice(...a),
  ...createMiscSlice(...a),
}));
