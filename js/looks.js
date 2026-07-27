'use strict';
/* =========================================================
   DINO DEFENSE — visitor looks
   =========================================================
   The look factory for every human in the game: the palette they
   are assembled from, a fully randomised visitor, and the three
   film cameos. Kept out of game.js so the lab pages can build
   real visitors without booting the game — boss-lab.html and
   drex-lab.html both load this. A private lookRand() keeps it
   self-contained; it must NOT declare rand/clamp, since game.js
   already declares those at global scope and a second `const`
   would be a load-time SyntaxError.
   ========================================================= */
const lookRand = (a, b) => a + Math.random() * (b - a);

const TOURIST_LOOKS = {
  skins: ['#f2cba2', '#eab58a', '#cf9563', '#a9714b', '#7c4f31', '#5b3a24'],
  shirts: ['#f2a63b', '#3f9e63', '#4a83c4', '#8e5fc9', '#efe6d3', '#e86fa4', '#54c8c0', '#d8d84a'],
  bottoms: ['#3a4a63', '#5d6b52', '#8a6f4a', '#474747', '#7a4a5f', '#b8b09a'],
  hairs: ['#241a10', '#4a2f1a', '#7a4a22', '#b98a3f', '#ddcda6', '#8b8b8b', '#b04a2a'],
  hats: ['#efe6cd', '#c4433b', '#3f6fae', '#7a6a4f', '#4a8a52'],
  shoes: ['#2e2e34', '#efe9dc', '#7a4a2a', '#c4433b', '#3d5f9e'],
};
/* a fully-randomized visitor look (the wave-1 cast is hand-picked; this is
   for everyone else — the menu's doomed sprinters, mainly) */
function randomTouristLook(size, noKid){
  const P = TOURIST_LOOKS, pick = a => a[(Math.random() * a.length) | 0];
  const kid = !noKid && Math.random() < 0.14;
  const u = {
    size: kid ? size * 0.72 : size, kid,
    tall: kid ? lookRand(0.85, 0.95) : lookRand(0.94, 1.08),
    build: kid ? lookRand(0.9, 1) : lookRand(0.85, 1.25),
    lean: lookRand(0.1, 0.2), phase: lookRand(0, 6.3), lookT: 0,
    skin: pick(P.skins), shirt: pick(P.shirts), bottom: pick(P.bottoms),
    bottomType: pick(['shorts', 'shorts', 'pants', 'skirt']),
    hairStyle: kid ? 'pig' : pick(['short', 'bob', 'pony', 'long', 'bun', 'curls', 'bald']),
    hairC: pick(P.hairs),
    hat: Math.random() < 0.45 ? pick(['cap', 'sun', 'safari', 'visor']) : null, hatC: pick(P.hats),
    shoeC: pick(P.shoes),
    arms: pick(['flail', 'flail', 'pump', 'clutch']),
    glasses: Math.random() < 0.2, camera: Math.random() < 0.2,
    pack: Math.random() < 0.18 ? 'backpack' : Math.random() < 0.16 ? 'fanny' : null,
    packC: pick(P.shirts),
    belly: Math.random() < 0.22, floral: Math.random() < 0.15,
    balloon: kid && Math.random() < 0.6, balloonC: '#e33b3b',
  };
  if (u.belly) u.build = Math.max(u.build, 1.15);
  if (u.floral) u.shirt = '#e8574f';
  return u;
}
/* Two affectionate cameos for the home-screen chase (see [[home-screen-redesign]]).
   Dennis Nedry: heavyset, glasses + moustache, yellow rain slicker, forever
   clutching the "shaving cream" can. John Hammond: white hair and beard, cream
   linen suit, panama hat and his amber-topped cane — genteel, and far too slow. */
function nedryLook(size){
  const u = randomTouristLook(size, true);
  Object.assign(u, {
    hero: 'nedry', skin: '#e7b98b', shirt: '#e6c43c',      // rain-slicker yellow
    bottom: '#39414f', bottomType: 'pants', shoeC: '#2c2c2c',
    hairStyle: 'short', hairC: '#43301d', glasses: true, mustache: true,
    belly: true, build: 1.34, tall: 0.9, hat: null, pack: null,
    camera: false, floral: false, balloon: false,
    arms: 'canhold', holdItem: 'barbasol',
  });
  return u;
}
function hammondLook(size){
  const u = randomTouristLook(size, true);
  Object.assign(u, {
    hero: 'hammond', skin: '#e6c4a2', shirt: '#ece5d4',    // cream linen
    bottom: '#e2dbc8', bottomType: 'pants', shoeC: '#6b4a2e',
    hairStyle: 'short', hairC: '#eae7de', beard: true, glasses: false,
    belly: false, build: 1.04, tall: 1.0, hat: 'panama', hatC: '#efe7cf',
    pack: null, camera: false, floral: false, balloon: false,
    arms: 'cane', cane: true, lean: 0.26,      // a genteel stoop
  });
  return u;
}
/* Robert Muldoon, game warden — sun-bleached khaki, bush hat, and the rifle he
   never quite gets to raise. He belongs to Blue and to nobody else: the two
   always spawn together and it never once goes his way. */
function muldoonLook(size){
  const u = randomTouristLook(size, true);
  Object.assign(u, {
    hero: 'muldoon', skin: '#c08a58', shirt: '#9a8b60',    // sun-bleached khaki
    bottom: '#7a6c48', bottomType: 'shorts', shoeC: '#4a3524',
    hairStyle: 'short', hairC: '#4e3c26', beard: false, mustache: false,
    glasses: false, belly: false, build: 1.08, tall: 1.03,
    hat: 'safari', hatC: '#9c8c62',
    pack: null, camera: false, floral: false, balloon: false,
    arms: 'rifle', holdItem: 'rifle',
  });
  return u;
}
