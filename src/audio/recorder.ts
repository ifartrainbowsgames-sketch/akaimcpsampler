import { encodeWav } from './export';

/**
 * Sample recording from mic, line in, or internal resampling.
 *
 * Also maintains the Recall buffer: a rolling capture of the last 25 seconds
 * of input, always running once permission is granted, so Recall can retrieve
 * a take you didn't know you wanted. That does mean the mic stays live —
 * surface it clearly in the UI.
 */
const RECALL_SECONDS = 25;

export type RecordSource = 'mic' | 'resample';

export class Recorder {
  private ctx: AudioContext;
  private stream: MediaStream | null = null;
  private srcNode: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private monitorGain: GainNode;

  /** Rolling recall buffer. */
  private ring: Float32Array[] = [];
  private ringWrite = 0;
  private ringSize = 0;

  private capturing: Float32Array[] = [];
  private capturingLength = 0;
  recording = false;
  level = 0;

  /** Chop points dropped live while recording, in frames. */
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
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
    } catch {
      return false;
    }

    this.srcNode = this.ctx.createMediaStreamSource(this.stream);

    // ScriptProcessor is deprecated but is the only way to pull raw frames back
    // to the main thread without a MessagePort round trip per block. Recording
    // is not latency-critical, so the tradeoff is acceptable here — unlike in
    // the playback path, where it would not be.
    const bufSize = 4096;
    this.processor = this.ctx.createScriptProcessor(bufSize, 2, 2);
    this.processor.onaudioprocess = (e) => this.onAudio(e);

    this.srcNode.connect(this.processor);
    this.srcNode.connect(this.monitorGain);
    // ScriptProcessor needs a destination connection to run at all.
    this.processor.connect(this.ctx.destination);
    return true;
  }

  private onAudio(e: AudioProcessingEvent) {
    const input = e.inputBuffer;
    const chans = Math.min(2, input.numberOfChannels);
    let peak = 0;

    for (let ch = 0; ch < chans; ch++) {
      const data = input.getChannelData(ch);
      const ring = this.ring[ch];
      let w = this.ringWrite;
      for (let i = 0; i < data.length; i++) {
        const s = data[i];
        ring[w] = s;
        w = (w + 1) % this.ringSize;
        const a = Math.abs(s);
        if (a > peak) peak = a;
      }
      if (ch === chans - 1) this.ringWrite = w;

      if (this.recording) {
        this.capturing.push(new Float32Array(data));
      }
    }
    if (this.recording) this.capturingLength += input.length;
    this.level = peak;

    // Mute the monitor path's own output so we don't double it.
    for (let ch = 0; ch < e.outputBuffer.numberOfChannels; ch++) {
      e.outputBuffer.getChannelData(ch).fill(0);
    }
  }

  setMonitor(on: boolean) {
    this.monitorGain.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.02);
  }

  start() {
    this.capturing = [];
    this.capturingLength = 0;
    this.liveChops = [];
    this.recording = true;
  }

  /** Drop a chop point at the current position — the "lazy chopping" workflow. */
  markChop() {
    if (this.recording) this.liveChops.push(this.capturingLength);
  }

  stop(): { buffer: AudioBuffer; chops: number[] } | null {
    if (!this.recording) return null;
    this.recording = false;
    if (this.capturing.length === 0) return null;

    // Blocks alternate channels; de-interleave back into a stereo buffer.
    const blocks = this.capturing;
    const frames = Math.floor(this.capturingLength);
    const out = this.ctx.createBuffer(2, Math.max(1, frames), this.ctx.sampleRate);
    const L = out.getChannelData(0);
    const R = out.getChannelData(1);

    let off = 0;
    for (let i = 0; i < blocks.length; i += 2) {
      const l = blocks[i];
      const r = blocks[i + 1] ?? l;
      L.set(l.subarray(0, Math.min(l.length, frames - off)), off);
      R.set(r.subarray(0, Math.min(r.length, frames - off)), off);
      off += l.length;
      if (off >= frames) break;
    }

    const chops = this.liveChops.slice();
    this.capturing = [];
    this.capturingLength = 0;
    return { buffer: out, chops };
  }

  /** Recall: pull the last N seconds out of the rolling buffer. */
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
      this.srcNode?.disconnect();
      this.stream?.getTracks().forEach((t) => t.stop());
    } catch { /* noop */ }
    this.stream = null;
    this.srcNode = null;
    this.processor = null;
  }
}
