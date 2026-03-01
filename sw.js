const CACHE_NAME    = 'grove-reader-v1';
const CACHE_VERSION = 1;

// File-file yang di-cache saat install (app shell)
const APP_SHELL = [
  './grove_reader.html',
  './manifest.json',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
];

// CDN yang boleh di-cache
const CACHEABLE_ORIGINS = [
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
  'https://cdn.jsdelivr.net',
  'https://cdnjs.cloudflare.com',
];

// ============================================================
// INSTALL — cache app shell
// ============================================================
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Install cache partial fail:', err))
  );
});

// ============================================================
// ACTIVATE — hapus cache lama
// ============================================================
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => {
            console.log('[SW] Deleting old cache:', k);
            return caches.delete(k);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ============================================================
// FETCH — Cache-first untuk app shell & CDN assets
// ============================================================
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Hanya handle GET
  if (event.request.method !== 'GET') return;

  // Abaikan chrome-extension dan non-http
  if (!url.protocol.startsWith('http')) return;

  const isSameOrigin   = url.origin === self.location.origin;
  const isCacheableCDN = CACHEABLE_ORIGINS.some(o => url.origin === new URL(o).origin);

  if (!isSameOrigin && !isCacheableCDN) return;

  // Strategi: Cache-first, fallback ke network, simpan ke cache
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        // Jangan cache response error atau non-basic
        if (!response || response.status !== 200) return response;

        // Clone sebelum di-consume
        const toCache = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
        return response;
      }).catch(() => {
        // Offline fallback — kembalikan app shell jika ada
        if (isSameOrigin && url.pathname.endsWith('.html')) {
          return caches.match('./grove_reader.html');
        }
      });
    })
  );
});

// ============================================================
// MESSAGE — dari app untuk trigger update
// ============================================================
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
