import { PPQN } from './types';
import type { Pad, Project, Sequence } from './types';
import { triggerVoice } from './voice';
import { applySwing } from './scheduler';

/**
 * Render a sequence (or a whole song) to a WAV blob.
 *
 * OfflineAudioContext renders faster than realtime and is sample-accurate, so
 * the export must sound identical to playback — that's the acceptance test for
 * this phase. Reusing triggerVoice rather than reimplementing playback is what
 * guarantees it.
 */

export interface ExportOptions {
  project: Project;
  /** Sequences to render in order. */
  order: { bank: number; slot: number }[];
  getBuffer(sampleId: string): AudioBuffer | null;
  /** Extra time for reverb/delay tails. */
  tailSeconds?: number;
  sampleRate?: number;
}

function ticksPerBar(project: Project): number {
  const [num, den] = project.timeSignature;
  return (PPQN * 4 * num) / den;
}

function sequenceSeconds(project: Project, seq: Sequence): number {
  const bpm = project.bpmScope === 'global' ? project.bpm : seq.bpm;
  const secPerTick = 60 / bpm / PPQN;
  return seq.bars * ticksPerBar(project) * secPerTick;
}

export async function renderToWav(opts: ExportOptions): Promise<Blob | null> {
  const { project, order, getBuffer } = opts;
  if (order.length === 0) return null;

  const sampleRate = opts.sampleRate ?? 44100;
  const tail = opts.tailSeconds ?? 2;

  // Work out the total duration first — OfflineAudioContext needs it upfront.
  let total = 0;
  const starts: number[] = [];
  for (const { bank, slot } of order) {
    const seq = project.sequences[bank]?.[slot];
    if (!seq) continue;
    starts.push(total);
    total += sequenceSeconds(project, seq);
  }
  if (total <= 0) return null;

  const ctx = new OfflineAudioContext(
    2,
    Math.ceil((total + tail) * sampleRate),
    sampleRate
  );

  // Mirror the live master chain so the export matches what you heard.
  const master = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -6;
  comp.ratio.value = 2;
  comp.attack.value = 0.012;
  comp.release.value = 0.11;
  comp.connect(master);
  master.connect(ctx.destination);

  const padGains = Array.from({ length: 16 }, () => {
    const g = ctx.createGain();
    g.connect(comp);
    return g;
  });

  // Buffers must be copied into the offline context — an AudioBuffer belongs
  // to the context that created it.
  const copies = new Map<string, AudioBuffer>();
  const copyBuffer = (id: string): AudioBuffer | null => {
    const cached = copies.get(id);
    if (cached) return cached;
    const src = getBuffer(id);
    if (!src) return null;
    const out = ctx.createBuffer(src.numberOfChannels, src.length, src.sampleRate);
    for (let ch = 0; ch < src.numberOfChannels; ch++) {
      out.getChannelData(ch).set(src.getChannelData(ch));
    }
    copies.set(id, out);
    return out;
  };

  order.forEach(({ bank, slot }, i) => {
    const seq = project.sequences[bank]?.[slot];
    if (!seq) return;
    const bpm = project.bpmScope === 'global' ? project.bpm : seq.bpm;
    const secPerTick = 60 / bpm / PPQN;
    const base = starts[i];

    for (const e of seq.events) {
      const pad: Pad | undefined = project.banks[e.bank]?.[e.pad];
      if (!pad?.sampleId || pad.muted) continue;
      const buffer = copyBuffer(pad.sampleId);
      if (!buffer) continue;

      const swung = applySwing(e.tick, project.swing);
      const when = base + swung * secPerTick;

      triggerVoice({
        ctx: ctx as unknown as AudioContext,
        buffer,
        pad,
        padIndex: e.pad,
        bankIndex: e.bank,
        destination: padGains[e.pad],
        when,
        velocity: e.velocity,
      });
    }
  });

  const rendered = await ctx.startRendering();
  return encodeWav(rendered);
}

export function encodeWav(buffer: AudioBuffer): Blob {
  const ch = buffer.numberOfChannels;
  const len = buffer.length * ch * 2 + 44;
  const ab = new ArrayBuffer(len);
  const view = new DataView(ab);
  const str = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };

  str(0, 'RIFF');
  view.setUint32(4, len - 8, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, ch, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * ch * 2, true);
  view.setUint16(32, ch * 2, true);
  view.setUint16(34, 16, true);
  str(36, 'data');
  view.setUint32(40, len - 44, true);

  let off = 44;
  const chans = Array.from({ length: ch }, (_, i) => buffer.getChannelData(i));
  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < ch; c++) {
      const s = Math.max(-1, Math.min(1, chans[c][i]));
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      off += 2;
    }
  }
  return new Blob([ab], { type: 'audio/wav' });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Render a single sequence into a new AudioBuffer — used by Resample. */
export async function resampleSequence(
  project: Project,
  bank: number,
  slot: number,
  getBuffer: (id: string) => AudioBuffer | null
): Promise<AudioBuffer | null> {
  const blob = await renderToWav({
    project,
    order: [{ bank, slot }],
    getBuffer,
    tailSeconds: 1,
  });
  if (!blob) return null;
  const ab = await blob.arrayBuffer();
  const ctx = new OfflineAudioContext(2, 1, 44100);
  return ctx.decodeAudioData(ab);
}
