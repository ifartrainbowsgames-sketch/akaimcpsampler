import { encodeWav } from './export';
import { recorderWorkletUrl } from './worklets/recorderSource';

/**
 * Sample recording from mic. Maintains a rolling Recall buffer once open.
 *
 * Uses AudioWorkletNode (off main thread) instead of the deprecated
 * ScriptProcessorNode. Falls back gracefully if the worklet fails to load.
 */
const RECALL_SECONDS = 25;
/** Cap active recording at 10 minutes to bound memory usage. */
const MAX_RECORD_SECONDS = 600;

export type RecordSource = 'mic' | 'resample';

/** Track which AudioContexts have had the recorder worklet module loaded. */
const registeredContexts = new WeakSet<BaseAudioContext>();

export class Recorder {
  private ctx: AudioContext;
  private stream: MediaStream | null = null;
  private srcNode: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private silentOut: GainNode | null = null;
  private monitorGain: GainNode;

  private ring: Float32Array[] = [];
  private ringWrite = 0;
  private ringSize = 0;

  /**
   * Pre-allocated stereo capture buffers.
   * Allocated once on start(), freed on stop()/close().
   */
  private captureL: Float32Array | null = null;
  private captureR: Float32Array | null = null;
  private capturePos = 0;
  private maxCaptureFrames = 0;

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
    this.maxCaptureFrames = Math.ceil(ctx.sampleRate * MAX_RECORD_SECONDS);
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

    // Load the recorder worklet module if not already registered for this context.
    try {
      if (!registeredContexts.has(this.ctx)) {
        const url = recorderWorkletUrl();
        await this.ctx.audioWorklet.addModule(url);
        URL.revokeObjectURL(url);
        registeredContexts.add(this.ctx);
      }
    } catch (err) {
      console.warn('[Recorder] AudioWorklet unavailable:', err);
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
      return false;
    }

    this.srcNode = this.ctx.createMediaStreamSource(this.stream);

    this.workletNode = new AudioWorkletNode(this.ctx, 'recorder-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
    });
    this.workletNode.port.onmessage = (e: MessageEvent<{
      ch0: Float32Array;
      ch1: Float32Array;
      peak: number;
    }>) => this.onAudio(e.data);

    this.silentOut = this.ctx.createGain();
    this.silentOut.gain.value = 0;

    this.srcNode.connect(this.workletNode);
    this.srcNode.connect(this.monitorGain);
    this.workletNode.connect(this.silentOut);
    this.silentOut.connect(this.ctx.destination);

    return true;
  }

  private onAudio(data: { ch0: Float32Array; ch1: Float32Array; peak: number }) {
    const { ch0, ch1, peak } = data;
    const frames = ch0.length;

    // Update ring buffer (25-second rolling recall).
    for (let ch = 0; ch < 2; ch++) {
      const src = ch === 0 ? ch0 : ch1;
      const ring = this.ring[ch];
      let w = this.ringWrite;
      for (let i = 0; i < frames; i++) {
        ring[w] = src[i];
        w = (w + 1) % this.ringSize;
      }
    }
    this.ringWrite = (this.ringWrite + frames) % this.ringSize;

    if (this.recording) {
      // Lazy-allocate the pre-allocated capture buffer on first audio chunk.
      if (!this.captureL || !this.captureR) {
        this.captureL = new Float32Array(this.maxCaptureFrames);
        this.captureR = new Float32Array(this.maxCaptureFrames);
        this.capturePos = 0;
      }
      const remaining = this.maxCaptureFrames - this.capturePos;
      const n = Math.min(frames, remaining);
      if (n > 0) {
        this.captureL.set(ch0.subarray(0, n), this.capturePos);
        this.captureR.set(ch1.subarray(0, n), this.capturePos);
        this.capturePos += n;
      }
    }

    this.level = peak;
  }

  setMonitor(on: boolean) {
    this.monitorGain.gain.setTargetAtTime(on ? 0.85 : 0, this.ctx.currentTime, 0.02);
  }

  start() {
    this.captureL = null;
    this.captureR = null;
    this.capturePos = 0;
    this.liveChops = [];
    this.recording = true;
  }

  markChop() {
    if (this.recording) this.liveChops.push(this.capturePos);
  }

  stop(): { buffer: AudioBuffer; chops: number[] } | null {
    if (!this.recording) return null;
    this.recording = false;

    const frames = this.capturePos;
    if (frames === 0 || !this.captureL || !this.captureR) {
      this.captureL = null;
      this.captureR = null;
      this.capturePos = 0;
      return null;
    }

    const out = this.ctx.createBuffer(2, frames, this.ctx.sampleRate);
    out.getChannelData(0).set(this.captureL.subarray(0, frames));
    out.getChannelData(1).set(this.captureR.subarray(0, frames));

    const chops = this.liveChops.slice();
    this.captureL = null;
    this.captureR = null;
    this.capturePos = 0;
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
    this.recording = false; // reset flag before teardown
    try {
      this.workletNode?.disconnect();
      this.silentOut?.disconnect();
      this.srcNode?.disconnect();
      this.stream?.getTracks().forEach((t) => t.stop());
    } catch (err) {
      console.warn('[Recorder] Error during close:', err);
    }
    this.stream = null;
    this.srcNode = null;
    this.workletNode = null;
    this.silentOut = null;
    this.captureL = null;
    this.captureR = null;
    this.capturePos = 0;
  }
}
