/**
 * Downloads curated CC0 (public-domain) real samples and bakes them into the
 * 16-pad factory-kit WAV format under public/samples/. Dev-time only (run
 * `npm run fetch-samples`); the resulting WAVs are committed and served like the
 * synthesized factory kits, but from /samples/ instead of /factory/wav/.
 *
 * Sources (all CC0):
 *   Drums    — github.com/Boochi44/free-drum-samples
 *   Melodic  — github.com/sgossner/VCSL (Versilian Community Sample Library)
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outRoot = join(root, 'public/samples');
const tmp = join(root, '.sample-tmp');

const DRUM_PADS = ['Kick', 'Kick 2', 'Snare', 'Snare 2', 'Hat', 'Hat O', 'Hat C', 'Perc',
  'Clap', 'Clap 2', 'Tom L', 'Tom M', 'Tom H', 'Tom HH', 'Rim', 'Crash'];
const MELODIC_PADS = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5',
  'D5', 'E5', 'F5', 'G5', 'A5', 'B5', 'C6', 'D6'];
const MELODIC_MIDI = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81, 83, 84, 86];

// ── Drum kits (Boochi44) — map its category folders onto the 16 drum pads. ────
const DRUM_KITS = [
  { id: 'real-trap', name: 'Trap Real', dir: '01-hard-trap' },
  { id: 'real-bounce', name: 'Bounce Real', dir: '02-bounce' },
  { id: 'real-vintage', name: 'Vintage Real', dir: '03-soulful-vintage' },
];
// pad -> {category, index} into Boochi44 folders (clamped to what exists)
const DRUM_MAP = [
  ['kicks', 0], ['808s', 0], ['snares', 0], ['snares', 1],
  ['hi-hats', 0], ['open-hats', 0], ['hi-hats', 1], ['percs', 0],
  ['claps', 0], ['claps', 1], ['percs', 1], ['percs', 2],
  ['percs', 3], ['808s', 1], ['percs', 0], ['fx', 0],
];

// ── Melodic instruments (VCSL) — real recorded, pitch-mapped across the pads. ─
const MEL_KITS = [
  { id: 'real-marimba', name: 'Marimba', path: 'Idiophones/Struck Idiophones/Marimba' },
  { id: 'real-vibraphone', name: 'Vibraphone', path: 'Idiophones/Struck Idiophones/Vibraphone' },
  { id: 'real-glockenspiel', name: 'Glockenspiel', path: 'Idiophones/Struck Idiophones/Glockenspiel' },
  { id: 'real-xylophone', name: 'Xylophone', path: 'Idiophones/Struck Idiophones/Xylophone' },
  { id: 'real-tubular-bells', name: 'Tubular Bells', path: 'Idiophones/Struck Idiophones/Tubular Bells 1' },
  { id: 'real-balafon', name: 'Balafon', path: 'Idiophones/Struck Idiophones/Balafon' },
  { id: 'real-harp', name: 'Concert Harp', path: 'Chordophones/Composite Chordophones/Concert Harp' },
  { id: 'real-kalimba', name: 'Kalimba', path: 'Idiophones/Plucked Idiophones/Kalimba, Kenya' },
];
const VEL_PREF = ['med', 'mf', 'vl2', 'mp', 'f1', 'soft', 'vl1'];

const NOTE_IDX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function noteToMidi(tok) {
  const m = /^([A-G])(#?)(-?\d)$/.exec(tok);
  if (!m) return null;
  return (Number(m[3]) + 1) * 12 + NOTE_IDX[m[1]] + (m[2] ? 1 : 0);
}

const enc = (p) => p.split('/').map(encodeURIComponent).join('/');
async function ghTree(repo, treeRef) {
  const url = `https://api.github.com/repos/${repo}/git/trees/${treeRef}?recursive=1`;
  const res = await fetch(url, { headers: { 'User-Agent': 'akai-kit-prep' } });
  if (!res.ok) throw new Error(`GitHub tree ${treeRef}: ${res.status}`);
  const json = await res.json();
  return (json.tree || []).filter((t) => t.type === 'blob').map((t) => t.path);
}
async function download(url, dest) {
  const res = await fetch(url, { headers: { 'User-Agent': 'akai-kit-prep' } });
  if (!res.ok) throw new Error(`download ${url}: ${res.status}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

function sampleRateOf(src) {
  try {
    const out = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'a:0',
      '-show_entries', 'stream=sample_rate', '-of', 'default=nk=1:nw=1', src]).toString().trim();
    return parseInt(out, 10) || 44100;
  } catch { return 44100; }
}

/**
 * ffmpeg: mono 44.1k 16-bit, trim leading silence; optional semitone shift
 * (sampler-style — asetrate uses the *input* rate so the transpose is correct).
 * `cap` bounds long melodic tails with a fade so the bundle stays small.
 */
function renderWav(src, dst, semi = 0, cap = 0) {
  const filters = [];
  if (semi !== 0) {
    const inSr = sampleRateOf(src);
    const ratio = Math.pow(2, semi / 12);
    filters.push(`asetrate=${Math.round(inSr * ratio)}`, 'aresample=44100');
  }
  filters.push('silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0');
  if (cap > 0) filters.push(`atrim=0:${cap}`, `afade=t=out:st=${(cap - 0.25).toFixed(2)}:d=0.25`);
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error', '-i', src,
    '-ac', '1', '-ar', '44100', '-sample_fmt', 's16',
    '-af', filters.join(','), dst,
  ]);
}

async function buildDrumKit(kit) {
  const paths = (await ghTree('Boochi44/free-drum-samples', 'main'))
    .filter((p) => p.startsWith(`drum-samples/${kit.dir}/`) && p.endsWith('.wav'));
  const byCat = {};
  for (const p of paths) {
    const cat = p.split('/')[2];
    (byCat[cat] ||= []).push(p);
  }
  for (const k of Object.keys(byCat)) byCat[k].sort();
  const dir = join(outRoot, kit.id);
  mkdirSync(dir, { recursive: true });
  for (let i = 0; i < 16; i++) {
    const [cat, idx] = DRUM_MAP[i];
    const list = byCat[cat] || byCat['percs'] || paths;
    const chosen = list[Math.min(idx, list.length - 1)] || paths[0];
    const raw = join(tmp, `d_${kit.id}_${i}.wav`);
    await download(`https://raw.githubusercontent.com/Boochi44/free-drum-samples/main/${enc(chosen)}`, raw);
    renderWav(raw, join(dir, `pad-${String(i + 1).padStart(2, '0')}.wav`), 0);
  }
  console.log(`  ${kit.id}: 16 pads`);
}

async function buildMelodicKit(kit) {
  const paths = (await ghTree('sgossner/VCSL', `master:${enc(kit.path)}`))
    .filter((p) => p.endsWith('.wav'));
  // note MIDI -> best file (prefer a medium velocity layer)
  const byNote = {};
  for (const p of paths) {
    const base = p.split('/').pop();
    let note = null;
    for (const tok of base.replace(/\.wav$/i, '').split(/[_\s.]+/)) {
      const midi = noteToMidi(tok);
      if (midi != null) { note = midi; break; }
    }
    if (note == null) continue;
    const score = VEL_PREF.findIndex((v) => base.toLowerCase().includes(v));
    const rank = score < 0 ? 99 : score;
    if (!byNote[note] || rank < byNote[note].rank) byNote[note] = { path: p, rank };
  }
  const recorded = Object.keys(byNote).map(Number).sort((a, b) => a - b);
  if (recorded.length === 0) throw new Error(`no pitched samples for ${kit.id}`);
  const dir = join(outRoot, kit.id);
  mkdirSync(dir, { recursive: true });
  const cache = {};
  for (let i = 0; i < 16; i++) {
    const target = MELODIC_MIDI[i];
    const src = recorded.reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a));
    if (!cache[src]) {
      const raw = join(tmp, `m_${kit.id}_${src}.wav`);
      await download(`https://raw.githubusercontent.com/sgossner/VCSL/master/${enc(kit.path + '/' + byNote[src].path)}`, raw);
      cache[src] = raw;
    }
    renderWav(cache[src], join(dir, `pad-${String(i + 1).padStart(2, '0')}.wav`), target - src, 3.2);
  }
  console.log(`  ${kit.id}: 16 pads (recorded notes ${recorded.length})`);
}

async function main() {
  if (existsSync(outRoot)) rmSync(outRoot, { recursive: true });
  mkdirSync(outRoot, { recursive: true });
  mkdirSync(tmp, { recursive: true });

  console.log('Drum kits…');
  for (const kit of DRUM_KITS) await buildDrumKit(kit);
  console.log('Melodic instruments…');
  for (const kit of MEL_KITS) await buildMelodicKit(kit);

  const manifest = {
    generated: new Date().toISOString(),
    drums: DRUM_KITS.map((k) => ({ id: k.id, name: k.name, padNames: DRUM_PADS })),
    melodic: MEL_KITS.map((k) => ({ id: k.id, name: k.name, padNames: MELODIC_PADS })),
  };
  writeFileSync(join(outRoot, 'manifest.json'), JSON.stringify(manifest, null, 2));
  writeFileSync(join(outRoot, 'CREDITS.md'),
    '# Factory sample credits (all CC0 / public domain)\n\n' +
    '- Drums: Boochi44/free-drum-samples (CC0) — https://github.com/Boochi44/free-drum-samples\n' +
    '- Melodic: Versilian Community Sample Library / VCSL (CC0) — https://github.com/sgossner/VCSL\n\n' +
    'CC0 requires no attribution; credited here as good practice.\n');
  rmSync(tmp, { recursive: true, force: true });
  console.log(`Done — ${DRUM_KITS.length + MEL_KITS.length} real kits under public/samples/`);
}

main().catch((e) => { console.error(e); process.exit(1); });
