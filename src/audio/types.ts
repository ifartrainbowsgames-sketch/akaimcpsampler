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

  /**
   * Keygroup zones. When present and non-empty, this pad is a multisample
   * instrument: a played note/velocity selects the matching zone instead of
   * using `sampleId`. Undefined = ordinary single-sample pad.
   */
  zones?: KeygroupZone[];
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

/**
 * A keygroup zone: one sample mapped to a note range + velocity layer. A pad
 * with `zones` becomes a multisample instrument — the played note/velocity
 * selects the zone, which then plays pitched relative to its `rootNote`.
 */
export interface KeygroupZone {
  sampleId: string;
  sampleName: string;
  rootNote: number;  // MIDI note at which the sample plays un-transposed
  loNote: number;
  hiNote: number;
  loVel: number;     // 1-127
  hiVel: number;
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

/**
 * A pattern clip placed on the free-form arrangement/playlist timeline.
 * References a stored Sequence by (bank, slot) — the clip is a *placement*,
 * never a copy, so editing the pattern updates every clip that uses it
 * (FL Studio's pattern-clip model).
 */
export interface PlaylistClip {
  id: string;
  /** Playlist track (row) index. */
  track: number;
  /** Referenced pattern location. */
  bank: number;
  slot: number;
  /** Absolute tick on the song timeline where the clip begins. */
  startTick: number;
  /**
   * Clip length in ticks. Usually the pattern's natural length; if longer,
   * the pattern loops to fill; if shorter, the pattern is truncated.
   */
  lengthTicks: number;
  muted?: boolean;
}

/**
 * Free-form arrangement: pattern clips painted on parallel tracks over a
 * global song timeline. Distinct from `Project.song`, which is the older
 * linear one-pattern-at-a-time chain (kept for backward compatibility and
 * used to seed a fresh arrangement).
 */
export interface Arrangement {
  /** Number of visible tracks (rows). */
  tracks: number;
  /** Total timeline length in bars (the loop extent). */
  lengthBars: number;
  clips: PlaylistClip[];
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
  /**
   * Free-form playlist. Optional so projects saved before this feature load
   * cleanly; `normalizeProject` backfills it on load.
   */
  arrangement?: Arrangement;
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

/** Default number of playlist tracks (rows) in a fresh arrangement. */
export const DEFAULT_PLAYLIST_TRACKS = 8;

export function makeArrangement(): Arrangement {
  return { tracks: DEFAULT_PLAYLIST_TRACKS, lengthBars: 16, clips: [] };
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
    arrangement: makeArrangement(),
  };
}

/**
 * Fill in fields added after a project may have been saved. Called on load so
 * older projects gain an empty arrangement instead of `undefined`. Mutates and
 * returns the same object.
 */
export function normalizeProject(p: Project): Project {
  if (!p.arrangement) p.arrangement = makeArrangement();
  return p;
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
