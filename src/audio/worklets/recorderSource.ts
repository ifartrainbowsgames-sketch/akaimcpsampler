/**
 * Recorder AudioWorklet processor source, inlined as a string.
 *
 * Runs on the audio thread. Sends stereo audio chunks and peak level to the
 * main thread via MessagePort. Using AudioWorkletNode instead of the
 * deprecated ScriptProcessorNode keeps processing off the main thread.
 */
export const RECORDER_WORKLET_SOURCE = `
class RecorderProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;

    const ch0 = input[0];
    const ch1 = input.length > 1 ? input[1] : input[0];

    let peak = 0;
    for (let i = 0; i < ch0.length; i++) {
      const a = Math.abs(ch0[i]);
      if (a > peak) peak = a;
    }

    // slice() copies the data before transfer so the original input buffers
    // remain owned by the audio engine.
    const s0 = ch0.slice();
    const s1 = ch1 === ch0 ? ch0.slice() : ch1.slice();

    this.port.postMessage({ ch0: s0, ch1: s1, peak }, [s0.buffer, s1.buffer]);
    return true;
  }
}
registerProcessor('recorder-processor', RecorderProcessor);
`;

export function recorderWorkletUrl(): string {
  return URL.createObjectURL(
    new Blob([RECORDER_WORKLET_SOURCE], { type: 'application/javascript' }),
  );
}
