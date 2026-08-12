/**
 * Generates all factory kit WAV files. Invoked by generate-factory-kits.mjs via tsx.
 */
import { mkdirSync, writeFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FACTORY_KITS } from '../src/audio/factory/catalog.ts';
import { nodeSynthCtx, synthesizeKit, type SynthBuffer } from '../src/audio/factory/synthCore.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outRoot = join(root, 'public/factory/wav');

function encodeWav(buf: SynthBuffer): Buffer {
  const ch = buf.numberOfChannels;
  const len = buf.length * ch * 2 + 44;
  const ab = Buffer.alloc(len);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) ab[off + i] = s.charCodeAt(i);
  };
  writeStr(0, 'RIFF');
  ab.writeUInt32LE(len - 8, 4);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  ab.writeUInt32LE(16, 16);
  ab.writeUInt16LE(1, 20);
  ab.writeUInt16LE(ch, 22);
  ab.writeUInt32LE(buf.sampleRate, 24);
  ab.writeUInt32LE(buf.sampleRate * ch * 2, 28);
  ab.writeUInt16LE(ch * 2, 32);
  ab.writeUInt16LE(16, 34);
  writeStr(36, 'data');
  ab.writeUInt32LE(len - 44, 40);
  let off = 44;
  const chans = Array.from({ length: ch }, (_, i) => buf.getChannelData(i));
  for (let i = 0; i < buf.length; i++) {
    for (let c = 0; c < ch; c++) {
      const s = Math.max(-1, Math.min(1, chans[c][i]));
      ab.writeInt16LE(s < 0 ? s * 0x8000 : s * 0x7fff, off);
      off += 2;
    }
  }
  return ab;
}

function writeManifest() {
  const manifest = {
    version: 5,
    count: FACTORY_KITS.length,
    note: `${FACTORY_KITS.length} WAV kits, 16 pads each under public/factory/wav/{id}/`,
    kits: FACTORY_KITS.map((k) => ({
      id: k.id,
      name: k.name,
      category: k.category,
      template: k.template,
    })),
  };
  writeFileSync(join(root, 'public/factory/kits.json'), JSON.stringify(manifest, null, 2));
}

function main() {
  console.log(`Generating ${FACTORY_KITS.length} factory kits…`);

  if (existsSync(outRoot)) {
    rmSync(outRoot, { recursive: true });
  }
  mkdirSync(outRoot, { recursive: true });

  const ctx = nodeSynthCtx(44100);
  let files = 0;

  for (const kit of FACTORY_KITS) {
    const dir = join(outRoot, kit.id);
    mkdirSync(dir, { recursive: true });
    const buffers = synthesizeKit(ctx, kit.template, kit.variant);
    for (let i = 0; i < 16; i++) {
      const wav = encodeWav(buffers[i]);
      const name = `pad-${String(i + 1).padStart(2, '0')}.wav`;
      writeFileSync(join(dir, name), wav);
      files++;
    }
  }

  writeManifest();
  const dirs = readdirSync(outRoot).filter((d) => !d.startsWith('.'));
  console.log(`Done — ${dirs.length} kits, ${files} WAV files → public/factory/wav/`);
}

main();
