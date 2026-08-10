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

  // Sanitise caller-supplied inputs. The filter is locked server-side to prevent
  // quota injection; only q and page are passed through (with bounds).
  const rawQ = String(req.query.q ?? 'drum').slice(0, 200);
  const rawPage = parseInt(String(req.query.page ?? '1'), 10);
  const q = rawQ || 'drum';
  const page = String(Number.isFinite(rawPage) ? Math.max(1, Math.min(rawPage, 100)) : 1);
  const filter = 'duration:[0 TO 8]';

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
