import { getContext, setContext, Sampler, now } from 'tone';
import type { PianoQuality } from '../types/piano';
import { PIANO_MAX_NOTE, PIANO_MIN_NOTE, midiToName } from '../types/piano';
import { PianoEffects } from './PianoEffects';
import { VoiceManager } from './VoiceManager';
import { getPreset } from './PianoPresets';
import { SALAMANDER_BASE, sampleUrlsForQuality, prefetchSamples } from './PianoSampleLoader';

export type NoteSource = 'touch' | 'mouse' | 'keyboard' | 'midi';

type DisplayCallback = (patch: Partial<{
  lastNote: string;
  lastVelocity: number;
  sustain: boolean;
  audioStatus: string;
  loadProgress: number;
  loadLabel: string;
}>) => void;

/** Framework-free piano engine — UI calls methods, optional display callbacks. */
export class PianoEngine {
  private sampler: Sampler | null = null;
  private fx: PianoEffects | null = null;
  private voices = new VoiceManager(64);
  private ctx: AudioContext | null = null;
  private ready = false;
  private loading = false;
  private quality: PianoQuality = 'standard';
  private presetId = 'grand';
  private sustain = false;
  private octave = 0;
  private transpose = 0;
  private releaseSec = 0.8;
  private velocitySetting = 100;
  private displayCb: DisplayCallback | null = null;

  /** Notes held by pointer/keyboard — separate from voice manager for glides. */
  private held = new Map<string, number>();

  onNoteVisual: ((note: number, on: boolean) => void) | null = null;

  setDisplayCallback(cb: DisplayCallback | null) {
    this.displayCb = cb;
  }

  get isReady() {
    return this.ready;
  }

  get isLoading() {
    return this.loading;
  }

  /** Share the sampler app's AudioContext — never create a competing context. */
  async init(existingCtx: AudioContext, quality: PianoQuality = 'standard'): Promise<void> {
    if (this.ready && this.ctx === existingCtx) return;
    this.ctx = existingCtx;
    this.quality = quality;

    if (getContext().rawContext !== existingCtx) {
      setContext(existingCtx);
    }

    if (existingCtx.state === 'suspended') {
      await existingCtx.resume();
    }

    this.displayCb?.({ audioStatus: 'LOADING PIANO', loadProgress: 0, loadLabel: 'LOADING PIANO' });
    this.loading = true;

    this.fx?.dispose();
    this.fx = new PianoEffects();
    this.fx.output.connect(existingCtx.destination);
    await this.fx.ready();

    await prefetchSamples(quality, (pct) => {
      this.displayCb?.({ loadProgress: pct, loadLabel: `LOADING PIANO ${pct}%` });
    });

    await this.loadSampler(quality);
    this.applyPreset(getPreset(this.presetId));

    this.loading = false;
    this.ready = true;
    this.displayCb?.({ audioStatus: 'PIANO READY', loadProgress: 100, loadLabel: 'PIANO READY' });
  }

  private async loadSampler(quality: PianoQuality) {
    this.sampler?.dispose();
    const urls = sampleUrlsForQuality(quality);
    this.sampler = new Sampler({
      urls,
      baseUrl: SALAMANDER_BASE,
      release: this.releaseSec,
    }).connect(this.fx!.input);

    await this.sampler.loaded;
  }

  applyPreset(preset: ReturnType<typeof getPreset>) {
    this.presetId = preset.id;
    this.setVolume(preset.volume);
    this.setReverb(preset.reverb);
    this.setTone(preset.brightness);
    this.setRelease(preset.release);
    this.setStereoWidth(preset.stereoWidth);
  }

  setPreset(id: string) {
    this.applyPreset(getPreset(id));
  }

  setQuality(quality: PianoQuality) {
    if (quality === this.quality && this.ready) return;
    this.quality = quality;
    void this.init(this.ctx!, quality);
  }

  /** Map incoming note with octave + transpose offsets. */
  mapNote(note: number): number {
    const mapped = note + this.octave * 12 + this.transpose;
    return Math.max(PIANO_MIN_NOTE, Math.min(PIANO_MAX_NOTE, mapped));
  }

  noteOn(note: number, velocity: number, source: NoteSource, holderId?: string) {
    if (!this.sampler || !this.ready) return;
    const n = this.mapNote(note);
    const vel = Math.max(1, Math.min(127, Math.round(velocity)));
    const key = holderId ?? source;
    this.voices.noteOn(n, vel);
    this.held.set(key, n);
    const t = now();
    this.sampler.triggerAttack(midiToName(n), t, vel / 127);
    this.onNoteVisual?.(n, true);
    this.displayCb?.({ lastNote: midiToName(n), lastVelocity: vel });
  }

  noteOff(note: number, source: NoteSource, holderId?: string) {
    if (!this.sampler) return;
    const key = holderId ?? source;
    const held = this.held.get(key);
    const n = held ?? this.mapNote(note);
    this.held.delete(key);
    const release = this.voices.noteOff(n, this.sustain);
    if (release) {
      this.sampler.triggerRelease(midiToName(n), now());
      this.onNoteVisual?.(n, false);
    }
  }

  /** Glide: release previous note for this pointer, attack new one. */
  glide(holderId: string, fromNote: number, toNote: number, velocity: number) {
    if (fromNote === toNote) return;
    this.noteOff(fromNote, 'touch', holderId);
    this.noteOn(toNote, velocity, 'touch', holderId);
  }

  setSustain(on: boolean) {
    this.sustain = on;
    this.displayCb?.({ sustain: on });
    if (!on && this.sampler) {
      const released = this.voices.releaseSustain();
      const t = now();
      for (const n of released) {
        this.sampler.triggerRelease(midiToName(n), t);
        this.onNoteVisual?.(n, false);
      }
    }
  }

  setOctave(v: number) {
    this.octave = Math.max(-3, Math.min(3, v));
  }

  setTranspose(v: number) {
    this.transpose = Math.max(-12, Math.min(12, v));
  }

  setVolume(v: number) {
    this.fx?.setVolume(v);
  }

  setReverb(v: number) {
    this.fx?.setReverb(v);
  }

  setTone(v: number) {
    this.fx?.setTone(v);
  }

  setRelease(v: number) {
    this.releaseSec = 0.2 + v * 2.5;
    if (this.sampler) this.sampler.release = this.releaseSec;
  }

  setStereoWidth(v: number) {
    this.fx?.setStereoWidth(v);
  }

  setVelocity(v: number) {
    this.velocitySetting = Math.max(1, Math.min(127, Math.round(v)));
  }

  getVelocity() {
    return this.velocitySetting;
  }

  allNotesOff() {
    if (!this.sampler) return;
    const notes = this.voices.allNotesOff();
    this.held.clear();
    const t = now();
    for (const n of notes) {
      this.sampler.triggerRelease(midiToName(n), t);
      this.onNoteVisual?.(n, false);
    }
  }

  dispose() {
    this.allNotesOff();
    this.sampler?.dispose();
    this.fx?.dispose();
    this.sampler = null;
    this.fx = null;
    this.ready = false;
  }
}

export const pianoEngine = new PianoEngine();
