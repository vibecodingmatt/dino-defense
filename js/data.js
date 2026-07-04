'use strict';
/* =========================================================
   ISLA DEFENSE — game data
   Dinosaurs, towers, levels, lab research.
   ========================================================= */

const VERSION = '1.11.0';
const CHANGELOG = [
  {v: '1.11.0', date: 'Jul 4, 2026', items: [
    '💥 Air Strike reworked into a true cluster bomb — jets carpet the ENTIRE zone in a rolling wave of bright fireballs. It now one-shot-kills every dinosaur on the field and rips 25% off any boss',
    '🏆 New ACHIEVEMENTS page (button on the main menu) — a full list of every trophy with its name, description and locked/unlocked status, so you can see what to target: secure each zone, a flawless 100-wave run, slaying the D-Rex, and more',
    '🧪 Developer options (Settings): 💰 Unlimited Cash and ⏭ Level Skip, alongside 🛡 Invincibility. Turning any of them ON now requires a password (turning them off never does). Runs that use a cheat earn no DNA and no achievements, so nothing can be farmed',
    '☠ Bosses are now 3× tougher — their health bars are triple the size, so a T-Rex or D-Rex is a real siege instead of a speed bump',
    '🚀 Fixed rockets swirling in endless circles around a target before finally hitting — missiles now home in tightly and detonate cleanly',
    '👹 The wave-100 D-Rex has been completely redrawn as the Distortus Rex: a hulking, hunched four-armed mutation with a lumpy tumour-caked back, gnarled spines, and a low, glowing-eyed maw',
  ]},
  {v: '1.10.0', date: 'Jul 4, 2026', items: [
    '🎵 Original looping score — a low jungle-adventure theme plays under the action (toggle Music in Settings)',
    '☠ Wave 100 finale: the D-REX. A towering demonic hybrid with glowing eyes, armored hide, regeneration, and a double-roar entrance. Extremely hard to kill — bring everything',
  ]},
  {v: '1.9.0', date: 'Jul 4, 2026', items: [
    '✈️ Air Strike is now a full show: two top-down F-22s roar in with contrails and afterburners, drop cluster canisters, and carpet the zone in a dozen staggered explosions',
    '🏆 Beating wave 100 now triggers a fireworks celebration before the victory screen',
    'All menus can be closed with an ✕ in the corner — no more scrolling to Done',
  ]},
  {v: '1.8.0', date: 'Jul 4, 2026', items: [
    'New ✈️ AIR STRIKE: from wave 50, call in jets to carpet-bomb anywhere you click — $5,000, second run costs $7,500, max two per run',
    'Anti-spam pricing: each additional copy of the same weapon costs more (+15%, mortars +35%)',
    'Mid/late-game income reined in — kill bounties and wave bonuses grow much slower',
    'Upgrade button now becomes clickable the moment you can afford it',
    'Tranq Turret retired; Flame Thrower is available from wave 1',
    'New 6× speed button',
  ]},
  {v: '1.7.0', date: 'Jul 4, 2026', items: [
    'Weapons now unlock as you survive deeper waves — heavy hardware like the 💣 Mortar (wave 28) can no longer be rushed in the opening minutes',
    'Upgrade costs properly tiered: every upgrade costs more than the weapon itself, and each level costs more than the last',
    'Early-game income trimmed and early waves toughened slightly — less autopilot, more decisions',
  ]},
  {v: '1.6.0', date: 'Jul 4, 2026', items: [
    'Fixed blood splatter disappearing during heavy late-game action',
    'Balance: economy tightened toward a middle ground — weapons keep their punch but cost more, kills pay a bit less, and late waves are tougher again',
    'New 💡 Tips & Field Manual on the main menu',
    'Defeat now offers a clean restart (checkpoint retries removed)',
    'Version number + this changelog added to the menu',
  ]},
  {v: '1.5.0', date: 'Jul 4, 2026', items: [
    'Save protection: browser persistent storage, an automatic backup copy, and manual save codes (Settings)',
    'New 💣 MORTAR: long-range splash devastation with a minimum range',
    'Upgrades reworked: one track per weapon, 2–3 levels max; Missile Battery gains +1 rocket per level',
    'Big difficulty rebalance: gentler late-game HP, stronger weapons',
    'Bosses walk 20–35% faster',
    'Fixed backwards-looking leg animation; dinos rotate fully to face the path',
    'Audio no longer cuts out during heavy gunfire at high speed',
    'Big dinosaurs now walk in front of turrets correctly',
  ]},
  {v: '1.4.0', date: 'Jul 4, 2026', items: [
    'Bosses are oversized with cinematic entrances: roar pose, letterbox title card, shockwave, scattering birds',
    'Blood splatter on kills',
    'HUD mute button (M key)',
    'Dinosaur animation overhaul: direction facing, size-scaled strides, footfall dust',
  ]},
  {v: '1.3.0', date: 'Jul 4, 2026', items: [
    'Research Lab made prominent (pulsing button, Lab shortcuts after runs)',
    'Dinosaurs ~40% bigger; mobile-friendly stacked layout with two-tap building',
    'Towers visibly grow with upgrades',
  ]},
  {v: '1.2.0', date: 'Jul 3, 2026', items: [
    'Synthesized audio engine with reverb; boss roars and collapse animations',
    'Graphics overhaul: jungle terrain, torch-lit park gates, fortified checkpoint, detailed weapons',
    'Boss health bar, incoming-wave preview, damage numbers, night fireflies',
  ]},
  {v: '1.1.0', date: 'Jul 3, 2026', items: [
    'Run resume: close the browser and continue where you left off',
    'Published to the web via GitHub Pages',
  ]},
  {v: '1.0.0', date: 'Jul 3, 2026', items: [
    'Initial release: 5 zones × 100 waves, 26 dinosaurs, 8 weapons, DNA research lab',
  ]},
];

/* ---------- DINOSAURS ----------
   hp/speed/armor/bounty are BASE values, scaled by wave.
   dmg   = base health you lose if it escapes.
   size  = half body length in px (visual + hitbox).
   minWave = earliest wave it can appear.  weight = spawn weighting.
   painter: theropod | quad | sauropod | flyer
*/
const DINOS = {
  /* --- small & fast --- */
  compy:            {name:'Compsognathus',      painter:'theropod', hp:16,  speed:92,  armor:0, bounty:3,  dmg:1,  size:8,  minWave:1,  weight:12,
                     pal:{body:'#7d9e4b', belly:'#cfe0a2', accent:'#43602a'}, feat:{slim:true}},
  gallimimus:       {name:'Gallimimus',         painter:'theropod', hp:34,  speed:118, armor:0, bounty:5,  dmg:2,  size:15, minWave:3,  weight:9,
                     pal:{body:'#c2a25f', belly:'#eadfb8', accent:'#8a6f3a'}, feat:{slim:true}},
  velociraptor:     {name:'Velociraptor',       painter:'theropod', hp:65,  speed:96,  armor:0, bounty:8,  dmg:3,  size:16, minWave:5,  weight:10,
                     pal:{body:'#8c7d5f', belly:'#d8cba6', accent:'#4a4030'}, feat:{stripes:true}},
  dilophosaurus:    {name:'Dilophosaurus',      painter:'theropod', hp:60,  speed:72,  armor:0, bounty:8,  dmg:2,  size:15, minWave:4,  weight:8,
                     pal:{body:'#5f8f5a', belly:'#cfe4b0', accent:'#e8c33a'}, feat:{frill:true}},
  atrociraptor:     {name:'Atrociraptor',       painter:'theropod', hp:190, speed:102, armor:0, bounty:18, dmg:3,  size:16, minWave:28, weight:6,
                     pal:{body:'#6b4f3a', belly:'#c9b090', accent:'#2e2118'}, feat:{stripes:true}},
  pyroraptor:       {name:'Pyroraptor',         painter:'theropod', hp:150, speed:108, armor:0, bounty:16, dmg:3,  size:15, minWave:30, weight:6, burnImmune:true,
                     pal:{body:'#b5432b', belly:'#e8b174', accent:'#7a2416'}, feat:{feathers:true, stripes:true}},

  /* --- flyers (only air-capable towers can hit them) --- */
  dimorphodon:      {name:'Dimorphodon',        painter:'flyer',    hp:28,  speed:106, armor:0, bounty:5,  dmg:1,  size:11, minWave:8,  weight:6, flying:true,
                     pal:{body:'#9c5a3c', belly:'#dcb694', accent:'#5c3220'}, feat:{}},
  pteranodon:       {name:'Pteranodon',         painter:'flyer',    hp:55,  speed:95,  armor:0, bounty:8,  dmg:2,  size:17, minWave:6,  weight:7, flying:true,
                     pal:{body:'#8a7355', belly:'#d9c9a8', accent:'#4f4030'}, feat:{crest:true}},
  quetzalcoatlus:   {name:'Quetzalcoatlus',     painter:'flyer',    hp:800, speed:58,  armor:1, bounty:55, dmg:8,  size:28, minWave:50, weight:4, flying:true,
                     pal:{body:'#a88c6a', belly:'#e6d8bd', accent:'#6b543a'}, feat:{crest:true}},

  /* --- herbivores & mid-tier --- */
  parasaurolophus:  {name:'Parasaurolophus',    painter:'quad',     hp:150, speed:60,  armor:0, bounty:12, dmg:4,  size:23, minWave:8,  weight:8,
                     pal:{body:'#7a8f56', belly:'#d6dfae', accent:'#a4572e'}, feat:{headCrest:true}},
  pachycephalosaurus:{name:'Pachycephalosaurus',painter:'theropod', hp:150, speed:78,  armor:1, bounty:12, dmg:3,  size:16, minWave:12, weight:7,
                     pal:{body:'#9a6f4f', belly:'#dcc2a0', accent:'#5e4028'}, feat:{dome:true}},
  stygimoloch:      {name:'Stygimoloch',        painter:'theropod', hp:170, speed:88,  armor:1, bounty:14, dmg:3,  size:15, minWave:25, weight:6,
                     pal:{body:'#a5713f', belly:'#e2c9a2', accent:'#623c1c'}, feat:{dome:true, spikes:true}},
  baryonyx:         {name:'Baryonyx',           painter:'theropod', hp:230, speed:62,  armor:1, bounty:18, dmg:5,  size:21, minWave:14, weight:7,
                     pal:{body:'#5c6e5a', belly:'#c2cfa8', accent:'#33422f'}, feat:{longSnout:true, stripes:true}},
  carnotaurus:      {name:'Carnotaurus',        painter:'theropod', hp:280, speed:72,  armor:2, bounty:22, dmg:5,  size:21, minWave:20, weight:7,
                     pal:{body:'#8f3b2e', belly:'#d8a184', accent:'#4e1d14'}, feat:{horns:true}},
  allosaurus:       {name:'Allosaurus',         painter:'theropod', hp:320, speed:62,  armor:2, bounty:24, dmg:6,  size:23, minWave:26, weight:7,
                     pal:{body:'#7a6248', belly:'#d3bd98', accent:'#a2402a'}, feat:{horns:true}},
  stegosaurus:      {name:'Stegosaurus',        painter:'quad',     hp:380, speed:40,  armor:3, bounty:28, dmg:6,  size:27, minWave:15, weight:7,
                     pal:{body:'#6f7d46', belly:'#cdd6a0', accent:'#b0562c'}, feat:{plates:true, tailSpikes:true}},
  triceratops:      {name:'Triceratops',        painter:'quad',     hp:420, speed:46,  armor:5, bounty:32, dmg:7,  size:25, minWave:18, weight:7,
                     pal:{body:'#8a8a5a', belly:'#dcdcb0', accent:'#55552f'}, feat:{trike:true}},
  ankylosaurus:     {name:'Ankylosaurus',       painter:'quad',     hp:520, speed:32,  armor:9, bounty:38, dmg:7,  size:25, minWave:24, weight:6,
                     pal:{body:'#70603f', belly:'#c8b98c', accent:'#3f3421'}, feat:{club:true, armorBumps:true}},
  therizinosaurus:  {name:'Therizinosaurus',    painter:'theropod', hp:700, speed:48,  armor:2, bounty:48, dmg:8,  size:25, minWave:45, weight:5, regen:0.008,
                     pal:{body:'#5a6b52', belly:'#c9d6b2', accent:'#2f3d2a'}, feat:{claws:true, feathers:true}},

  /* --- super tanks --- */
  apatosaurus:      {name:'Apatosaurus',        painter:'sauropod', hp:1300, speed:28, armor:2, bounty:70, dmg:10, size:42, minWave:35, weight:4,
                     pal:{body:'#7b7466', belly:'#cfc7b4', accent:'#4c473d'}, feat:{}},
  brachiosaurus:    {name:'Brachiosaurus',      painter:'sauropod', hp:1700, speed:25, armor:2, bounty:85, dmg:10, size:48, minWave:45, weight:4,
                     pal:{body:'#8a8168', belly:'#ddd4b8', accent:'#57503c'}, feat:{tall:true}},

  /* --- BOSSES (spawned on schedule, never in random pool) --- */
  blue:             {name:'Blue — Alpha Raptor', epithet:'THE PACK HUNTS WITH HER', painter:'theropod', hp:900,  speed:96, armor:1, bounty:120, dmg:15, size:18, boss:true, weight:0,
                     pal:{body:'#5a6b78', belly:'#c3ccd4', accent:'#2c5f8a'}, feat:{stripes:true}},
  trex:             {name:'Tyrannosaurus Rex',   epithet:'THE TYRANT QUEEN', painter:'theropod', hp:3000, speed:60, armor:3, bounty:300, dmg:25, size:32, boss:true, weight:0, roar:true,
                     pal:{body:'#6e5a44', belly:'#c9b493', accent:'#3d3022'}, feat:{bigHead:true}},
  spinosaurus:      {name:'Spinosaurus',         epithet:'THE RIVER MONSTER', painter:'theropod', hp:3600, speed:56, armor:3, bounty:340, dmg:28, size:33, boss:true, weight:0, roar:true,
                     pal:{body:'#5d7268', belly:'#c2d1c0', accent:'#b0703c'}, feat:{sail:true, longSnout:true}},
  indominus:        {name:'Indominus Rex',       epithet:'THE UNTAMABLE', painter:'theropod', hp:5200, speed:62, armor:4, bounty:420, dmg:32, size:31, boss:true, weight:0, roar:true,
                     cloak:true, regen:0.006,
                     pal:{body:'#b9c2c4', belly:'#e9eef0', accent:'#7c8a8d'}, feat:{bigHead:true, spikes:true}},
  indoraptor:       {name:'Indoraptor',          epithet:'THE NIGHTMARE MADE FLESH', painter:'theropod', hp:4200, speed:88, armor:3, bounty:400, dmg:30, size:24, boss:true, weight:0, roar:true,
                     pal:{body:'#26262b', belly:'#4c4c55', accent:'#d9a531'}, feat:{stripes:true, slim:true}},
  giganotosaurus:   {name:'Giganotosaurus',      epithet:'THE APEX OF APEX PREDATORS', painter:'theropod', hp:9000, speed:54, armor:5, bounty:800, dmg:45, size:36, boss:true, weight:0, roar:true,
                     pal:{body:'#4f4a52', belly:'#b7b0ba', accent:'#8a2f2f'}, feat:{bigHead:true, ridge:true}},
  drex:             {name:'D-Rex — Distortus Rex', epithet:'THE DEVIL YOU CREATED', painter:'mutant', hp:16000, speed:58, armor:8, bounty:2000, dmg:60, size:46, boss:true, weight:0, roar:true, regen:0.004,
                     pal:{body:'#6f6a63', belly:'#9c968b', accent:'#b83a30'},
                     feat:{glowEyes:true, fourArms:true}},
};

/* Boss schedule — every 10th wave. Values are arrays (escorts allowed). */
const BOSS_WAVES = {
  10:  ['blue'],
  20:  ['trex'],
  30:  ['spinosaurus'],
  40:  ['trex', 'blue'],
  50:  ['indominus'],
  60:  ['spinosaurus', 'trex'],
  70:  ['indoraptor'],
  80:  ['indominus', 'spinosaurus'],
  90:  ['indoraptor', 'indominus'],
  100: ['drex'],
};

/* ---------- TOWERS / WEAPONS ----------
   maxUp = how many times the weapon can be upgraded (single track).
   Each upgrade: damage ×1.65, fire rate ×1.25, range ×1.12, splash grows.
   unlock = first wave the weapon becomes purchasable. */
const TOWERS = {
  gatling: {name:'ACU Gatling',    icon:'🔫', cost:180, dmg:9,   rof:7,    range:130, air:true,  proj:'bullet', maxUp:3, unlock:1,
            desc:'Asset Containment turret. Low damage, very high fire rate.', color:'#c9c9c9'},
  flamer:  {name:'Flame Thrower',  icon:'🔥', cost:210, dmg:7,   rof:9,    range:100, air:false, proj:'flame', maxUp:2, unlock:1,
            burn:{dps:22, t:2.2}, cone:0.62,
            desc:'Short-range cone of fire. Sets ground targets ablaze.', color:'#ff9a3d'},
  sniper:  {name:'Ranger Sniper',  icon:'🎯', cost:270, dmg:95,  rof:0.6,  range:280, air:true,  proj:'snipe', pierce:true, maxUp:2, unlock:6,
            desc:'Huge single-shot damage at extreme range. Ignores armor.', color:'#7fb2ff'},
  cryo:    {name:'Cryo Cannon',    icon:'❄️', cost:290, dmg:12,  rof:1.0,  range:160, air:true,  proj:'cryo', maxUp:2, unlock:9,
            splash:60, slow:{f:0.5, t:2.4},
            desc:'Freezing shells that heavily slow everything they splash.', color:'#bfe8ff'},
  tesla:   {name:'Tesla Node',     icon:'⚡', cost:310, dmg:45,  rof:1.0,  range:150, air:true,  proj:'tesla', maxUp:2, unlock:12,
            chain:4, chainRange:115,
            desc:'10,000-volt perimeter tech. Arcs between up to 4 dinosaurs.', color:'#6ee7ff'},
  sonic:   {name:'Sonic Emitter',  icon:'📡', cost:370, dmg:50,  rof:0.9,  range:125, air:true,  proj:'pulse', maxUp:2, unlock:15,
            reveal:true,
            desc:'Damages ALL dinosaurs in radius. Reveals camouflaged bosses.', color:'#d6a3ff'},
  missile: {name:'Missile Battery',icon:'🚀', cost:470, dmg:90,  rof:0.55, range:220, air:true,  proj:'missile', maxUp:2, unlock:18,
            splash:70,
            desc:'Homing rockets with splash. Upgrades add a 2nd and 3rd rocket per salvo!', color:'#ff6b6b'},
  mortar:  {name:'Mortar',         icon:'💣', cost:1000, dmg:200, rof:0.3, range:310, air:false, proj:'mortar', maxUp:1, unlock:28,
            splash:100, minRange:90,
            desc:'Lobbed shells devastate herds at long range. Cannot hit flyers or anything too close. One upgrade: massive damage and splash.', color:'#e0b64f'},
};

/* Single-track upgrade tuning: every upgrade costs more than the weapon
   itself, and each level costs more than the last (1.2x, 2.0x, 2.8x base). */
const UPG = {
  mult: {dmg: 1.65, rof: 1.25, range: 1.12},
  cost: (towerDef, ulv) => Math.round(towerDef.cost * (1.2 + ulv * 0.8)),
};

/* ---------- AIR STRIKE (consumable, not a tower) ----------
   A full cluster-bomb carpet: jets sweep in and blanket the ENTIRE
   battlefield with a rolling wave of bomblets that emanates from the
   mark. Every non-boss caught in a burst is killed outright; bosses
   lose a flat 25% of their max health per strike. */
const AIRSTRIKE = {
  unlock: 50,          // first wave it can be called in
  costs: [5000, 7500], // first use, second use
  maxUses: 2,          // per run
  bossFrac: 0.25,      // fraction of a boss's MAX hp removed per strike
  splash: 95,          // kill radius of each bomblet
  gridX: 10,           // bomblet columns across the field
  gridY: 6,            // bomblet rows down the field  (10×6 = 60 bursts)
  jitter: 46,          // random offset applied to each grid cell (px)
  sweep: 1.15,         // seconds for the carpet to roll edge-to-edge
  jetSpeed: 560,       // px/s — slow enough to watch the flyby
};

/* ---------- ACHIEVEMENTS (persistent trophy case) ----------
   Awarded for major accomplishments and shown on the main menu.
   Runs that use any developer cheat do NOT earn trophies. */
const ACHIEVEMENTS = [
  {key:'boss_first', icon:'🦴',  name:'First Blood',    desc:'Defeat your very first boss dinosaur.'},
  {key:'wave50',     icon:'⏱️',  name:'Halfway In',     desc:'Reach wave 50 in any zone.'},
  {key:'secure_0',   icon:'🌿',  name:'Perimeter Held', desc:'Secure Zone 1 — The Perimeter Fence (100 waves).'},
  {key:'secure_1',   icon:'🏛️',  name:'Center Cleared', desc:'Secure Zone 2 — Visitor Center (100 waves).'},
  {key:'secure_2',   icon:'🪺',  name:'Aviary Locked',  desc:'Secure Zone 3 — The Aviary (100 waves).'},
  {key:'secure_3',   icon:'🌊',  name:'Delta Defended', desc:'Secure Zone 4 — Site B: River Delta (100 waves).'},
  {key:'secure_4',   icon:'🌙',  name:'Estate Secured', desc:'Secure Zone 5 — Lockwood Estate (100 waves).'},
  {key:'apex',       icon:'☠️',  name:'Devil Slain',    desc:'Defeat the D-Rex, the wave-100 final boss.'},
  {key:'flawless',   icon:'🛡️',  name:'Untouchable',    desc:'Clear all 100 waves of a zone without your base taking a single hit.'},
  {key:'island',     icon:'👑',  name:'Isla Secured',   desc:'Secure all five zones of the island.'},
];

/* ---------- LEVELS ----------
   Paths are waypoint lists in a 1280x720 space; dinos walk them in order.
   hpMult scales difficulty per zone.
*/
const LEVELS = [
  {name:'The Perimeter Fence', sub:'Sector 7 — jungle roadway', night:false, flyerBias:1.0, hpMult:1.00,
   theme:{grass:'#31491f', grass2:'#3c5726', path:'#8a6f47', pathEdge:'#5e4a2d', tree:'#243d18', water:null},
   paths:[[{x:-40,y:150},{x:300,y:150},{x:300,y:430},{x:700,y:430},{x:700,y:180},{x:1000,y:180},{x:1000,y:560},{x:1320,y:560}]]},

  {name:'Visitor Center', sub:'Two breached gates — dusk', night:false, dusk:true, flyerBias:1.0, hpMult:1.35,
   theme:{grass:'#3d4423', grass2:'#4a522b', path:'#96794e', pathEdge:'#665233', tree:'#2c351a', water:null},
   paths:[[{x:-40,y:120},{x:400,y:120},{x:400,y:360},{x:900,y:360},{x:900,y:600},{x:1320,y:600}],
          [{x:-40,y:620},{x:400,y:620},{x:400,y:360},{x:900,y:360},{x:900,y:600},{x:1320,y:600}]]},

  {name:'The Aviary', sub:'Dome breach — expect flyers', night:false, mist:true, flyerBias:2.4, hpMult:1.75,
   theme:{grass:'#2f4636', grass2:'#3a5442', path:'#7d7a5a', pathEdge:'#55533c', tree:'#22382a', water:'#3a5a66'},
   paths:[[{x:-40,y:360},{x:210,y:360},{x:210,y:120},{x:520,y:120},{x:520,y:600},{x:820,y:600},{x:820,y:200},{x:1100,y:200},{x:1100,y:450},{x:1320,y:450}]]},

  {name:'Site B: River Delta', sub:'Isla Sorna — long approach', night:false, flyerBias:1.2, hpMult:2.2,
   theme:{grass:'#374d22', grass2:'#425c2a', path:'#8f7146', pathEdge:'#614b2c', tree:'#27401a', water:'#33566b'},
   paths:[[{x:-40,y:90},{x:1080,y:90},{x:1080,y:300},{x:220,y:300},{x:220,y:530},{x:1320,y:530}]]},

  {name:'Lockwood Estate', sub:'Night hunt — two wings', night:true, flyerBias:1.1, hpMult:2.8,
   theme:{grass:'#20281c', grass2:'#293323', path:'#5c5142', pathEdge:'#3c352b', tree:'#161f12', water:null},
   paths:[[{x:-40,y:200},{x:300,y:200},{x:300,y:500},{x:640,y:500},{x:640,y:160},{x:980,y:160},{x:980,y:430},{x:1320,y:430}],
          [{x:200,y:-40},{x:200,y:340},{x:640,y:340},{x:640,y:160},{x:980,y:160},{x:980,y:430},{x:1320,y:430}]]},
];

const WAVES_PER_LEVEL = 100;

/* ---------- LAB (persistent DNA research) ---------- */
const LAB = [
  {key:'dmg_all',    icon:'🧬', name:'Gene-Tuned Optics',  max:10, baseCost:40, desc:'+6% damage for ALL weapons per tier.'},
  {key:'range_all',  icon:'🛰️', name:'Park Sensor Grid',   max:6,  baseCost:45, desc:'+4% range for ALL weapons per tier.'},
  {key:'start_cash', icon:'💰', name:'InGen Funding',      max:8,  baseCost:30, desc:'+$60 starting cash per tier.'},
  {key:'base_hp',    icon:'🏥', name:'Bunker Plating',     max:10, baseCost:30, desc:'+15 base health per tier.'},
  {key:'bounty',     icon:'💎', name:'Amber Recovery',     max:8,  baseCost:50, desc:'+6% cash from kills per tier.'},
  /* ammo research — one per weapon: +8% dmg, +4% fire rate per tier */
  {key:'ammo_gatling', icon:'🔫', name:'AP Rounds',         max:5, baseCost:35, ammo:'gatling', desc:'Gatling ammo: +8% dmg, +4% fire rate / tier.'},
  {key:'ammo_sniper',  icon:'🎯', name:'Depleted Uranium',  max:5, baseCost:45, ammo:'sniper',  desc:'Sniper ammo: +8% dmg, +4% fire rate / tier.'},
  {key:'ammo_flamer',  icon:'🔥', name:'Napalm Mix',        max:5, baseCost:40, ammo:'flamer',  desc:'Flamer fuel: +8% dmg, +4% fire rate / tier.'},
  {key:'ammo_tesla',   icon:'⚡', name:'Supercapacitors',   max:5, baseCost:45, ammo:'tesla',   desc:'Tesla cells: +8% dmg, +4% fire rate / tier.'},
  {key:'ammo_missile', icon:'🚀', name:'HE Payloads',       max:5, baseCost:50, ammo:'missile', desc:'Missile ammo: +8% dmg, +4% fire rate / tier.'},
  {key:'ammo_cryo',    icon:'❄️', name:'Liquid Nitrogen',   max:5, baseCost:40, ammo:'cryo',    desc:'Cryo shells: +8% dmg, +4% fire rate / tier.'},
  {key:'ammo_sonic',   icon:'📡', name:'Resonance Tuning',  max:5, baseCost:45, ammo:'sonic',   desc:'Sonic emitter: +8% dmg, +4% fire rate / tier.'},
  {key:'ammo_mortar',  icon:'💣', name:'Cratering Charges', max:5, baseCost:55, ammo:'mortar',  desc:'Mortar shells: +8% dmg, +4% fire rate / tier.'},
];
const labCost = (entry, tier) => Math.round(entry.baseCost * Math.pow(1.55, tier));
