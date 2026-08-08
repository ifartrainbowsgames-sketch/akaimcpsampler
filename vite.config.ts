import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import type { ServerResponse } from 'node:http';

const FIELDS = 'id,name,duration,previews,username,license';

function freesoundDevProxy(env: Record<string, string>): Plugin {
  return {
    name: 'freesound-dev-proxy',
    configureServer(server) {
      const token = env.FREESOUND_API_KEY;
      if (!token) return;

      const sendJson = (res: ServerResponse, code: number, body: unknown) => {
        res.statusCode = code;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(body));
      };

      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/freesound/')) return next();

        if (req.url === '/api/freesound/status') {
          sendJson(res, 200, { configured: true });
          return;
        }

        const url = new URL(req.url, 'http://localhost');

        if (req.url.startsWith('/api/freesound/search')) {
          const params = new URLSearchParams({
            query: url.searchParams.get('q') ?? 'drum',
            page: url.searchParams.get('page') ?? '1',
            fields: FIELDS,
            filter: url.searchParams.get('filter') ?? 'duration:[0 TO 8]',
            token,
          });
          try {
            const upstream = await fetch(`https://freesound.org/apiv2/search/?${params}`);
            const data = await upstream.json();
            sendJson(res, upstream.status, data);
          } catch {
            sendJson(res, 502, { error: 'Freesound unreachable' });
          }
          return;
        }

        if (req.url.startsWith('/api/freesound/preview')) {
          const id = url.searchParams.get('id');
          if (!id) {
            sendJson(res, 400, { error: 'Missing id' });
            return;
          }
          try {
            const metaRes = await fetch(
              `https://freesound.org/apiv2/sounds/${id}/?fields=previews&token=${token}`,
            );
            const meta = await metaRes.json() as { previews?: Record<string, string> };
            const preview =
              meta.previews?.['preview-hq-mp3'] ??
              meta.previews?.['preview-lq-mp3'];
            if (!preview) {
              sendJson(res, 404, { error: 'No preview' });
              return;
            }
            const audioRes = await fetch(preview);
            const buf = Buffer.from(await audioRes.arrayBuffer());
            res.statusCode = 200;
            res.setHeader('Content-Type', 'audio/mpeg');
            res.end(buf);
          } catch {
            sendJson(res, 502, { error: 'Preview failed' });
          }
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), freesoundDevProxy(env)],
    server: { port: 5173 },
    build: { target: 'es2022' },
  };
});
