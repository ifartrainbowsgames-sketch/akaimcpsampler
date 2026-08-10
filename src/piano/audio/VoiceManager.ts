/** Tracks active notes for sustain, voice limits, and stuck-note prevention. */
export class VoiceManager {
  private active = new Map<number, number>();
  private sustained = new Set<number>();
  private maxVoices: number;

  constructor(maxVoices = 64) {
    this.maxVoices = maxVoices;
  }

  setMaxVoices(n: number) {
    this.maxVoices = n;
  }

  noteOn(note: number, velocity: number): boolean {
    this.active.set(note, velocity);
    return this.active.size <= this.maxVoices;
  }

  noteOff(note: number, sustainHeld: boolean): boolean {
    if (sustainHeld) {
      this.sustained.add(note);
      return false;
    }
    this.active.delete(note);
    this.sustained.delete(note);
    return true;
  }

  releaseSustain(): number[] {
    const released: number[] = [];
    for (const note of this.sustained) {
      this.active.delete(note);
      released.push(note);
    }
    this.sustained.clear();
    return released;
  }

  allNotesOff(): number[] {
    const notes = [...this.active.keys(), ...this.sustained];
    this.active.clear();
    this.sustained.clear();
    return [...new Set(notes)];
  }

  get activeCount() {
    return this.active.size;
  }

  isActive(note: number) {
    return this.active.has(note) || this.sustained.has(note);
  }
}
