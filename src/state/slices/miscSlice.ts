import type { StateCreator } from 'zustand';
import { engine } from '../../audio/engine';
import { writeSample } from '../../storage/opfs';
import { downloadBlob, encodeWav, renderToWav } from '../../audio/export';
import { midi } from '../../midi/midi';
import { getMidiConfig, saveMidiConfig } from '../../storage/midiConfig';
import { history } from '../undo';
import type { UIState } from '../store';

export type MiscSlice = Pick<UIState,
  | 'guideMode' | 'guideTopic' | 'theme' | 'midiLearn' | 'midiMappings'
  | 'midiConnected' | 'midiConfig' | 'midiInputs' | 'midiOutputs' | 'inputOpen' | 'recordError'
  | 'toggleGuideMode' | 'showGuide' | 'dismissGuide' | 'toggleTheme'
  | 'startMidiLearn' | 'stopMidiLearn' | 'clearMidiMapping'
  | 'openInput' | 'startSampleRecord' | 'stopSampleRecord' | 'connectMidi' | 'setMidiConfig'
  | 'addSongStep' | 'removeSongStep' | 'exportSong' | 'exportSequence' | 'exportStems'
  | 'pianoRollAddNote' | 'pianoRollDeleteNote' | 'pianoRollMoveNote' | 'pianoRollResizeNote' | 'pianoRollSetVelocity'
>;

export const createMiscSlice: StateCreator<UIState, [], [], MiscSlice> = (set, get) => ({
  guideMode: false,
  guideTopic: null,
  theme: (localStorage.getItem('sampler.theme') as 'dark' | 'light') ?? 'dark',
  midiLearn: { active: false, target: null },
  midiMappings: {} as Record<string, { channel: number; cc: number }>,
  midiConnected: false,
  midiConfig: getMidiConfig(),
  midiInputs: [] as string[],
  midiOutputs: [] as string[],
  inputOpen: false,
  recordError: null,

  toggleGuideMode() {
    set((s) => {
      const next = !s.guideMode;
      return { guideMode: next, guideTopic: next ? 'guide.mode' : null };
    });
  },

  showGuide(topicId) {
    set({ guideTopic: topicId });
  },

  dismissGuide() {
    set({ guideTopic: null });
  },

  toggleTheme() {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('sampler.theme', next);
    document.body.dataset.theme = next;
    set({ theme: next });
  },

  startMidiLearn(target: string) {
    set({ midiLearn: { active: true, target } });
  },

  stopMidiLearn() {
    set({ midiLearn: { active: false, target: null } });
  },

  clearMidiMapping(target: string) {
    const mappings = { ...get().midiMappings };
    delete mappings[target];
    set({ midiMappings: mappings });
  },

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
      midi.onCC = (channel, cc, value) => {
        const { midiLearn, midiMappings } = get();
        // MIDI Learn: capture CC and map to target
        if (midiLearn.active && midiLearn.target) {
          const next = { ...midiMappings, [midiLearn.target]: { channel, cc } };
          set({ midiMappings: next, midiLearn: { active: false, target: null } });
          return;
        }
        // Apply existing mappings
        const norm = value / 127;
        const s = get();
        for (const [target, mapping] of Object.entries(midiMappings)) {
          if (mapping.channel !== channel || mapping.cc !== cc) continue;
          switch (target) {
            case 'BPM': s.updateProject({ bpm: Math.round(40 + norm * 160) }); break;
            case 'Pad Volume': s.updatePad(s.selectedPad, { gain: -Infinity + norm * (Infinity + 6) }); break;
            case 'Pad Pan': s.updatePad(s.selectedPad, { pan: norm * 2 - 1 }); break;
            case 'Pad Tune': s.updatePad(s.selectedPad, { semi: Math.round(norm * 48 - 24) }); break;
            case 'Kit Volume': s.setKitVolume(norm * 12 - 6); break;
            case 'Filter Cutoff': s.updatePad(s.selectedPad, { cutoff: Math.round(norm * 127) }); break;
          }
        }
      };
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
    const { kitVolume, compressor, knobFX, knobFXParams, knobFXBypass, knobFXRouting } = get();
    const order = p.song.length ? p.song : [{ bank: get().bank, slot: get().seqSlot }];
    const blob = await renderToWav({
      project: p,
      order,
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
    if (blob) downloadBlob(blob, `${p.name || 'song'}.wav`);
  },

  async exportSequence() {
    const p = get().project;
    const { kitVolume, compressor, knobFX, knobFXParams, knobFXBypass, knobFXRouting, bank, seqSlot } = get();
    const blob = await renderToWav({
      project: p,
      order: [{ bank, slot: seqSlot }],
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
    if (blob) {
      const seq = p.sequences[get().bank][get().seqSlot];
      downloadBlob(blob, `${seq.name}.wav`);
    }
  },

  async exportStems() {
    const { project, bank } = get();
    const pads = project.banks[bank];
    for (let i = 0; i < pads.length; i++) {
      const pad = pads[i];
      if (!pad.sampleId) continue;
      const buffer = engine.getBuffer(pad.sampleId);
      if (!buffer) continue;
      const blob = encodeWav(buffer);
      const name = (pad.sampleName || `pad-${i + 1}`).replace(/[^a-zA-Z0-9_-]/g, '_');
      downloadBlob(blob, `${name}.wav`);
      // Small delay to avoid browser popup blockers for multiple downloads
      await new Promise((r) => setTimeout(r, 80));
    }
  },

  pianoRollAddNote(tick, note, duration, velocity) {
    const { project, bank, seqSlot, selectedPad } = get();
    const seq = project.sequences[bank][seqSlot];
    history.push(project);
    const newEvent = { tick, pad: selectedPad, bank, velocity, duration, note };
    const events = [...seq.events, newEvent].sort((a, b) => a.tick - b.tick);
    const sequences = project.sequences.map((row, bi) =>
      bi === bank ? row.map((s, si) => (si === seqSlot ? { ...s, events } : s)) : row
    );
    get().updateProject({ sequences });
  },

  pianoRollDeleteNote(tick, note) {
    const { project, bank, seqSlot, selectedPad } = get();
    const seq = project.sequences[bank][seqSlot];
    history.push(project);
    const events = seq.events.filter(
      (e) => !(e.pad === selectedPad && e.tick === tick && (e.note ?? 60) === note)
    );
    const sequences = project.sequences.map((row, bi) =>
      bi === bank ? row.map((s, si) => (si === seqSlot ? { ...s, events } : s)) : row
    );
    get().updateProject({ sequences });
  },

  pianoRollMoveNote(fromTick, fromNote, toTick, toNote) {
    const { project, bank, seqSlot, selectedPad } = get();
    const seq = project.sequences[bank][seqSlot];
    history.push(project);
    const events = seq.events
      .map((e) =>
        e.pad === selectedPad && e.tick === fromTick && (e.note ?? 60) === fromNote
          ? { ...e, tick: toTick, note: toNote }
          : e
      )
      .sort((a, b) => a.tick - b.tick);
    const sequences = project.sequences.map((row, bi) =>
      bi === bank ? row.map((s, si) => (si === seqSlot ? { ...s, events } : s)) : row
    );
    get().updateProject({ sequences });
  },

  pianoRollResizeNote(tick, note, newDuration) {
    const { project, bank, seqSlot, selectedPad } = get();
    const seq = project.sequences[bank][seqSlot];
    history.push(project);
    const events = seq.events.map((e) =>
      e.pad === selectedPad && e.tick === tick && (e.note ?? 60) === note
        ? { ...e, duration: Math.max(1, newDuration) }
        : e
    );
    const sequences = project.sequences.map((row, bi) =>
      bi === bank ? row.map((s, si) => (si === seqSlot ? { ...s, events } : s)) : row
    );
    get().updateProject({ sequences });
  },

  pianoRollSetVelocity(tick, note, velocity) {
    const { project, bank, seqSlot, selectedPad } = get();
    const seq = project.sequences[bank][seqSlot];
    history.push(project);
    const events = seq.events.map((e) =>
      e.pad === selectedPad && e.tick === tick && (e.note ?? 60) === note
        ? { ...e, velocity: Math.max(1, Math.min(127, velocity)) }
        : e
    );
    const sequences = project.sequences.map((row, bi) =>
      bi === bank ? row.map((s, si) => (si === seqSlot ? { ...s, events } : s)) : row
    );
    get().updateProject({ sequences });
  },
});
