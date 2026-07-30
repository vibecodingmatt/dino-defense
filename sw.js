'use strict';
/* Dino Defense service worker — makes the game installable and fully offline.
   Strategy: network-first for the app shell (so pushed updates show up as soon
   as you're online), cache-first for the icons, and a cached fallback whenever
   the network is unavailable. Bump CACHE to force a clean re-precache. */
const CACHE = 'dino-defense-v41';
const SHELL = [
  './',
  'index.html',
  '404.html',
  'DLTest.html',
  'boss-death-lab.html',
  'boss-lab.html',
  'style.css',
  'dltest.css',
  'js/data.js',
  'js/looks.js',
  'js/draw.js',
  'js/drex.js',
  'js/game.js',
  'js/zxing-reader-3.1.1.js',
  'js/dltest.js',
  'js/dltest-scanner-worker.js',
  'js/zxing-reader-3.1.1.wasm',
  'assets/Jurassic2.mid',
  'assets/theme.mid',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // let cross-origin (e.g. analytics) pass through

  const pathParts = url.pathname.split('/');
  const requestedName = pathParts.pop() || '';
  if (requestedName.toLowerCase() === 'dltest.html' || requestedName.toLowerCase() === 'dltest') {
    if (requestedName !== 'DLTest.html') {
      pathParts.push('DLTest.html');
      url.pathname = pathParts.join('/');
      e.respondWith(Promise.resolve(Response.redirect(url.href, 302)));
      return;
    }
  }

  // icons never really change → serve them from cache first for speed
  if (url.pathname.includes('/icons/')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
    return;
  }

  // everything else: network-first, fall back to cache when offline
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((hit) => hit || caches.match('index.html'))
      )
  );
});
