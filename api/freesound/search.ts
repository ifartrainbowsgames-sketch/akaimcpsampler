import type { VercelRequest, VercelResponse } from '@vercel/node';

const FIELDS = 'id,name,duration,previews,username,license';

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

  const q = String(req.query.q ?? 'drum');
  const page = String(req.query.page ?? '1');
  const filter = String(req.query.filter ?? 'duration:[0 TO 8]');

  const params = new URLSearchParams({
    query: q,
    page,
    fields: FIELDS,
    filter,
    token,
  });

  try {
    const upstream = await fetch(`https://freesound.org/apiv2/search/?${params}`);
    const data = await upstream.json();
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.status(upstream.status).json(data);
  } catch {
    res.status(502).json({ error: 'Freesound upstream unreachable' });
  }
}
