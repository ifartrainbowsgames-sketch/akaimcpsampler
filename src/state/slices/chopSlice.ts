import type { StateCreator } from 'zustand';
import { MAX_SLICES } from '../../audio/types';
import { engine } from '../../audio/engine';
import { writeSample } from '../../storage/opfs';
import { chopByRegions, chopByThreshold, detectBpm as detectBpmFromBuffer, mergeSlice, splitSlice } from '../../audio/chop';
import { getChopLoadMode } from '../../storage/preferences';
import { ticksPerBar } from '../../audio/scheduler';
import { history } from '../undo';
import type { UIState } from '../store';
import { chopTypeForSeconds } from './shared';

export type ChopSlice = Pick<UIState,
  | 'pendingChopPad' | 'selectedSlice' | 'levelsType' | 'fullLevel' | 'waveformZoom'
  | 'stepEditTick' | 'stepEditEvent' | 'stepErasePending' | 'timeCorrectPads' | 'timeCorrectShift'
  | 'importSample' | 'resolveChopChoice' | 'autoChopPad' | 'sliceAllToPads' | 'chopSongToPads'
  | 'runChop' | 'splitSelectedSlice' | 'mergeSelectedSlice' | 'extractSelectedSlice' | 'trimSelected'
  | 'toggleFullLevel' | 'cycleLevelsType' | 'selectSlice' | 'setWaveformZoom' | 'setTrimRegion'
  | 'previewAtFrame' | 'addManualChopPoint' | 'detectBpm'
  | 'selectStepEditPad' | 'erasePadFromStep' | 'requestStepErase' | 'confirmStepErase' | 'cancelStepErase'
  | 'setStepEditTick' | 'setStepEditEvent' | 'eraseStepEvent' | 'nudgeStepEvent' | 'setStepEditVelocity'
  | 'setTimeCorrectShift' | 'toggleTimeCorrectPad' | 'selectAllTimeCorrectPads' | 'applyTimeCorrect'
>;

export const createChopSlice: StateCreator<UIState, [], [], ChopSlice> = (set, get) => ({
  pendingChopPad: null,
  selectedSlice: 0,
  levelsType: 'velocity',
  fullLevel: false,
  waveformZoom: 1,
  stepEditTick: 0,
  stepEditEvent: 0,
  stepErasePending: null,
  timeCorrectPads: Array.from({ length: 16 }, () => true),
  timeCorrectShift: 0,

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
    const durationSec = buffer.duration;
    get().updatePad(padIndex, {
      sampleId: id,
      sampleName: file.name.replace(/\.[^.]+$/, '').slice(0, 24),
      start: 0,
      end: buffer.length,
      loopStart: 0,
      slices: [],
      chopType: chopTypeForSeconds(durationSec),
      polyphony: durationSec >= 6 ? 'poly' : 'mono',
      loop: durationSec >= 6,
    });
    engine.selectedPad = padIndex;
    set({ selectedPad: padIndex, screen: 'sample' });

    const mode = getChopLoadMode();
    if (mode === null) {
      set({ pendingChopPad: padIndex });
      return;
    }
    if (mode === 'auto' && durationSec >= 2) {
      queueMicrotask(() => get().chopSongToPads(padIndex));
    }
  },

  resolveChopChoice(mode) {
    const padIndex = get().pendingChopPad;
    set({ pendingChopPad: null });
    if (padIndex === null) return;
    if (mode === 'auto') {
      set({ selectedPad: padIndex });
      engine.selectedPad = padIndex;
      get().chopSongToPads(padIndex);
    }
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

  chopSongToPads(padIndex) {
    const { project, bank } = get();
    const idx = padIndex ?? get().selectedPad;
    const pad = project.banks[bank][idx];
    const buffer = engine.getBuffer(pad.sampleId);
    if (!buffer) return;
    const sec = buffer.length / buffer.sampleRate;
    const chopType = chopTypeForSeconds(sec);
    get().updatePad(idx, { chopType, loop: false, polyphony: 'mono' });
    engine.selectedPad = idx;
    set({ selectedPad: idx });
    get().autoChopPad(idx, true);
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

  async detectBpm() {
    const { project, bank, selectedPad } = get();
    const pad = project.banks[bank][selectedPad];
    const buffer = engine.getBuffer(pad.sampleId);
    if (!buffer) return;

    const bpm = detectBpmFromBuffer(buffer);
    if (bpm > 0) {
      get().updateProject({ bpm });
    }
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
    set({ stepErasePending: null });
  },

  requestStepErase(pad) {
    set({ stepErasePending: pad });
  },

  confirmStepErase() {
    const pad = get().stepErasePending;
    if (pad === null) return;
    get().erasePadFromStep(pad);
  },

  cancelStepErase() {
    set({ stepErasePending: null });
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

  setStepEditVelocity(v) {
    const { project, bank, seqSlot, stepEditTick, stepEditEvent } = get();
    const seq = project.sequences[bank][seqSlot];
    const atTick = stepEditTick * project.quantize;
    const matches = seq.events
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => Math.abs(e.tick - atTick) < project.quantize / 2);
    const target = matches[stepEditEvent];
    if (!target) return;
    const events = seq.events.map((ev) =>
      ev === target.e ? { ...ev, velocity: Math.max(1, Math.min(127, v)) } : ev
    );
    const banks = project.sequences.map((row, bi) =>
      bi === bank ? row.map((s, si) => (si === seqSlot ? { ...s, events } : s)) : row
    );
    get().updateProject({ sequences: banks });
  },

  setTimeCorrectShift(n) {
    set({ timeCorrectShift: Math.max(-48, Math.min(48, n)) });
  },

  toggleTimeCorrectPad(i) {
    const pads = [...get().timeCorrectPads];
    pads[i] = !pads[i];
    set({ timeCorrectPads: pads });
  },

  selectAllTimeCorrectPads() {
    set({ timeCorrectPads: Array.from({ length: 16 }, () => true) });
  },

  applyTimeCorrect() {
    const { project, bank, seqSlot, timeCorrectPads, timeCorrectShift } = get();
    history.push(project);
    const seq = project.sequences[bank][seqSlot];
    const events = seq.events.map((e) => {
      if (!timeCorrectPads[e.pad]) return e;
      let tick = Math.round(e.tick / project.quantize) * project.quantize;
      tick += timeCorrectShift;
      tick = Math.max(0, tick);
      return { ...e, tick };
    });
    const banks = project.sequences.map((row, bi) =>
      bi === bank ? row.map((s, si) => (si === seqSlot ? { ...s, events } : s)) : row
    );
    get().updateProject({ sequences: banks });
  },
});
