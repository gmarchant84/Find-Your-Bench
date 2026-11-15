// Both placeholders are replaced at build time by the fyb-sw-version plugin in
// vite.config.ts. Every deploy gets a new cache name, so old caches are
// deleted on activate and nothing from a previous build is served offline.
const BUILD_ID = '__FYB_BUILD_ID__';
const BUILD_ASSETS = /*__FYB_BUILD_ASSETS__*/[];

const CACHE_PREFIX = 'fyb-';
const CACHE_NAME = CACHE_PREFIX + BUILD_ID;
const SHELL_KEY = '/';

const PRECACHE_ASSETS = [
  SHELL_KEY,
  '/manifest.webmanifest',
  '/icon-192.svg',
  '/icon-512.svg',
  '/apple-touch-icon.svg',
  // This build's hashed JS/CSS, so the cached index.html always has the
  // assets it references when offline.
  ...BUILD_ASSETS,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // cache: 'reload' bypasses the HTTP cache so '/' is this deploy's shell.
      Promise.all(PRECACHE_ASSETS.map((u) => cache.add(new Request(u, { cache: 'reload' })).catch(() => {})))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        // Drop every older build's cache (fyb-v3 and earlier included).
        keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

function putInCache(key, response) {
  const clone = response.clone();
  caches.open(CACHE_NAME).then((cache) => cache.put(key, clone)).catch(() => {});
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  // Serverless endpoints (link previews, og images) are never cached here.
  if (url.pathname.startsWith('/api/')) return;

  // Navigations: network-first. Keep the latest shell as '/' for offline use.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const type = response.headers.get('content-type') || '';
          if (response.status === 200 && type.includes('text/html')) putInCache(SHELL_KEY, response);
          return response;
        })
        .catch(() => caches.match(SHELL_KEY).then((cached) => cached || Response.error()))
    );
    return;
  }

  // Hashed build assets are immutable: cache-first is safe and fast.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.status === 200) putInCache(request, response);
          return response;
        });
      })
    );
    return;
  }

  // Other same-origin files (icons, logo, manifest) have stable names:
  // stale-while-revalidate so updates reach existing users.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.status === 200 && response.type !== 'opaque') putInCache(request, response);
          return response;
        })
        .catch(() => cached || Response.error());
      return cached || network;
    })
  );
});
