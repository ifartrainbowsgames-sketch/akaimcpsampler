/**
 * Cache-first service worker so the app opens offline.
 *
 * Note: installed PWAs on recent iOS have had audio regressions where sound
 * breaks after first use. Test PWA mode on a physical device before relying
 * on it — Capacitor is the fallback and it's the same codebase.
 */
const CACHE = 'sampler-v2';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/index.html'])));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // Hashed build assets should always come from the network so deploys show up.
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then((hit) =>
      hit ||
      fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      }).catch(() => caches.match('/index.html'))
    )
  );
});
