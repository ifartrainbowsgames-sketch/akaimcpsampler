/** Sequencer resolution. Matches the reference hardware. */
export const PPQN = 960;
export const TICKS_PER_BEAT = PPQN;
export const TICKS_PER_8TH = PPQN / 2; // 480
export const TICKS_PER_16TH = PPQN / 4; // 240

export const NUM_PADS = 16;
export const NUM_BANKS = 8;
export const MAX_VOICES = 32;
export const MAX_SLICES = 16;

export type FilterType =
  | 'off' | 'classic'
  | 'lpf2' | 'lpf4'
  | 'hpf2' | 'hpf4'
  | 'bpf2' | 'bpf4';

export type Polyphony = 'mono' | 'poly';
export type WarpMode = 'pitch' | 'stretch';
export type DecayFrom = 'start' | 'end';

export interface Envelope {
  /** 0-127, mapped to seconds internally. */
  attack: number;
  /** 0-127. Acts as Decay in one-shot mode, Release in note-on mode. */
  decay: number;
  decayFrom: DecayFrom;
  /** Amp env: velocity sensitivity. Filter env: modulation depth. 0-127. */
  amount: number;
}

export interface Slice {
  /** Frame offsets into the shared AudioBuffer. */
  start: number;
  end: number;
}

export interface Pad {
  sampleId: string | null;
  sampleName: string;

  /** Frame offsets into the sample buffer. */
  start: number;
  end: number;
  loopStart: number;

  slices: Slice[];
  chopType: 'threshold' | 'regions4' | 'regions8' | 'regions16' | 'manual';
  chopThreshold: number; // 0-100

  gain: number;   // dB, -Infinity to +6
  pan: number;    // -1 to 1
  semi: number;   // -24 to 24
  fine: number;   // -90 to 90 cents

  warpMode: WarpMode;
  /** 'off' | number 50-200 | 'seq' */
  warpAmount: number | 'off' | 'seq';
  beats: number;

  polyphony: Polyphony;
  muteGroup: number | null; // 1-16
  padLink: number | null;   // pad index 0-15

  noteOn: boolean;   // gate playback vs one-shot
  loop: boolean;
  reverse: boolean;

  offset: number;    // 0-100%, trigger delay

  ampEnv: Envelope;
  filterEnv: Envelope;
  filterType: FilterType;
  cutoff: number;    // 0-127
  reso: number;      // 0-127

  /** 3-band graphic EQ (-12..+12 dB per band). */
  eqEnabled: boolean;
  eqLow: number;
  eqMid: number;
  eqHigh: number;

  /** Send levels to global reverb/delay buses. 0–127, default 0. */
  reverbSend: number;
  delaySend: number;

  muted: boolean;
}

export interface SeqEvent {
  /** Absolute tick within the sequence. */
  tick: number;
  pad: number;
  bank: number;
  velocity: number; // 1-127
  duration: number; // ticks
  /** 0–100. 100 = always fires, 0 = never fires. Default: 100. */
  probability?: number;
  /**
   * MIDI note number 0–127. 60 = C4 = the pad's base pitch (no offset).
   * When undefined or 60, the pad plays at its normal pitch.
   */
  note?: number;
}

/** A recorded parameter-automation point. `value` is normalized 0..1. */
export type AutoParam = 'vol' | 'pan';
export interface AutoEvent {
  tick: number;
  pad: number;
  param: AutoParam;
  value: number;
}

export interface Sequence {
  name: string;
  /** Length in bars. */
  bars: number;
  /** Tick-sorted. Keep sorted on insert. */
  events: SeqEvent[];
  /** Per-sequence tempo, used when bpmScope is 'seq'. */
  bpm: number;
  /** Recorded mixer automation (volume/pan), replayed on playback. */
  automation?: AutoEvent[];
}

export interface Project {
  id: string;
  name: string;
  bpm: number;
  bpmScope: 'seq' | 'global';
  timeSignature: [number, number];
  /** 50-75. 50 = straight, 66.67 = triplet. */
  swing: number;
  /** Quantize division in ticks. */
  quantize: number;
  recordQuantize: boolean;
  countIn: boolean;
  metronome: 'off' | 'on' | 'record';
  /** Humanize: adds random timing/velocity variation. Both 0–100, default 0. */
  humanize: { timing: number; velocity: number };

  banks: Pad[][];        // [bank][pad]
  sequences: Sequence[][]; // [bank][slot]
  song: { bank: number; slot: number }[];
}

export function makeEnvelope(overrides: Partial<Envelope> = {}): Envelope {
  return { attack: 0, decay: 100, decayFrom: 'end', amount: 100, ...overrides };
}

export function makePad(): Pad {
  return {
    sampleId: null,
    sampleName: '',
    start: 0,
    end: 0,
    loopStart: 0,
    slices: [],
    chopType: 'regions8',
    chopThreshold: 50,
    gain: 0,
    pan: 0,
    semi: 0,
    fine: 0,
    warpMode: 'pitch',
    warpAmount: 'off',
    beats: 4,
  /** One-shot drum hits retrigger cleanly; use Poly on the Program page for pads. */
    polyphony: 'mono',
    muteGroup: null,
    padLink: null,
    noteOn: false,
    loop: false,
    reverse: false,
    offset: 0,
    ampEnv: makeEnvelope({ amount: 110 }),
    filterEnv: makeEnvelope({ amount: 0 }),
    filterType: 'off',
    cutoff: 127,
    reso: 0,
    eqEnabled: false,
    eqLow: 0,
    eqMid: 0,
    eqHigh: 0,
    reverbSend: 0,
    delaySend: 0,
    muted: false,
  };
}

export function makeSequence(name: string): Sequence {
  return { name, bars: 4, events: [], bpm: 93, automation: [] };
}

export function makeProject(name = 'New Project'): Project {
  return {
    id: crypto.randomUUID(),
    name,
    bpm: 93,
    bpmScope: 'global',
    timeSignature: [4, 4],
    swing: 50,
    quantize: TICKS_PER_16TH,
    recordQuantize: true,
    countIn: false,
    metronome: 'off',
    humanize: { timing: 0, velocity: 0 },
    banks: Array.from({ length: NUM_BANKS }, () =>
      Array.from({ length: NUM_PADS }, makePad)
    ),
    sequences: Array.from({ length: NUM_BANKS }, (_, b) =>
      Array.from({ length: NUM_PADS }, (_, i) =>
        makeSequence(`Seq ${b * NUM_PADS + i + 1}`)
      )
    ),
    song: [],
  };
}

/** One-shot pads used to default to poly — stacked hits ducked the compressor. */
export function migrateProject(p: Project): Project {
  return {
    ...p,
    humanize: p.humanize ?? { timing: 0, velocity: 0 },
    banks: p.banks.map((bank) =>
      bank.map((pad) => {
        const migrated = !pad.noteOn && pad.polyphony === 'poly'
          ? { ...pad, polyphony: 'mono' as const }
          : pad;
        return {
          ...migrated,
          reverbSend: migrated.reverbSend ?? 0,
          delaySend: migrated.delaySend ?? 0,
        };
      })
    ),
    sequences: p.sequences.map((bank) =>
      bank.map((seq) => ({
        ...seq,
        automation: seq.automation ?? [],
        events: seq.events.map((e) => ({
          ...e,
          probability: e.probability ?? 100,
          // note is optional — undefined means base pitch (same as note 60)
        })),
      }))
    ),
  };
}
