import { PPQN } from './types';
import type { Pad, Project, Sequence } from './types';
import { triggerVoice, type Voice } from './voice';
import { applySwing } from './scheduler';
import { resolvePlayback, reverseBuffer, reverseRegion } from './playback';

/**
 * Render a sequence (or a whole song) to a WAV blob.
 *
 * OfflineAudioContext renders faster than realtime and is sample-accurate, so
 * the export must sound identical to playback — that's the acceptance test for
 * this phase. Reusing triggerVoice + resolvePlayback keeps export aligned with
 * the live engine.
 */

export interface ExportOptions {
  project: Project;
  /** Sequences to render in order. */
  order: { bank: number; slot: number }[];
  getBuffer(sampleId: string): AudioBuffer | null;
  /** Extra time for reverb/delay tails. */
  tailSeconds?: number;
  sampleRate?: number;
  kitVolumeDb?: number;
  masterVolume?: number;
  compressor?: { attack: number; release: number; amount: number };
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

function dbToGain(db: number): number {
  return db === -Infinity ? 0 : Math.pow(10, db / 20);
}

interface ActiveVoice {
  pad: number;
  bank: number;
  muteGroup: number | null;
  voice: Voice;
}

function scheduleHit(
  ctx: OfflineAudioContext,
  project: Project,
  pad: Pad,
  padIndex: number,
  bankIndex: number,
  when: number,
  velocity: number,
  bpm: number,
  destination: AudioNode,
  copyBuffer: (id: string, reverse?: boolean) => AudioBuffer | null,
  stretchCache: Map<string, AudioBuffer>,
  active: ActiveVoice[],
): void {
  if (!pad.sampleId || pad.muted) return;

  const raw = copyBuffer(pad.sampleId, false);
  if (!raw) return;

  const buffer = pad.reverse ? copyBuffer(pad.sampleId, true) : raw;
  if (!buffer) return;

  if (pad.muteGroup !== null) {
    for (let i = active.length - 1; i >= 0; i--) {
      const v = active[i];
      if (v.muteGroup === pad.muteGroup) {
        v.voice.kill(when);
        active.splice(i, 1);
      }
    }
  }

  if (pad.polyphony === 'mono') {
    for (let i = active.length - 1; i >= 0; i--) {
      const v = active[i];
      if (v.pad === padIndex && v.bank === bankIndex) {
        v.voice.kill(when);
        active.splice(i, 1);
      }
    }
  }

  const region = reverseRegion(buffer.length, undefined, pad);
  const resolved = resolvePlayback(ctx, pad, buffer, bpm, stretchCache, region);
  const playPad = resolved.padOverride ? { ...pad, ...resolved.padOverride } : pad;
  const playRegion = resolved.padOverride ? undefined : region;
  const offsetSec = (pad.offset / 100) * 0.25;

  const voice = triggerVoice({
    ctx: ctx as unknown as AudioContext,
    buffer: resolved.buffer,
    pad: playPad,
    padIndex,
    bankIndex,
    destination,
    when: when + offsetSec,
    velocity,
    slice: playRegion,
    rate: resolved.rate,
  });

  active.push({ pad: padIndex, bank: bankIndex, muteGroup: pad.muteGroup, voice });

  if (pad.padLink !== null && pad.padLink !== padIndex) {
    const linked = project.banks[bankIndex]?.[pad.padLink];
    if (linked && linked.padLink === null) {
      scheduleHit(
        ctx,
        project,
        linked,
        pad.padLink,
        bankIndex,
        when,
        velocity,
        bpm,
        destination,
        copyBuffer,
        stretchCache,
        active,
      );
    }
  }
}

export async function renderToWav(opts: ExportOptions): Promise<Blob | null> {
  const { project, order, getBuffer } = opts;
  if (order.length === 0) return null;

  const sampleRate = opts.sampleRate ?? 44100;
  const tail = opts.tailSeconds ?? 2;

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

  const master = ctx.createGain();
  master.gain.value = opts.masterVolume ?? 1;

  const comp = ctx.createDynamicsCompressor();
  const c = opts.compressor ?? { attack: 0, release: 0, amount: 0 };
  const attackMs = 0.1 + c.attack * 150;
  const releaseMs = 3 + c.release * 297;
  comp.attack.value = attackMs / 1000;
  comp.release.value = releaseMs / 1000;
  const n = Math.max(0, Math.min(1, c.amount));
  comp.threshold.value = -6 - n * 40;
  comp.ratio.value = 1 + n * 19;

  const kitGain = ctx.createGain();
  kitGain.gain.value = dbToGain(opts.kitVolumeDb ?? 0);

  kitGain.connect(comp);
  comp.connect(master);
  master.connect(ctx.destination);

  const padGains = Array.from({ length: 16 }, () => {
    const g = ctx.createGain();
    g.connect(kitGain);
    return g;
  });

  const copies = new Map<string, AudioBuffer>();
  const reversed = new Map<string, AudioBuffer>();
  const stretchCache = new Map<string, AudioBuffer>();

  const copyBuffer = (id: string, reverse = false): AudioBuffer | null => {
    const cache = reverse ? reversed : copies;
    const cached = cache.get(id);
    if (cached) return cached;
    const src = getBuffer(id);
    if (!src) return null;
    const out = reverse
      ? reverseBuffer(ctx, src)
      : (() => {
          const buf = ctx.createBuffer(src.numberOfChannels, src.length, src.sampleRate);
          for (let ch = 0; ch < src.numberOfChannels; ch++) {
            buf.getChannelData(ch).set(src.getChannelData(ch));
          }
          return buf;
        })();
    cache.set(id, out);
    return out;
  };

  const active: ActiveVoice[] = [];

  order.forEach(({ bank, slot }, i) => {
    const seq = project.sequences[bank]?.[slot];
    if (!seq) return;
    const bpm = project.bpmScope === 'global' ? project.bpm : seq.bpm;
    const secPerTick = 60 / bpm / PPQN;
    const base = starts[i];

    for (const e of seq.events) {
      const pad = project.banks[e.bank]?.[e.pad];
      if (!pad) continue;

      const swung = applySwing(e.tick, project.swing);
      const when = base + swung * secPerTick;

      scheduleHit(
        ctx,
        project,
        pad,
        e.pad,
        e.bank,
        when,
        e.velocity,
        bpm,
        padGains[e.pad],
        copyBuffer,
        stretchCache,
        active,
      );
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
  getBuffer: (id: string) => AudioBuffer | null,
  mix?: Pick<ExportOptions, 'kitVolumeDb' | 'masterVolume' | 'compressor'>
): Promise<AudioBuffer | null> {
  const blob = await renderToWav({
    project,
    order: [{ bank, slot }],
    getBuffer,
    tailSeconds: 1,
    ...mix,
  });
  if (!blob) return null;
  const ab = await blob.arrayBuffer();
  const ctx = new OfflineAudioContext(2, 1, 44100);
  return ctx.decodeAudioData(ab);
}
