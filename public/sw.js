/**
 * Cache-first service worker so the app opens offline.
 *
 * HTML is always network-first so deploys reach tablets without a hard reset.
 * Hashed /assets/* are also network-first.
 */
const CACHE = 'sampler-v13';

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function isDocumentRequest(url, request) {
  return request.mode === 'navigate'
    || request.destination === 'document'
    || url.pathname === '/'
    || url.pathname === '/index.html';
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/assets/') || isDocumentRequest(url, e.request)) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.ok && isDocumentRequest(url, e.request)) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => caches.match(e.request).then((hit) => hit || caches.match('/index.html')))
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

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
