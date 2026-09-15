const CACHE_VERSION = 'v6';
const CACHE_NAME = `bci-parkshare-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline.html';

const PRECACHE_ASSETS = [
  OFFLINE_URL,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  // API and MCP routes: always network, fall back to error response.
  // Data must always be fresh.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/mcp/') || url.pathname.startsWith('/ws/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Dev-only module requests (Vite's unbundled /src/ modules, HMR client
  // deps, and query-stringed requests) are NOT content-hashed, so they must
  // always be re-validated against the network.
  const isUnhashedDevAsset =
    url.pathname.includes('/src/') ||
    url.pathname.includes('/@') ||
    url.pathname.includes('/node_modules/') ||
    (url.search && !url.pathname.startsWith('/assets/'));

  if (isUnhashedDevAsset) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Production build output: JS/CSS/images under /assets/ are content-hashed
  // by Vite (the filename changes whenever the content does), so they are
  // safe to serve cache-first forever. This is what avoids re-downloading
  // the whole bundle on every cold open.
  const isHashedBuildAsset = url.pathname.startsWith('/assets/');

  if (isHashedBuildAsset) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Images outside /assets/ (e.g. static icons in /public): stale-while-revalidate
  if (request.destination === 'image') {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Page navigation: network with offline fallback, so the HTML shell (and
  // therefore deploys) always stay fresh.
  if (request.mode === 'navigate') {
    event.respondWith(networkWithOfflineFallback(request));
    return;
  }

  // Everything else (manifest.json, favicon, etc.): network-first to avoid
  // serving stale unhashed assets.
  event.respondWith(networkFirst(request));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return new Response('', { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.destination === 'document') {
      return caches.match(OFFLINE_URL);
    }
    return new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        const cache = caches.open(CACHE_NAME);
        cache.then((c) => c.put(request, response.clone()));
      }
      return response;
    })
    .catch(() => cached || new Response('', { status: 503 }));

  return cached || fetchPromise;
}

async function networkWithOfflineFallback(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return caches.match(OFFLINE_URL);
  }
}

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((names) => Promise.all(names.map((n) => caches.delete(n))));
  }
});
