import type { StateCreator } from 'zustand';
import { TICKS_PER_16TH } from '../../audio/types';
import { engine } from '../../audio/engine';
import { writeSample } from '../../storage/opfs';
import { renderToWav } from '../../audio/export';
import { ticksPerBar } from '../../audio/scheduler';
import { history } from '../undo';
import type { UIState } from '../store';

export type PlaybackSlice = Pick<UIState,
  | 'kitVolume' | 'compressor' | 'noteRepeat' | 'noteRepeatTriplet' | 'eraseMode' | 'faderEnabled'
  | 'padModes' | 'faderParam'
  | 'togglePadMode' | 'hitPad' | 'releasePad' | 'startPadNoteRepeat' | 'play' | 'stop' | 'toggleRecord'
  | 'playSong' | 'tapTempo' | 'toggleMetronome' | 'toggleNoteRepeat' | 'toggleTriplet' | 'toggleEraseMode'
  | 'eraseSequence' | 'copySequence' | 'recordAutomation' | 'clearAutomation'
  | 'recallSample' | 'setFaderParam' | 'setKitVolume'
  | 'setCompressorSettings' | 'toggleCompressorColor' | 'toggleCompressorBypass' | 'halfSeq' | 'doubleSeq'
  | 'toggleCountIn' | 'halfSpeed' | 'doubleSpeed' | 'toggleRecQuantize' | 'resampleToPad' | 'toggleWarpMode'
  | 'cycleFaderParam' | 'toggleFaderEnabled'
>;

export const createPlaybackSlice: StateCreator<UIState, [], [], PlaybackSlice> = (set, get) => ({
  kitVolume: 0,
  compressor: { attack: 0.1, release: 0.35, amount: 0.3, color: false, bypass: false, inBoost: 0 },
  noteRepeat: false,
  noteRepeatTriplet: false,
  eraseMode: false,
  faderEnabled: true,
  padModes: { chop: false, loop: false, mute: false, levels: false },
  faderParam: 'Pad Volume',

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

  hitPad(i, velocity = 100) {
    const vel = Math.max(1, Math.min(127, velocity));
    const { padModes, project, bank, screen, eraseMode } = get();

    if (screen === 'flexbeat') {
      get().selectFlexBeatPad(i);
      return;
    }

    if (screen === 'knobfx-select') {
      get().toggleKnobFXPad(i);
      return;
    }

    if (screen === 'timecorr') {
      get().toggleTimeCorrectPad(i);
      return;
    }

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
      get().requestStepErase(i);
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
    engine.trigger(i, vel);
    engine.recordHit(i, vel, recordPad, bank);

    if (get().padModes.chop) set({ selectedSlice: i });
    else if (!get().padModes.levels) {
      engine.selectedPad = i;
      set({ selectedPad: i, selectedSlice: 0 });
    }
  },

  releasePad(i) {
    engine.release(i);
    if (get().noteRepeat) {
      engine.stopNoteRepeat(i);
    }
  },

  startPadNoteRepeat(i: number, velocity: number) {
    if (!get().noteRepeat) return;
    engine.startNoteRepeat(i, velocity, get().noteRepeatTriplet);
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

  recordAutomation(pad, param, norm) {
    // Only while the transport is recording live. Mutate the active sequence's
    // automation in place — the engine shares the same sequence object, so the
    // scheduler replays it without a project rebuild. The mixer fader's own
    // updatePad triggers the re-render that refreshes the on-screen count.
    if (!engine.telemetry.recordingLive) return;
    const { project, bank, seqSlot } = get();
    const seq = project.sequences[bank][seqSlot];
    if (!seq.automation) seq.automation = [];
    const tick = Math.round(engine.telemetry.positionTicks);
    const value = Math.max(0, Math.min(1, norm));
    const i = seq.automation.findIndex((a) => a.tick === tick && a.pad === pad && a.param === param);
    if (i >= 0) seq.automation[i] = { tick, pad, param, value };
    else seq.automation.push({ tick, pad, param, value });
  },

  clearAutomation() {
    const { project, bank, seqSlot } = get();
    const sequences = project.sequences.map((row, bi) =>
      bi === bank ? row.map((s, si) => (si === seqSlot ? { ...s, automation: [] } : s)) : row
    );
    get().updateProject({ sequences });
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

  setCompressorSettings(a, r, amt, color, bypass, inBoost) {
    const c = get().compressor;
    const next = {
      attack: a,
      release: r,
      amount: amt,
      color: color ?? c.color,
      bypass: bypass ?? c.bypass,
      inBoost: inBoost ?? c.inBoost,
    };
    engine.setCompressor(
      0.1 + next.attack * 150,
      3 + next.release * 297,
      next.amount * 100,
      next.color,
      next.bypass,
      next.inBoost,
    );
    set({ compressor: next });
  },

  toggleCompressorColor() {
    const c = get().compressor;
    get().setCompressorSettings(c.attack, c.release, c.amount, !c.color, c.bypass, c.inBoost);
  },

  toggleCompressorBypass() {
    const c = get().compressor;
    get().setCompressorSettings(c.attack, c.release, c.amount, c.color, !c.bypass, c.inBoost);
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
    const { kitVolume, compressor, knobFX, knobFXParams, knobFXBypass, knobFXRouting } = get();
    const blob = await renderToWav({
      project: p,
      order: [{ bank: get().bank, slot: get().seqSlot }],
      getBuffer: (id) => engine.getBuffer(id),
      kitVolumeDb: kitVolume,
      compressor,
      knobFX: knobFXBypass ? undefined : {
        id: knobFX,
        params: knobFXParams,
        bypass: knobFXBypass,
        routing: knobFXRouting,
      },
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
      'Pad Volume', 'Pad Pan', 'Pad Tune',
      'Pad Amp Attack', 'Pad Amp Decay', 'Pad Filter Cutoff', 'Kit Volume',
    ];
    const i = order.indexOf(get().faderParam);
    set({ faderParam: order[(i + 1) % order.length] });
  },

  toggleFaderEnabled() {
    set({ faderEnabled: !get().faderEnabled });
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
});
