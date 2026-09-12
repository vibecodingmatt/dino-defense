'use strict';
/* =========================================================
   DINO DEFENSE — visitor looks
   =========================================================
   The look factory for every human in the game: the palette they
   are assembled from, a fully randomised visitor, and the five
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
/* Film costumes and proportions: docs/WEB_GUEST_REFERENCE_REVIEW.md.
   Each cameo overrides the random wardrobe; only its animation phase varies. */
function nedryLook(size){
  const u = randomTouristLook(size, true);
  Object.assign(u, {
    hero: 'nedry', skin: '#dfb293', shirt: '#e6bd24',
    bottom: '#39414f', bottomType: 'pants', shoeC: '#2c2c2c',
    hairStyle: 'wavy', hairC: '#30251e', glasses: true, mustache: false, beard: false,
    belly: true, build: 1.46, tall: 0.88, hat: null, hatC: null, pack: null, packC: null,
    underC: '#33485b', longSleeve: true,
    camera: false, floral: false, balloon: false,
    arms: 'canhold', holdItem: 'barbasol', lean: 0.15,
  });
  return u;
}
function hammondLook(size){
  const u = randomTouristLook(size, true);
  Object.assign(u, {
    hero: 'hammond', skin: '#dfb79e', shirt: '#eeeade',
    bottom: '#e6e0d0', bottomType: 'pants', shoeC: '#b7a98c',
    hairStyle: 'receding', hairC: '#e8e5db', beard: true, mustache: false, glasses: true,
    belly: true, build: 1.18, tall: 0.94, hat: 'panama', hatC: '#dcccaa', hatBand: '#e5dfcb',
    longSleeve: false,
    pack: null, packC: null, camera: false, floral: false, balloon: false,
    arms: 'cane', cane: true, lean: 0.07,
  });
  return u;
}
/* Robert Muldoon, game warden — stone safari uniform, tan vest and bush hat.
   The legacy 'rifle' prop key now renders his black folding-stock shotgun, which he
   never quite gets to raise. He belongs to Blue and to nobody else: the two
   always spawn together and it never once goes his way. */
function muldoonLook(size){
  const u = randomTouristLook(size, true);
  Object.assign(u, {
    hero: 'muldoon', skin: '#c79678', shirt: '#b9b3a0',
    bottom: '#b3ad97', bottomType: 'shorts', shoeC: '#302c25',
    hairStyle: 'receding', hairC: '#756858', beard: false, mustache: false,
    glasses: false, belly: false, build: 1.04, tall: 1.07,
    hat: 'safari', hatC: '#9e8965', hatBand: '#746347', vestC: '#b39160', longSleeve: false,
    pack: null, packC: null, camera: false, floral: false, balloon: false,
    arms: 'rifle', holdItem: 'rifle', lean: 0.12,
  });
  return u;
}

/* Tim Murphy, who goes over the perimeter fence at the worst possible moment.
   The blue overshirt is muddy by the fence scene; the striped tee and navy
   neckerchief still show. Longer, slim limbs distinguish him from a toddler. */
function timmyLook(size){
  const u = randomTouristLook(size, true);   // no random kid roll; he IS the kid
  Object.assign(u, {
    hero: 'timmy', kid: true,
    size: size * 0.72, tall: 1.0, build: 0.88,
    skin: '#deb28e', shirt: '#8b9697', underC: '#d4c8ae', neckwear: '#333e49',
    bottom: '#998468', bottomType: 'shorts', shoeC: '#a99a7a', longSleeve: false,
    hairStyle: 'wavy', hairC: '#705038',
    hat: null, hatC: null, pack: null, packC: null, glasses: false, beard: false, mustache: false,
    belly: false, floral: false, balloon: false, camera: false,
    arms: 'flail', lean: 0.14,
  });
  return u;
}

/* Donald Gennaro, counsel for the investors, who abandons two children and
   locks himself in a toilet. Striped shirtsleeves and a patterned tie — no
   hat, no pack, nothing that reads as a tourist: he is the only man on the
   island dressed for a meeting. */
function gennaroLook(size){
  const u = randomTouristLook(size, true);
  Object.assign(u, {
    hero: 'gennaro', skin: '#ceaa91', shirt: '#cbd0cf',
    bottom: '#39404c', bottomType: 'pants', shoeC: '#2a2622',
    hairStyle: 'receding', hairC: '#777069', glasses: false, longSleeve: true,
    beard: false, mustache: false, belly: false, build: 0.96, tall: 1.04,
    hat: null, hatC: null, pack: null, packC: null, camera: false, floral: false, balloon: false,
    arms: 'clutch', tie: '#807967', lean: 0.14,
  });
  return u;
}

/* What the cameos say. Lives here with their looks so the lab pages can put
   the real words in the bubble instead of keeping a second, drifting copy. */
const MENU_LINES = {
  nedry:   "Ah, Ah, Ah!\nYou didn't say the magic word!",
  hammond: "We spared no expense!",
  muldoon: "Clever girl!",
  timmy:   "The power's out!\nI can make it!",
  gennaro: "We're gonna make a fortune\nwith this place!",
};
