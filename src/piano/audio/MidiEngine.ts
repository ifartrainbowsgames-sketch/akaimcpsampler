import type { PianoEngine } from './PianoEngine';

/** Piano-dedicated Web MIDI input (separate from MPC pad routing). */
export class PianoMidiEngine {
  private access: MIDIAccess | null = null;
  private inputId: string | null = null;
  private piano: PianoEngine | null = null;
  private sustainPedal = false;

  onStatusChange: ((label: string) => void) | null = null;

  get available() {
    return typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;
  }

  get deviceNames(): string[] {
    if (!this.access) return [];
    return [...this.access.inputs.values()].map((p) => p.id);
  }

  get deviceLabels(): string[] {
    if (!this.access) return [];
    return [...this.access.inputs.values()].map((p) => p.name ?? 'MIDI Input');
  }

  attach(piano: PianoEngine) {
    this.piano = piano;
  }

  async connect(): Promise<boolean> {
    if (!this.available) {
      this.onStatusChange?.('MIDI OFF');
      return false;
    }
    try {
      this.access = await navigator.requestMIDIAccess({ sysex: false });
    } catch {
      this.onStatusChange?.('MIDI OFF');
      return false;
    }
    this.access.onstatechange = () => this.bind();
    this.bind();
    return true;
  }

  selectInput(id: string | null) {
    this.inputId = id;
    this.bind();
  }

  private bind() {
    if (!this.access) return;
    this.access.inputs.forEach((input) => {
      input.onmidimessage = input.id === this.inputId ? (e) => this.handle(e) : null;
    });
    if (this.inputId) {
      const port = this.access.inputs.get(this.inputId);
      this.onStatusChange?.(port?.name ?? 'MIDI CONNECTED');
    } else {
      this.onStatusChange?.('MIDI OFF');
    }
  }

  private handle(e: MIDIMessageEvent) {
    const data = e.data;
    if (!data || !this.piano) return;
    const status = data[0] & 0xf0;
    const note = data[1];
    const vel = data[2] ?? 0;

    if (status === 0xb0 && note === 64) {
      this.sustainPedal = vel >= 64;
      this.piano.setSustain(this.sustainPedal);
      return;
    }

    if (status === 0x90 && vel > 0) {
      this.piano.noteOn(note, vel, 'midi');
    } else if (status === 0x80 || (status === 0x90 && vel === 0)) {
      this.piano.noteOff(note, 'midi');
    }
  }

  disconnect() {
    this.access?.inputs.forEach((input) => { input.onmidimessage = null; });
    this.access = null;
    this.onStatusChange?.('MIDI OFF');
  }
}

export const pianoMidi = new PianoMidiEngine();
