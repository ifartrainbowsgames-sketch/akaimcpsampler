/**
 * The DSP worklet source, inlined as a string.
 *
 * AudioWorklet.addModule needs a URL. Keeping the source here and handing it
 * over as a Blob URL means the worklet loads identically whether the app is
 * served from a host, opened from a file, or bundled into a single page.
 */
export const DSP_WORKLET_SOURCE = `/**
 * Bitcrush / decimate / ring mod / noise — the effects native nodes can't do.
 *
 * Worklet discipline, and it matters: no allocation inside process(), all
 * buffers preallocated in the constructor, branch-light code, denormals
 * flushed. process() runs every 128 frames (~2.7ms at 48k) on the audio
 * thread; anything slow here is an audible dropout, not a slow frame.
 */
class LoFiProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      // Bit depth. 24 = transparent, 2 = destroyed.
      { name: 'bits', defaultValue: 24, minValue: 2, maxValue: 24, automationRate: 'k-rate' },
      // Sample-rate reduction, 0-100%.
      { name: 'decimate', defaultValue: 0, minValue: 0, maxValue: 100, automationRate: 'k-rate' },
      // Ring modulator frequency in Hz. 0 disables.
      { name: 'ringFreq', defaultValue: 0, minValue: 0, maxValue: 4000, automationRate: 'k-rate' },
      { name: 'noise', defaultValue: 0, minValue: 0, maxValue: 100, automationRate: 'k-rate' },
      { name: 'mix', defaultValue: 100, minValue: 0, maxValue: 100, automationRate: 'k-rate' },
    ];
  }

  constructor() {
    super();
    // Preallocated per-channel state. Never resized during process().
    this._hold = new Float32Array(32);
    this._phase = new Float32Array(32);
    this._counter = new Float32Array(32);
    this._ringPhase = 0;
  }

  process(inputs, outputs, params) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || input.length === 0) return true;

    const bits = params.bits[0];
    const decimate = params.decimate[0];
    const ringFreq = params.ringFreq[0];
    const noiseAmt = params.noise[0] / 100;
    const mix = params.mix[0] / 100;

    // Quantisation step for the requested bit depth.
    const levels = Math.pow(2, bits);
    const step = 2 / levels;

    // Decimation: hold each sample for N frames. 0% = no holding.
    const holdFrames = 1 + (decimate / 100) * 63;

    const ringInc = ringFreq > 0 ? (2 * Math.PI * ringFreq) / sampleRate : 0;

    for (let ch = 0; ch < input.length; ch++) {
      const inBuf = input[ch];
      const outBuf = output[ch];
      if (!inBuf || !outBuf) continue;

      let hold = this._hold[ch];
      let counter = this._counter[ch];
      let ringPhase = this._ringPhase;

      for (let i = 0; i < inBuf.length; i++) {
        const dry = inBuf[i];
        let s = dry;

        // sample-rate reduction
        counter += 1;
        if (counter >= holdFrames) {
          counter -= holdFrames;
          hold = s;
        }
        s = hold;

        // bit depth reduction
        if (bits < 24) {
          s = Math.round(s / step) * step;
        }

        // ring modulation
        if (ringInc > 0) {
          s *= Math.sin(ringPhase);
          ringPhase += ringInc;
          if (ringPhase > 6.283185307179586) ringPhase -= 6.283185307179586;
        }

        // hiss
        if (noiseAmt > 0) {
          s += (Math.random() * 2 - 1) * noiseAmt * 0.05;
        }

        let out = dry * (1 - mix) + s * mix;

        // flush denormals — they cost a huge amount on some CPUs
        if (out > -1e-25 && out < 1e-25) out = 0;

        outBuf[i] = out;
      }

      this._hold[ch] = hold;
      this._counter[ch] = counter;
      if (ch === input.length - 1) this._ringPhase = ringPhase;
    }

    return true;
  }
}

registerProcessor('lofi-processor', LoFiProcessor);

/**
 * Beat Repeat / Flex Beat: a rolling buffer of recent master output that can
 * be looped, reversed, stuttered and gated in sync.
 *
 * Holds two bars at 60 BPM worth of audio, which covers every division we
 * offer at any sensible tempo.
 */
class BeatRepeatProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'active', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      // Loop length in seconds.
      { name: 'length', defaultValue: 0.25, minValue: 0.01, maxValue: 4, automationRate: 'k-rate' },
      { name: 'reverse', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'mix', defaultValue: 100, minValue: 0, maxValue: 100, automationRate: 'k-rate' },
      // Gate: 0 = off, otherwise gate rate in Hz.
      { name: 'gate', defaultValue: 0, minValue: 0, maxValue: 50, automationRate: 'k-rate' },
      // Playback rate for tape-stop and pitch effects.
      { name: 'rate', defaultValue: 1, minValue: 0.05, maxValue: 4, automationRate: 'k-rate' },
    ];
  }

  constructor() {
    super();
    this._size = Math.ceil(sampleRate * 8); // 8 seconds, preallocated
    this._buf = [new Float32Array(this._size), new Float32Array(this._size)];
    this._write = 0;
    this._read = 0;
    this._capturing = true;
    this._loopStart = 0;
    this._loopLen = 0;
    this._wasActive = false;
    this._gatePhase = 0;
  }

  process(inputs, outputs, params) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || input.length === 0) return true;

    const active = params.active[0] > 0.5;
    const lengthSec = params.length[0];
    const reverse = params.reverse[0] > 0.5;
    const mix = params.mix[0] / 100;
    const gateHz = params.gate[0];
    const rate = params.rate[0];

    // On the rising edge, freeze the most recent \`length\` of audio as the loop.
    if (active && !this._wasActive) {
      this._loopLen = Math.min(this._size, Math.floor(lengthSec * sampleRate));
      this._loopStart = (this._write - this._loopLen + this._size) % this._size;
      this._read = reverse ? this._loopLen - 1 : 0;
    }
    this._wasActive = active;

    const gateInc = gateHz > 0 ? (2 * Math.PI * gateHz) / sampleRate : 0;

    for (let ch = 0; ch < input.length && ch < 2; ch++) {
      const inBuf = input[ch];
      const outBuf = output[ch];
      const ring = this._buf[ch];
      if (!inBuf || !outBuf) continue;

      let write = this._write;
      let read = this._read;
      let gatePhase = this._gatePhase;

      for (let i = 0; i < inBuf.length; i++) {
        const dry = inBuf[i];

        // Always capture — the buffer must be warm the instant it's engaged.
        ring[write] = dry;
        write = (write + 1) % this._size;

        let out = dry;

        if (active && this._loopLen > 0) {
          const idx = (this._loopStart + Math.floor(read) + this._size) % this._size;
          let wet = ring[idx];

          if (gateInc > 0) {
            wet *= Math.sin(gatePhase) > 0 ? 1 : 0;
            gatePhase += gateInc;
            if (gatePhase > 6.283185307179586) gatePhase -= 6.283185307179586;
          }

          read += reverse ? -rate : rate;
          if (read >= this._loopLen) read -= this._loopLen;
          if (read < 0) read += this._loopLen;

          out = dry * (1 - mix) + wet * mix;
        }

        if (out > -1e-25 && out < 1e-25) out = 0;
        outBuf[i] = out;
      }

      if (ch === 0) {
        this._writeNext = write;
        this._readNext = read;
        this._gateNext = gatePhase;
      }
    }

    this._write = this._writeNext ?? this._write;
    this._read = this._readNext ?? this._read;
    this._gatePhase = this._gateNext ?? this._gatePhase;

    return true;
  }
}

registerProcessor('beat-repeat-processor', BeatRepeatProcessor);
`;

export function dspWorkletUrl(): string {
  return URL.createObjectURL(
    new Blob([DSP_WORKLET_SOURCE], { type: 'application/javascript' })
  );
}
