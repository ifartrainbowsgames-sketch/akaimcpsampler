import type { LibrarySearchResult, LibrarySound } from './types';
import { getFreesoundApiKey, hasFreesoundApiKey } from '../storage/libraryKeys';

interface FreesoundPreviews {
  'preview-hq-mp3'?: string;
  'preview-lq-mp3'?: string;
}

interface FreesoundHit {
  id: number;
  name: string;
  duration: number;
  username?: string;
  license?: string;
  previews?: FreesoundPreviews;
}

interface FreesoundSearchResponse {
  count: number;
  num_pages: number;
  results: FreesoundHit[];
}

const FIELDS = 'id,name,duration,previews,username,license';

function mapHit(hit: FreesoundHit): LibrarySound | null {
  const previewUrl =
    hit.previews?.['preview-hq-mp3'] ??
    hit.previews?.['preview-lq-mp3'];
  if (!previewUrl) return null;
  return {
    id: String(hit.id),
    name: hit.name,
    duration: hit.duration,
    provider: 'freesound',
    author: hit.username,
    license: hit.license,
    previewUrl,
  };
}

async function searchViaProxy(
  query: string,
  page: number,
  filter: string,
): Promise<LibrarySearchResult | null> {
  const params = new URLSearchParams({
    q: query,
    page: String(page),
    filter,
  });
  const res = await fetch(`/api/freesound/search?${params}`);
  if (res.status === 503) return null;
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `Search failed (${res.status})`);
  }
  const data = await res.json() as FreesoundSearchResponse;
  return {
    sounds: data.results.map(mapHit).filter((s): s is LibrarySound => s !== null),
    page,
    numPages: data.num_pages,
    count: data.count,
  };
}

async function searchDirect(
  query: string,
  page: number,
  filter: string,
  token: string,
): Promise<LibrarySearchResult> {
  const params = new URLSearchParams({
    query,
    page: String(page),
    fields: FIELDS,
    filter,
    token,
  });
  const res = await fetch(`https://freesound.org/apiv2/search/?${params}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { detail?: string };
    throw new Error(body.detail ?? `Freesound search failed (${res.status})`);
  }
  const data = await res.json() as FreesoundSearchResponse;
  return {
    sounds: data.results.map(mapHit).filter((s): s is LibrarySound => s !== null),
    page,
    numPages: data.num_pages,
    count: data.count,
  };
}

export async function searchFreesound(
  query: string,
  page = 1,
  filter = 'duration:[0 TO 8]',
): Promise<LibrarySearchResult> {
  const token = getFreesoundApiKey();
  if (token) {
    try {
      return await searchDirect(query, page, filter, token);
    } catch (e) {
      // Fall through to server proxy if direct call fails (e.g. bad key).
      if (!(e instanceof Error) || !e.message.includes('401')) throw e;
    }
  }

  const viaProxy = await searchViaProxy(query, page, filter);
  if (viaProxy) return viaProxy;

  throw new Error(
    'Connect Freesound: paste your free API key below, or ask the site admin to set FREESOUND_API_KEY on Vercel.',
  );
}

/** Fetch preview audio bytes for loading onto a pad. */
export async function fetchFreesoundPreview(
  soundId: string,
  previewUrl?: string,
): Promise<ArrayBuffer> {
  const proxy = await fetch(`/api/freesound/preview?id=${encodeURIComponent(soundId)}`);
  if (proxy.ok) return proxy.arrayBuffer();

  if (previewUrl) {
    const audioRes = await fetch(previewUrl);
    if (audioRes.ok) return audioRes.arrayBuffer();
  }

  const token = getFreesoundApiKey();
  if (!token) throw new Error('Cannot download preview — add a Freesound API key');

  const metaRes = await fetch(
    `https://freesound.org/apiv2/sounds/${soundId}/?fields=previews&token=${token}`,
  );
  if (!metaRes.ok) throw new Error('Could not load sound metadata');
  const meta = await metaRes.json() as { previews?: FreesoundPreviews };
  const url =
    meta.previews?.['preview-hq-mp3'] ??
    meta.previews?.['preview-lq-mp3'];
  if (!url) throw new Error('No preview available');

  const audioRes = await fetch(url);
  if (!audioRes.ok) throw new Error('Preview download failed');
  return audioRes.arrayBuffer();
}

export async function checkFreesoundProxy(): Promise<boolean> {
  if (hasFreesoundApiKey()) return true;
  try {
    const res = await fetch('/api/freesound/status');
    if (!res.ok) return false;
    const data = await res.json() as { configured?: boolean };
    return !!data.configured;
  } catch {
    return false;
  }
}
