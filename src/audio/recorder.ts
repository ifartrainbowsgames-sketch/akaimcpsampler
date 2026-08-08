import { encodeWav } from './export';

/**
 * Sample recording from mic. Maintains a rolling Recall buffer once open.
 */
const RECALL_SECONDS = 25;

export type RecordSource = 'mic' | 'resample';

export class Recorder {
  private ctx: AudioContext;
  private stream: MediaStream | null = null;
  private srcNode: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private silentOut: GainNode | null = null;
  private monitorGain: GainNode;

  private ring: Float32Array[] = [];
  private ringWrite = 0;
  private ringSize = 0;

  /** Stereo pairs [L0, R0, L1, R1, …] per audio callback. */
  private capturing: Float32Array[] = [];
  private capturingLength = 0;
  recording = false;
  level = 0;

  liveChops: number[] = [];

  constructor(ctx: AudioContext, monitorDestination: AudioNode) {
    this.ctx = ctx;
    this.monitorGain = ctx.createGain();
    this.monitorGain.gain.value = 0;
    this.monitorGain.connect(monitorDestination);
    this.ringSize = Math.ceil(ctx.sampleRate * RECALL_SECONDS);
    this.ring = [new Float32Array(this.ringSize), new Float32Array(this.ringSize)];
  }

  get permissionGranted() {
    return this.stream !== null;
  }

  /** Must be called from a user gesture on iOS. */
  async open(): Promise<boolean> {
    if (this.stream) return true;

    if (!navigator.mediaDevices?.getUserMedia) return false;

    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {
        return false;
      }
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: { ideal: 1 },
        },
      });
    } catch {
      return false;
    }

    this.srcNode = this.ctx.createMediaStreamSource(this.stream);

    const bufSize = 4096;
    this.processor = this.ctx.createScriptProcessor(bufSize, 1, 1);
    this.processor.onaudioprocess = (e) => this.onAudio(e);

    this.silentOut = this.ctx.createGain();
    this.silentOut.gain.value = 0;

    this.srcNode.connect(this.processor);
    this.srcNode.connect(this.monitorGain);
    this.processor.connect(this.silentOut);
    this.silentOut.connect(this.ctx.destination);

    return true;
  }

  private onAudio(e: AudioProcessingEvent) {
    const input = e.inputBuffer;
    const frames = input.length;
    const ch0 = input.getChannelData(0);
    const ch1 = input.numberOfChannels > 1 ? input.getChannelData(1) : ch0;

    let peak = 0;
    for (let ch = 0; ch < 2; ch++) {
      const data = ch === 0 ? ch0 : ch1;
      const ring = this.ring[ch];
      let w = this.ringWrite;
      for (let i = 0; i < frames; i++) {
        const s = data[i];
        ring[w] = s;
        w = (w + 1) % this.ringSize;
        const a = Math.abs(s);
        if (a > peak) peak = a;
      }
    }
    this.ringWrite = (this.ringWrite + frames) % this.ringSize;

    if (this.recording) {
      this.capturing.push(new Float32Array(ch0), new Float32Array(ch1));
      this.capturingLength += frames;
    }
    this.level = peak;

    const out = e.outputBuffer.getChannelData(0);
    out.fill(0);
  }

  setMonitor(on: boolean) {
    this.monitorGain.gain.setTargetAtTime(on ? 0.85 : 0, this.ctx.currentTime, 0.02);
  }

  start() {
    this.capturing = [];
    this.capturingLength = 0;
    this.liveChops = [];
    this.recording = true;
  }

  markChop() {
    if (this.recording) this.liveChops.push(this.capturingLength);
  }

  stop(): { buffer: AudioBuffer; chops: number[] } | null {
    if (!this.recording) return null;
    this.recording = false;
    if (this.capturing.length === 0 || this.capturingLength === 0) {
      this.capturing = [];
      this.capturingLength = 0;
      return null;
    }

    const frames = this.capturingLength;
    const out = this.ctx.createBuffer(2, frames, this.ctx.sampleRate);
    const L = out.getChannelData(0);
    const R = out.getChannelData(1);

    let off = 0;
    for (let i = 0; i < this.capturing.length; i += 2) {
      const l = this.capturing[i];
      const r = this.capturing[i + 1] ?? l;
      const n = Math.min(l.length, frames - off);
      if (n <= 0) break;
      L.set(l.subarray(0, n), off);
      R.set(r.subarray(0, n), off);
      off += n;
    }

    const chops = this.liveChops.slice();
    this.capturing = [];
    this.capturingLength = 0;
    return { buffer: out, chops };
  }

  recall(seconds = RECALL_SECONDS): AudioBuffer {
    const frames = Math.min(this.ringSize, Math.floor(seconds * this.ctx.sampleRate));
    const out = this.ctx.createBuffer(2, frames, this.ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const ring = this.ring[ch];
      const dst = out.getChannelData(ch);
      const start = (this.ringWrite - frames + this.ringSize) % this.ringSize;
      for (let i = 0; i < frames; i++) {
        dst[i] = ring[(start + i) % this.ringSize];
      }
    }
    return out;
  }

  toWav(buffer: AudioBuffer): Blob {
    return encodeWav(buffer);
  }

  close() {
    try {
      this.processor?.disconnect();
      this.silentOut?.disconnect();
      this.srcNode?.disconnect();
      this.stream?.getTracks().forEach((t) => t.stop());
    } catch { /* noop */ }
    this.stream = null;
    this.srcNode = null;
    this.processor = null;
    this.silentOut = null;
  }
}
