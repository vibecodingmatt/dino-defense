'use strict';
/* Dino Defense service worker — makes the game installable and fully offline.
   Strategy: network-first for the app shell (so pushed updates show up as soon
   as you're online), cache-first for the icons, and a cached fallback whenever
   the network is unavailable. Bump CACHE to force a clean re-precache. */
const CACHE = 'dino-defense-v6';
const SHELL = [
  './',
  'index.html',
  'style.css',
  'js/data.js',
  'js/draw.js',
  'js/game.js',
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
