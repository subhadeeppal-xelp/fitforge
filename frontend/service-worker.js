const CACHE_NAME = 'fitforge-v2';
const ASSETS = ['./', './index.html', './config.js', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Never cache API calls (auth, data) — always hit the network so
  // login state, tokens and live data stay correct.
  if (event.request.method !== 'GET' || event.request.url.indexOf('/api/') !== -1) {
    return; // let the browser handle it normally
  }
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
