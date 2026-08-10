/**
 * Web MIDI in/out. Covers ports, channels, thru and clock.
 */
export interface MidiConfig {
  inChannel: number | 'all';
  outChannel: number;
  padMidiIn: boolean;
  padMidiOut: boolean;
  syncOut: boolean;
  syncIn: boolean;
  thru: boolean;
}

export const DEFAULT_MIDI: MidiConfig = {
  inChannel: 'all',
  outChannel: 1,
  padMidiIn: true,
  padMidiOut: false,
  syncOut: false,
  syncIn: false,
  thru: false,
};

const BASE_NOTE = 36;

export class Midi {
  private access: MIDIAccess | null = null;
  config: MidiConfig = { ...DEFAULT_MIDI };

  onPadOn: ((pad: number, velocity: number) => void) | null = null;
  onPadOff: ((pad: number) => void) | null = null;
  onCC: ((channel: number, cc: number, value: number) => void) | null = null;

  get available() {
    return typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;
  }

  setConfig(c: MidiConfig) {
    this.config = { ...c };
  }

  async connect(): Promise<boolean> {
    if (!this.available) return false;
    try {
      this.access = await navigator.requestMIDIAccess({ sysex: false });
    } catch {
      return false;
    }
    this.bindInputs();
    this.access.onstatechange = () => this.bindInputs();
    return true;
  }

  get inputs(): string[] {
    if (!this.access) return [];
    return Array.from(this.access.inputs.values()).map((p) => p.name ?? 'Input');
  }

  get outputs(): string[] {
    if (!this.access) return [];
    return Array.from(this.access.outputs.values()).map((p) => p.name ?? 'Output');
  }

  private bindInputs() {
    if (!this.access) return;
    this.access.inputs.forEach((input) => {
      input.onmidimessage = (e: MIDIMessageEvent) => this.handle(e);
    });
  }

  private handle(e: MIDIMessageEvent) {
    const data = e.data;
    if (!data || data.length < 2) return;

    if (this.config.thru) {
      this.sendAll(Array.from(data));
    }

    const status = data[0] & 0xf0;
    const channel = (data[0] & 0x0f) + 1;

    if (status === 0xf8 && this.config.syncIn) {
      return;
    }

    if (this.config.inChannel !== 'all' && channel !== this.config.inChannel) return;
    if (!this.config.padMidiIn) return;

    // CC messages
    if (status === 0xb0) {
      const cc = data[1];
      const value = data[2] ?? 0;
      this.onCC?.(channel, cc, value);
      return;
    }

    const note = data[1];
    const velocity = data[2] ?? 0;
    const pad = note - BASE_NOTE;
    if (pad < 0 || pad > 15) return;

    if (status === 0x90 && velocity > 0) this.onPadOn?.(pad, velocity);
    else if (status === 0x80 || (status === 0x90 && velocity === 0)) this.onPadOff?.(pad);
  }

  private sendAll(bytes: number[], timestamp?: number) {
    this.access?.outputs.forEach((out) => {
      try { out.send(bytes, timestamp); } catch { /* port closed */ }
    });
  }

  padOn(pad: number, velocity: number) {
    if (!this.config.padMidiOut) return;
    const ch = (this.config.outChannel - 1) & 0x0f;
    this.sendAll([0x90 | ch, BASE_NOTE + pad, velocity]);
  }

  padOff(pad: number) {
    if (!this.config.padMidiOut) return;
    const ch = (this.config.outChannel - 1) & 0x0f;
    this.sendAll([0x80 | ch, BASE_NOTE + pad, 0]);
  }

  clock() { if (this.config.syncOut) this.sendAll([0xf8]); }
  start() { if (this.config.syncOut) this.sendAll([0xfa]); }
  stop() { if (this.config.syncOut) this.sendAll([0xfc]); }
}

export const midi = new Midi();
