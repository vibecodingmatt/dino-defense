'use strict';
/* Dino Defense service worker — makes the game installable and fully offline.
   Strategy: network-first for the app shell (so pushed updates show up as soon
   as you're online), cache-first for the icons, and a cached fallback whenever
   the network is unavailable. Bump CACHE to force a clean re-precache. */
const CACHE = 'dino-defense-v78';
const SHELL = [
  './',
  'index.html',
  '404.html',
  'DLTest.html',
  'boss-death-lab.html',
  'boss-lab.html',
  'style.css',
  'home.css',
  'leaderboards.css',
  'experience.css',
  'js/experience.js',
  'js/leaderboard-rules.js',
  'js/leaderboards.js',
  'js/home.js',
  'js/home-scenery.js',
  'js/endgame-fx.js',
  'icons/interface.svg',
  'icons/favicon.svg',
  'dltest.css',
  'js/data.js',
  'js/looks.js',
  'js/tourists.js',
  'js/tourist-fx.js',
  'js/perimeter.js',
  'js/sanctuary-scenes.js',
  'js/paddock-raptors.js',
  'js/arsenal.js',
  'js/weapon-info.js',
  'js/extinction.js',
  'js/weapon-fx.js',
  'js/armory-guide.js',
  'js/creature-meshes.js',
  'js/creature-species.js',
  'js/creature-anatomy.js',
  'js/creatures.js',
  'js/dino-fx.js',
  'js/audio-fx.js',
  'assets/audio/effects-v1.bank.gz',
  'js/creature-guide.js',
  'assets/maps/sector7-facility.webp',
  'assets/maps/visitor-sanctuary.webp',
  'assets/maps/aviary-sanctuary.webp',
  'assets/maps/delta-sanctuary.webp',
  'assets/maps/lockwood-sanctuary.webp',
  'assets/maps/proving-sanctuary.webp',
  'assets/maps/lagoon-sanctuary.webp',
  'assets/creatures/hide-detail.webp',
  'assets/creatures/skinned/allosaurus.mesh.gz',
  'assets/creatures/skinned/ankylosaurus.mesh.gz',
  'assets/creatures/skinned/apatosaurus.mesh.gz',
  'assets/creatures/skinned/atrociraptor.mesh.gz',
  'assets/creatures/skinned/baryonyx.mesh.gz',
  'assets/creatures/skinned/blue.mesh.gz',
  'assets/creatures/skinned/brachiosaurus.mesh.gz',
  'assets/creatures/skinned/carnotaurus.mesh.gz',
  'assets/creatures/skinned/compy.mesh.gz',
  'assets/creatures/skinned/dilophosaurus.mesh.gz',
  'assets/creatures/skinned/dimorphodon.mesh.gz',
  'assets/creatures/skinned/drex.mesh.gz',
  'assets/creatures/skinned/gallimimus.mesh.gz',
  'assets/creatures/skinned/giganotosaurus.mesh.gz',
  'assets/creatures/skinned/ichthyosaurus.mesh.gz',
  'assets/creatures/skinned/indominus.mesh.gz',
  'assets/creatures/skinned/indoraptor.mesh.gz',
  'assets/creatures/skinned/kronosaurus.mesh.gz',
  'assets/creatures/skinned/mosasaurus.mesh.gz',
  'assets/creatures/skinned/pachycephalosaurus.mesh.gz',
  'assets/creatures/skinned/parasaurolophus.mesh.gz',
  'assets/creatures/skinned/plesiosaurus.mesh.gz',
  'assets/creatures/skinned/pteranodon.mesh.gz',
  'assets/creatures/skinned/pyroraptor.mesh.gz',
  'assets/creatures/skinned/quetzalcoatlus.mesh.gz',
  'assets/creatures/skinned/spinosaurus.mesh.gz',
  'assets/creatures/skinned/stegosaurus.mesh.gz',
  'assets/creatures/skinned/stygimoloch.mesh.gz',
  'assets/creatures/skinned/therizinosaurus.mesh.gz',
  'assets/creatures/skinned/trex.mesh.gz',
  'assets/creatures/skinned/triceratops.mesh.gz',
  'assets/creatures/skinned/velociraptor.mesh.gz',
  'assets/creatures/skinned/whiteptera.mesh.gz',
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
