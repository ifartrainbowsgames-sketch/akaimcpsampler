import { PPQN, TICKS_PER_8TH, TICKS_PER_16TH } from './types';
import type { Sequence, SeqEvent } from './types';

/**
 * Lookahead scheduling, per "A Tale of Two Clocks".
 *
 * A JS timer ticks every SCHEDULE_INTERVAL and hands every event falling
 * within LOOKAHEAD to Web Audio with an absolute future timestamp. The audio
 * thread then executes them sample-accurately regardless of timer jitter.
 *
 * Do not replace this with setInterval-fires-the-sound. Do not replace it with
 * requestAnimationFrame (stops in background tabs). Do not use an AudioWorklet
 * as the clock (fires every 128 frames, ~2.7ms, far more often than needed).
 */
const SCHEDULE_INTERVAL = 25; // ms between ticks
const LOOKAHEAD = 0.1;        // seconds of events scheduled ahead

/**
 * Roger Linn's swing: delay every even-numbered 16th note within each 8th.
 * The percentage is the share of the 8th note given to the FIRST 16th.
 *
 *   50%    straight
 *   54%    loosens a straight beat without reading as swing
 *   62%    classic loose hip-hop feel
 *   66.67% perfect triplet swing
 *
 * Applied at playback time, never baked into stored events, so it stays a live
 * performance control.
 */
export function applySwing(tick: number, swingPct: number): number {
  if (swingPct <= 50) return tick;
  const posIn8th = tick % TICKS_PER_8TH;
  // Only the offbeat 16th of each pair moves.
  if (posIn8th < TICKS_PER_16TH) return tick;
  // ...and only if it sits exactly on the 16th grid. Unquantized
  // finger-drumming passes through untouched — that raw feel is the point.
  if (posIn8th !== TICKS_PER_16TH) return tick;
  const delay = (swingPct / 100 - 0.5) * TICKS_PER_8TH;
  return tick + delay;
}

export function quantizeTick(tick: number, division: number): number {
  return Math.round(tick / division) * division;
}

export function ticksPerBar(timeSig: [number, number]): number {
  const [num, den] = timeSig;
  return (PPQN * 4 * num) / den;
}

export interface TransportState {
  playing: boolean;
  recording: boolean;
  /** Position in ticks within the current sequence. */
  positionTicks: number;
  /** For UI: which 16th step is currently sounding. */
  currentStep: number;
}

export interface SchedulerHost {
  ctx: AudioContext;
  getSequence(): Sequence | null;
  getBpm(): number;
  getSwing(): number;
  getTimeSignature(): [number, number];
  /** Fire a note. `when` is an absolute AudioContext time. */
  playEvent(e: SeqEvent, when: number): void;
  /** Optional metronome click. */
  click?(when: number, accent: boolean): void;
  metronomeEnabled(): boolean;
  /** Called on the main thread each tick so the UI can mirror position. */
  onPosition(state: TransportState): void;
}

export class Scheduler {
  private host: SchedulerHost;
  private timer: number | null = null;
  private worker: Worker | null = null;

  /** AudioContext time at which the current loop pass started. */
  private loopStartTime = 0;
  /** Next tick within the sequence we have not yet scheduled. */
  private nextTick = 0;
  private loopLengthTicks = 0;
  private lastClickTick = -1;

  state: TransportState = {
    playing: false,
    recording: false,
    positionTicks: 0,
    currentStep: 0,
  };

  constructor(host: SchedulerHost) {
    this.host = host;
    this.spawnWorker();
  }

  /**
   * The tick runs from a Worker timer because browsers throttle main-thread
   * timers hard in background tabs, which would stall playback.
   */
  private spawnWorker() {
    const src = `
      let id = null;
      self.onmessage = (e) => {
        if (e.data === 'start' && id === null) {
          id = setInterval(() => self.postMessage('tick'), ${SCHEDULE_INTERVAL});
        } else if (e.data === 'stop') {
          clearInterval(id); id = null;
        }
      };`;
    try {
      const url = URL.createObjectURL(new Blob([src], { type: 'application/javascript' }));
      this.worker = new Worker(url);
      this.worker.onmessage = () => this.tick();
    } catch {
      this.worker = null; // fall back to setInterval
    }
  }

  private secPerTick(): number {
    return 60 / this.host.getBpm() / PPQN;
  }

  start(fromTick = 0) {
    const seq = this.host.getSequence();
    if (!seq) return;
    const ctx = this.host.ctx;
    this.loopLengthTicks = seq.bars * ticksPerBar(this.host.getTimeSignature());
    this.nextTick = fromTick;
    this.lastClickTick = -1;
    // Small offset so the first events aren't scheduled in the past.
    this.loopStartTime = ctx.currentTime + 0.06 - fromTick * this.secPerTick();
    this.state.playing = true;

    if (this.worker) this.worker.postMessage('start');
    else this.timer = window.setInterval(() => this.tick(), SCHEDULE_INTERVAL);
    this.tick();
  }

  stop() {
    this.state.playing = false;
    this.state.recording = false;
    this.state.positionTicks = 0;
    this.state.currentStep = 0;
    if (this.worker) this.worker.postMessage('stop');
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.host.onPosition({ ...this.state });
  }

  /** Absolute AudioContext time for a tick in the current loop pass. */
  private timeForTick(tick: number): number {
    return this.loopStartTime + tick * this.secPerTick();
  }

  /** Current playhead in ticks, derived from the audio clock (never drifts). */
  currentTick(): number {
    if (!this.state.playing) return 0;
    const elapsed = this.host.ctx.currentTime - this.loopStartTime;
    return Math.max(0, elapsed / this.secPerTick());
  }

  private tick() {
    if (!this.state.playing) return;
    const seq = this.host.getSequence();
    if (!seq) return;

    const ctx = this.host.ctx;
    const horizon = ctx.currentTime + LOOKAHEAD;

    // Recompute loop length in case bars changed mid-playback.
    const bar = ticksPerBar(this.host.getTimeSignature());
    this.loopLengthTicks = seq.bars * bar;

    const swing = this.host.getSwing();

    while (this.timeForTick(this.nextTick) < horizon) {
      const tickInLoop = this.nextTick % this.loopLengthTicks;

      // --- metronome ---
      if (this.host.metronomeEnabled() && tickInLoop % PPQN === 0) {
        if (this.nextTick !== this.lastClickTick) {
          this.host.click?.(this.timeForTick(this.nextTick), tickInLoop % bar === 0);
          this.lastClickTick = this.nextTick;
        }
      }

      // --- events landing on this tick, after swing ---
      for (const e of seq.events) {
        const swung = applySwing(e.tick, swing);
        // Events are stored on the raw grid; compare against the swung
        // position rounded to the nearest whole tick.
        if (Math.round(swung) === tickInLoop) {
          this.host.playEvent(e, this.timeForTick(this.nextTick));
        }
      }

      this.nextTick += 1;

      // Wrap: re-anchor the loop start so the next pass lines up exactly.
      if (this.nextTick % this.loopLengthTicks === 0 && this.nextTick > 0) {
        // No re-anchoring needed — nextTick keeps counting and timeForTick
        // stays linear, which avoids accumulating rounding error.
      }
    }

    const pos = this.currentTick() % this.loopLengthTicks;
    this.state.positionTicks = pos;
    this.state.currentStep = Math.floor(pos / TICKS_PER_16TH);
    this.host.onPosition({ ...this.state });
  }

  /** Record a live hit at the current playhead, honouring record quantize. */
  recordHit(
    seq: Sequence,
    pad: number,
    bank: number,
    velocity: number,
    quantize: number | null
  ): SeqEvent {
    const raw = this.currentTick() % this.loopLengthTicks;
    const tick = quantize ? quantizeTick(raw, quantize) % this.loopLengthTicks : Math.round(raw);
    const ev: SeqEvent = { tick, pad, bank, velocity, duration: TICKS_PER_16TH };
    // Keep the list tick-sorted so the scheduler can advance a cursor rather
    // than filtering the whole array every tick.
    const i = seq.events.findIndex((e) => e.tick > tick);
    if (i === -1) seq.events.push(ev);
    else seq.events.splice(i, 0, ev);
    return ev;
  }

  dispose() {
    this.stop();
    this.worker?.terminate();
    this.worker = null;
  }
}
