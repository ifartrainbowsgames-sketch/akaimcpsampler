/**
 * Keyboard arpeggiator: hold a set of notes and play them back one at a time in
 * a pattern, on a BPM-synced timer that runs whether or not the transport is
 * playing. The note-ordering is a pure function (arpSequence) so it's testable;
 * the Arp class just drives a clock over it and calls an injected trigger.
 */
export type ArpMode = 'up' | 'down' | 'updown' | 'random';
export type ArpRate = '1/8' | '1/16' | '1/8T' | '1/16T';

/** Beats per arp step for each rate (1 beat = a quarter note). */
const RATE_BEATS: Record<ArpRate, number> = {
  '1/8': 0.5,
  '1/16': 0.25,
  '1/8T': 1 / 3,
  '1/16T': 1 / 6,
};

/**
 * Ordered note list an arp cycles through for the given held notes, pattern and
 * octave range. For `random` the pool is returned as-is (the clock picks an
 * index); the other modes are deterministic.
 */
export function arpSequence(held: number[], mode: ArpMode, octaves: number): number[] {
  if (held.length === 0) return [];
  const base = [...new Set(held)].sort((a, b) => a - b);
  const oct = Math.max(1, Math.min(3, Math.round(octaves)));
  const expanded: number[] = [];
  for (let k = 0; k < oct; k++) for (const n of base) expanded.push(n + 12 * k);
  expanded.sort((a, b) => a - b);

  switch (mode) {
    case 'up':
      return expanded;
    case 'down':
      return [...expanded].reverse();
    case 'updown': {
      if (expanded.length <= 1) return expanded;
      const down = [...expanded].reverse().slice(1, -1); // drop repeated endpoints
      return expanded.concat(down);
    }
    case 'random':
      return expanded;
  }
}

interface ArpOpts {
  bpm: () => number;
  trigger: (pad: number, note: number, velocity: number) => void;
}

export class Arp {
  private held = new Map<number, number>(); // note -> velocity
  private pad = 0;
  private on = false;
  private mode: ArpMode = 'up';
  private rate: ArpRate = '1/16';
  private octaves = 1;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private idx = -1;

  constructor(private opts: ArpOpts) {}

  setConfig(c: { on?: boolean; mode?: ArpMode; rate?: ArpRate; octaves?: number }) {
    if (c.mode !== undefined) this.mode = c.mode;
    if (c.rate !== undefined) this.rate = c.rate;
    if (c.octaves !== undefined) this.octaves = c.octaves;
    if (c.on !== undefined) {
      this.on = c.on;
      if (!this.on) this.stop();
      else if (this.held.size) this.ensureRunning();
    }
  }

  get enabled() { return this.on; }

  noteOn(pad: number, note: number, velocity: number) {
    this.pad = pad;
    this.held.set(note, velocity);
    if (this.on) this.ensureRunning();
  }

  noteOff(note: number) {
    this.held.delete(note);
    if (this.held.size === 0) this.stop();
  }

  clear() {
    this.held.clear();
    this.stop();
  }

  private ensureRunning() {
    if (this.timer === null) {
      this.idx = -1;
      this.step();
    }
  }

  private stop() {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.idx = -1;
  }

  private velocityFor(note: number): number {
    for (let k = 0; k < 3; k++) {
      const v = this.held.get(note - 12 * k);
      if (v !== undefined) return v;
    }
    return 100;
  }

  private step = () => {
    if (!this.on || this.held.size === 0) {
      this.stop();
      return;
    }
    const seq = arpSequence([...this.held.keys()], this.mode, this.octaves);
    if (seq.length) {
      let note: number;
      if (this.mode === 'random') {
        note = seq[Math.floor(Math.random() * seq.length)];
      } else {
        this.idx = (this.idx + 1) % seq.length;
        note = seq[this.idx];
      }
      this.opts.trigger(this.pad, note, this.velocityFor(note));
    }
    const bpm = Math.max(20, this.opts.bpm());
    const ms = Math.max(20, (60000 / bpm) * RATE_BEATS[this.rate]);
    this.timer = setTimeout(this.step, ms);
  };
}
