import { create } from 'zustand';
import type { PianoQuality } from '../types/piano';
import { whiteKeyIndex } from '../types/piano';
import { pianoEngine } from '../audio/PianoEngine';
import { pianoMidi } from '../audio/MidiEngine';
import { PIANO_PRESETS } from '../audio/PianoPresets';
import { engine } from '../../audio/engine';

interface PianoState {
  open: boolean;
  focused: boolean;
  quality: PianoQuality;
  presetId: string;
  octave: number;
  transpose: number;
  velocity: number;
  lastVelocity: number;
  keyScale: number;
  volume: number;
  reverb: number;
  tone: number;
  release: number;
  stereoWidth: number;
  sustain: boolean;
  showMore: boolean;
  viewportStart: number;
  litNotes: Set<number>;
  presetName: string;
  lastNote: string;
  midiStatus: string;
  audioStatus: string;
  loadProgress: number;
  loadLabel: string;
  midiDeviceId: string | null;
  initPiano(): Promise<void>;
  setFocused(f: boolean): void;
  setOpen(open: boolean): void;
  setKeyScale(v: number): void;
  setPreset(id: string): void;
  setQuality(q: PianoQuality): void;
  setOctave(v: number): void;
  setTranspose(v: number): void;
  setVelocity(v: number): void;
  setVolume(v: number): void;
  setReverb(v: number): void;
  setTone(v: number): void;
  setRelease(v: number): void;
  setStereoWidth(v: number): void;
  toggleSustain(): void;
  setSustain(on: boolean): void;
  setShowMore(s: boolean): void;
  panViewport(delta: number): void;
  setLitNote(note: number, on: boolean): void;
  selectMidiDevice(id: string | null): void;
}

export const usePianoStore = create<PianoState>((set, get) => {
  pianoEngine.onNoteVisual = (note, on) => get().setLitNote(note, on);

  pianoEngine.setDisplayCallback((patch) => {
    set((s) => ({
      lastNote: patch.lastNote ?? s.lastNote,
      lastVelocity: patch.lastVelocity ?? s.lastVelocity,
      sustain: patch.sustain ?? s.sustain,
      audioStatus: patch.audioStatus ?? s.audioStatus,
      loadProgress: patch.loadProgress ?? s.loadProgress,
      loadLabel: patch.loadLabel ?? s.loadLabel,
    }));
  });

  pianoMidi.onStatusChange = (label) => set({ midiStatus: label });

  return {
    open: false,
    focused: false,
    quality: 'standard',
    presetId: 'grand',
    octave: 0,
    transpose: 0,
    velocity: 100,
    lastVelocity: 0,
    keyScale: 1,
    volume: 0.85,
    reverb: 0.38,
    tone: 0.55,
    release: 0.45,
    stereoWidth: 0.7,
    sustain: false,
    showMore: false,
    viewportStart: Math.max(0, whiteKeyIndex(60) - 7),
    litNotes: new Set<number>(),
    presetName: 'Grand Piano',
    lastNote: '—',
    midiStatus: 'MIDI OFF',
    audioStatus: 'TAP TO ENABLE',
    loadProgress: 0,
    loadLabel: '',
    midiDeviceId: null,

    async initPiano() {
      if (!engine.ctx) await engine.init();
      if (!engine.ctx) return;
      pianoMidi.attach(pianoEngine);
      await pianoEngine.init(engine.ctx, get().quality);
      await pianoMidi.connect();
      const preset = PIANO_PRESETS.find((p) => p.id === get().presetId)!;
      set({
        audioStatus: 'PIANO READY',
        presetName: preset.name,
        volume: preset.volume,
        reverb: preset.reverb,
        tone: preset.brightness,
        release: preset.release,
        stereoWidth: preset.stereoWidth,
      });
      pianoEngine.setVelocity(get().velocity);
    },

    setFocused(f) { set({ focused: f }); },
    setOpen(open) { set({ open }); },
    setKeyScale(v) { set({ keyScale: Math.max(0.65, Math.min(1.6, v)) }); },

    setPreset(id) {
      pianoEngine.setPreset(id);
      const p = PIANO_PRESETS.find((x) => x.id === id)!;
      set({
        presetId: id,
        presetName: p.name,
        volume: p.volume,
        reverb: p.reverb,
        tone: p.brightness,
        release: p.release,
        stereoWidth: p.stereoWidth,
      });
    },

    setQuality(q) {
      set({ quality: q });
      void pianoEngine.setQuality(q);
    },

    setOctave(v) {
      const clamped = Math.max(-3, Math.min(3, v));
      pianoEngine.setOctave(clamped);
      set({ octave: clamped });
    },

    setTranspose(v) {
      const clamped = Math.max(-12, Math.min(12, v));
      pianoEngine.setTranspose(clamped);
      set({ transpose: clamped });
    },

    setVelocity(v) {
      const clamped = Math.max(1, Math.min(127, Math.round(v)));
      pianoEngine.setVelocity(clamped);
      set({ velocity: clamped });
    },

    setVolume(v) {
      pianoEngine.setVolume(v);
      set({ volume: v });
    },

    setReverb(v) {
      pianoEngine.setReverb(v);
      set({ reverb: v });
    },

    setTone(v) {
      pianoEngine.setTone(v);
      set({ tone: v });
    },

    setRelease(v) {
      pianoEngine.setRelease(v);
      set({ release: v });
    },

    setStereoWidth(v) {
      pianoEngine.setStereoWidth(v);
      set({ stereoWidth: v });
    },

    toggleSustain() {
      const next = !get().sustain;
      pianoEngine.setSustain(next);
      set({ sustain: next });
    },

    setSustain(on) {
      pianoEngine.setSustain(on);
      set({ sustain: on });
    },

    setShowMore(s) { set({ showMore: s }); },

    panViewport(delta) {
      set((s) => ({
        viewportStart: Math.max(0, Math.min(52 - 7, s.viewportStart + delta)),
      }));
    },

    setLitNote(note, on) {
      set((s) => {
        const next = new Set(s.litNotes);
        if (on) next.add(note);
        else next.delete(note);
        return { litNotes: next };
      });
    },

    selectMidiDevice(id) {
      pianoMidi.selectInput(id);
      set({ midiDeviceId: id });
    },
  };
});

export { pianoEngine };
