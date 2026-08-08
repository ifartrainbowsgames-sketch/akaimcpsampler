import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const token = process.env.FREESOUND_API_KEY;
  if (!token) {
    res.status(503).json({ error: 'FREESOUND_API_KEY not configured on server' });
    return;
  }

  const id = String(req.query.id ?? '');
  if (!id) {
    res.status(400).json({ error: 'Missing sound id' });
    return;
  }

  try {
    const metaRes = await fetch(
      `https://freesound.org/apiv2/sounds/${id}/?fields=previews&token=${token}`,
    );
    if (!metaRes.ok) {
      res.status(metaRes.status).json({ error: 'Sound not found' });
      return;
    }
    const meta = await metaRes.json() as {
      previews?: Record<string, string>;
    };
    const url =
      meta.previews?.['preview-hq-mp3'] ??
      meta.previews?.['preview-lq-mp3'];
    if (!url) {
      res.status(404).json({ error: 'No preview for this sound' });
      return;
    }

    const audioRes = await fetch(url);
    if (!audioRes.ok) {
      res.status(502).json({ error: 'Preview fetch failed' });
      return;
    }

    const buf = Buffer.from(await audioRes.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.status(200).send(buf);
  } catch {
    res.status(502).json({ error: 'Preview proxy failed' });
  }
}
