import { PPQN, TICKS_PER_8TH, TICKS_PER_16TH } from './types';
import type { Sequence, SeqEvent } from './types';

/**
 * Lookahead scheduling, per "A Tale of Two Clocks".
 */
const SCHEDULE_INTERVAL = 25;
const LOOKAHEAD = 0.1;

export function applySwing(tick: number, swingPct: number): number {
  if (swingPct <= 50) return tick;
  const posIn8th = tick % TICKS_PER_8TH;
  if (posIn8th < TICKS_PER_16TH) return tick;
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
  /** True once count-in bars have elapsed. */
  recordingLive: boolean;
  positionTicks: number;
  currentStep: number;
}

export interface SchedulerHost {
  ctx: AudioContext;
  getSequence(): Sequence | null;
  getBpm(): number;
  getSwing(): number;
  getTimeSignature(): [number, number];
  playEvent(e: SeqEvent, when: number): void;
  click?(when: number, accent: boolean): void;
  metronomeEnabled(): boolean;
  countInBars(): number;
  onPosition(state: TransportState): void;
  onLoopComplete?(): void;
}

export class Scheduler {
  private host: SchedulerHost;
  private timer: number | null = null;
  private worker: Worker | null = null;

  private loopStartTime = 0;
  private nextTick = 0;
  private loopLengthTicks = 0;
  private lastClickTick = -1;
  private countInTicks = 0;
  private countInDone = true;
  private lastLoopIndex = 0;

  state: TransportState = {
    playing: false,
    recording: false,
    recordingLive: false,
    positionTicks: 0,
    currentStep: 0,
  };

  constructor(host: SchedulerHost) {
    this.host = host;
    this.spawnWorker();
  }

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
      this.worker = null;
    }
  }

  private secPerTick(): number {
    return 60 / this.host.getBpm() / PPQN;
  }

  start(fromTick = 0, countInBars = 0) {
    const seq = this.host.getSequence();
    if (!seq) return;
    const ctx = this.host.ctx;
    this.loopLengthTicks = seq.bars * ticksPerBar(this.host.getTimeSignature());
    this.nextTick = fromTick;
    this.lastClickTick = -1;
    this.lastLoopIndex = Math.floor(fromTick / this.loopLengthTicks);
    this.countInTicks = countInBars * ticksPerBar(this.host.getTimeSignature());
    this.countInDone = this.countInTicks === 0;
    this.state.recordingLive = this.countInDone && this.state.recording;
    this.loopStartTime = ctx.currentTime + 0.06 - fromTick * this.secPerTick();
    this.state.playing = true;

    if (this.worker) this.worker.postMessage('start');
    else this.timer = window.setInterval(() => this.tick(), SCHEDULE_INTERVAL);
    this.tick();
  }

  stop() {
    this.state.playing = false;
    this.state.recording = false;
    this.state.recordingLive = false;
    this.state.positionTicks = 0;
    this.state.currentStep = 0;
    this.countInTicks = 0;
    this.countInDone = true;
    if (this.worker) this.worker.postMessage('stop');
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.host.onPosition({ ...this.state });
  }

  private timeForTick(tick: number): number {
    return this.loopStartTime + tick * this.secPerTick();
  }

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
    const bar = ticksPerBar(this.host.getTimeSignature());
    this.loopLengthTicks = seq.bars * bar;
    const swing = this.host.getSwing();
    const rawPos = this.currentTick();
    const inCountIn = !this.countInDone && rawPos < this.countInTicks;

    if (!this.countInDone && rawPos >= this.countInTicks) {
      this.countInDone = true;
      this.state.recordingLive = this.state.recording;
    }

    while (this.timeForTick(this.nextTick) < horizon) {
      const tickInLoop = this.nextTick % this.loopLengthTicks;
      const loopIndex = Math.floor(this.nextTick / this.loopLengthTicks);

      if (loopIndex > this.lastLoopIndex && tickInLoop === 0 && this.nextTick > 0) {
        this.host.onLoopComplete?.();
        this.lastLoopIndex = loopIndex;
      }

      const metronomeOn = this.host.metronomeEnabled() || inCountIn;
      if (metronomeOn && tickInLoop % PPQN === 0) {
        if (this.nextTick !== this.lastClickTick) {
          this.host.click?.(this.timeForTick(this.nextTick), tickInLoop % bar === 0);
          this.lastClickTick = this.nextTick;
        }
      }

      if (!inCountIn) {
        for (const e of seq.events) {
          const swung = applySwing(e.tick, swing);
          if (Math.round(swung) === tickInLoop) {
            this.host.playEvent(e, this.timeForTick(this.nextTick));
          }
        }
      }

      this.nextTick += 1;
    }

    const pos = inCountIn
      ? rawPos % Math.max(1, this.countInTicks)
      : (rawPos - this.countInTicks) % this.loopLengthTicks;
    this.state.positionTicks = Math.max(0, pos);
    this.state.currentStep = Math.floor(pos / TICKS_PER_16TH);
    this.host.onPosition({ ...this.state });
  }

  recordHit(
    seq: Sequence,
    pad: number,
    bank: number,
    velocity: number,
    quantize: number | null
  ): SeqEvent {
    const loopLen = this.loopLengthTicks || seq.bars * ticksPerBar(this.host.getTimeSignature());
    const raw = this.countInDone
      ? (this.currentTick() - this.countInTicks) % loopLen
      : 0;
    const tick = quantize ? quantizeTick(raw, quantize) % loopLen : Math.round(raw);
    const ev: SeqEvent = { tick, pad, bank, velocity, duration: TICKS_PER_16TH };
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
