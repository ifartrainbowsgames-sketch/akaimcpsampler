/**
 * Sample storage in the Origin Private File System.
 *
 * OPFS rather than IndexedDB because audio files are multi-megabyte and OPFS
 * gives real file handles with no practical size ceiling. Projects — small,
 * frequently-written JSON — go elsewhere.
 */
const DIR = 'samples';

async function root(): Promise<FileSystemDirectoryHandle | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.getDirectory) return null;
  try {
    const r = await navigator.storage.getDirectory();
    return await r.getDirectoryHandle(DIR, { create: true });
  } catch {
    return null;
  }
}

export const opfsAvailable = (): boolean =>
  typeof navigator !== 'undefined' && !!navigator.storage?.getDirectory;

export async function writeSample(id: string, data: ArrayBuffer): Promise<boolean> {
  const dir = await root();
  if (!dir) return false;
  try {
    const fh = await dir.getFileHandle(`${id}.bin`, { create: true });
    const w = await fh.createWritable();
    await w.write(data);
    await w.close();
    return true;
  } catch {
    return false;
  }
}

export async function readSample(id: string): Promise<ArrayBuffer | null> {
  const dir = await root();
  if (!dir) return null;
  try {
    const fh = await dir.getFileHandle(`${id}.bin`);
    const file = await fh.getFile();
    return await file.arrayBuffer();
  } catch {
    return null;
  }
}

export async function deleteSample(id: string): Promise<void> {
  const dir = await root();
  if (!dir) return;
  try {
    await dir.removeEntry(`${id}.bin`);
  } catch {
    /* noop */
  }
}

export async function listSamples(): Promise<string[]> {
  const dir = await root();
  if (!dir) return [];
  const out: string[] = [];
  try {
    // values() exists at runtime; the DOM typings lag behind.
    const iter = (dir as unknown as { values(): AsyncIterable<FileSystemHandle> }).values();
    for await (const entry of iter) {
      if (entry.kind === 'file' && entry.name.endsWith('.bin')) {
        out.push(entry.name.replace(/\.bin$/, ''));
      }
    }
  } catch {
    /* noop */
  }
  return out;
}
