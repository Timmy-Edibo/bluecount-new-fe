/**
 * Bluecounts PWA Service Worker
 * Precaches main routes and caches documents/assets as they're loaded.
 */
const CACHE_NAME = 'bluecounts-v2';

const PRECACHE_URLS = ['/', '/inventory', '/staff', '/login'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k.startsWith('bluecounts-') && k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests (our app pages and assets)
  if (url.origin !== self.location.origin) return;

  // Don't cache API routes or other non-GET
  if (request.method !== 'GET') return;

  // Document (HTML) – network first, fallback to cache so reload works offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match('/').then((r) => r || new Response('Offline', { status: 503, statusText: 'Offline' })))
        )
    );
    return;
  }

  // Static assets (JS, CSS, fonts, images) – cache first, then network (stale-while-revalidate)
  const isStatic =
    url.pathname.startsWith('/_next/') ||
    url.pathname.startsWith('/icon') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.woff2');

  if (isStatic) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
        return cached || fetchPromise;
      })
    );
  }
});
