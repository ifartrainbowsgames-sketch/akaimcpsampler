/**
 * Flex Beat — tempo-synced master insert using the beat-repeat worklet.
 * Pad 1 = Empty; pads 2–16 trigger sequence-synced effects.
 */

import { PPQN } from '../types';

export type FlexBeatMode = 'oneshot' | 'loop';

export interface FlexBeatEffect {
  id: string;
  name: string;
  /** Division of a bar (e.g. 4 = quarter note). */
  division: number;
  reverse: boolean;
  gateHz: number;
  rate: number;
}

/** Pad index 0 = Empty; pads 1–15 map to effects. */
export const FLEX_BEAT_EFFECTS: FlexBeatEffect[] = [
  { id: 'empty', name: 'Empty', division: 4, reverse: false, gateHz: 0, rate: 1 },
  { id: 'beat1_4', name: 'Beat 1/4', division: 4, reverse: false, gateHz: 0, rate: 1 },
  { id: 'beat1_8', name: 'Beat 1/8', division: 8, reverse: false, gateHz: 0, rate: 1 },
  { id: 'beat1_16', name: 'Beat 1/16', division: 16, reverse: false, gateHz: 0, rate: 1 },
  { id: 'beat1_32', name: 'Beat 1/32', division: 32, reverse: false, gateHz: 0, rate: 1 },
  { id: 'rev1_4', name: 'Rev 1/4', division: 4, reverse: true, gateHz: 0, rate: 1 },
  { id: 'rev1_8', name: 'Rev 1/8', division: 8, reverse: true, gateHz: 0, rate: 1 },
  { id: 'half', name: 'Half Spd', division: 4, reverse: false, gateHz: 0, rate: 0.5 },
  { id: 'dbl', name: 'Dbl Spd', division: 4, reverse: false, gateHz: 0, rate: 2 },
  { id: 'gate1_8', name: 'Gate 1/8', division: 8, reverse: false, gateHz: 8, rate: 1 },
  { id: 'gate1_16', name: 'Gate 1/16', division: 16, reverse: false, gateHz: 16, rate: 1 },
  { id: 'gate1_32', name: 'Gate 1/32', division: 32, reverse: false, gateHz: 32, rate: 1 },
  { id: 'scratch', name: 'Scratch', division: 16, reverse: true, gateHz: 0, rate: 1.5 },
  { id: 'stutter', name: 'Stutter', division: 32, reverse: false, gateHz: 0, rate: 0.25 },
  { id: 'granular', name: 'Granular', division: 16, reverse: false, gateHz: 4, rate: 0.75 },
  { id: 'trance', name: 'Trance', division: 8, reverse: false, gateHz: 12, rate: 1 },
];

function secPerBar(bpm: number, timeSig: [number, number]): number {
  const [num, den] = timeSig;
  return (60 / bpm) * num * (4 / den);
}

export class FlexBeat {
  private ctx: AudioContext;
  readonly input: GainNode;
  readonly output: GainNode;
  private node: AudioWorkletNode | null = null;
  private dry: GainNode;
  private wet: GainNode;

  activePad = 0;
  mode: FlexBeatMode = 'loop';
  quantize = true;
  mix = 0.75;
  private pendingPad: number | null = null;
  private bpm = 120;
  private timeSig: [number, number] = [4, 4];
  private oneShotTimer: number | null = null;

  constructor(ctx: AudioContext, workletsReady: boolean) {
    this.ctx = ctx;
    void workletsReady;
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.dry = ctx.createGain();
    this.wet = ctx.createGain();
    this.input.connect(this.dry);
    this.dry.connect(this.output);
    if (workletsReady) {
      try {
        this.node = new AudioWorkletNode(ctx, 'beat-repeat-processor', {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [2],
        });
        this.input.connect(this.node);
        this.node.connect(this.wet);
        this.wet.connect(this.output);
      } catch {
        this.node = null;
      }
    }
    this.applyMix();
  }

  setTransport(bpm: number, timeSig: [number, number]) {
    this.bpm = bpm;
    this.timeSig = timeSig;
  }

  setMix(m: number) {
    this.mix = Math.max(0, Math.min(1, m));
    this.applyMix();
  }

  private applyMix() {
    const t = this.ctx.currentTime;
    this.dry.gain.setTargetAtTime(1 - this.mix, t, 0.01);
    this.wet.gain.setTargetAtTime(this.mix, t, 0.01);
    this.node?.parameters.get('mix')?.setValueAtTime(100, t);
  }

  /** Select pad 0–15 (0 = Empty). */
  selectPad(pad: number, opts?: { quantize?: boolean; onEngage?: () => void }) {
    const p = Math.max(0, Math.min(15, pad));
    if (opts?.quantize ?? this.quantize) {
      this.pendingPad = p;
      opts?.onEngage?.();
      return;
    }
    this.engagePad(p);
  }

  /** Call at each 16th-note boundary when quantize is on. */
  tickQuantized(boundaryTick: number) {
    if (this.pendingPad === null) return;
    if (boundaryTick % (PPQN / 4) !== 0) return;
    this.engagePad(this.pendingPad);
    this.pendingPad = null;
  }

  engagePad(pad: number) {
    this.activePad = pad;
    if (this.oneShotTimer !== null) {
      clearTimeout(this.oneShotTimer);
      this.oneShotTimer = null;
    }
    if (!this.node) return;

    const fx = FLEX_BEAT_EFFECTS[pad] ?? FLEX_BEAT_EFFECTS[0];
    const t = this.ctx.currentTime;
    const barSec = secPerBar(this.bpm, this.timeSig);
    const lengthSec = barSec / fx.division;

    if (pad === 0 || fx.id === 'empty') {
      this.node.parameters.get('active')?.setValueAtTime(0, t);
      return;
    }

    this.node.parameters.get('length')?.setValueAtTime(lengthSec, t);
    this.node.parameters.get('reverse')?.setValueAtTime(fx.reverse ? 1 : 0, t);
    this.node.parameters.get('gate')?.setValueAtTime(fx.gateHz, t);
    this.node.parameters.get('rate')?.setValueAtTime(fx.rate, t);
    this.node.parameters.get('active')?.setValueAtTime(0, t);
    this.node.parameters.get('active')?.setValueAtTime(1, t + 0.001);

    if (this.mode === 'oneshot') {
      this.oneShotTimer = window.setTimeout(() => {
        this.release();
        this.activePad = 0;
      }, lengthSec * 1000 * (fx.reverse ? 2 : 1));
    }
  }

  release() {
    if (!this.node) return;
    this.node.parameters.get('active')?.setValueAtTime(0, this.ctx.currentTime);
    if (this.oneShotTimer !== null) {
      clearTimeout(this.oneShotTimer);
      this.oneShotTimer = null;
    }
  }

  dispose() {
    this.release();
    this.node?.disconnect();
    this.dry.disconnect();
    this.wet.disconnect();
  }
}
