'use strict';
/* =========================================================
   ISLA DEFENSE — game data
   Dinosaurs, towers, levels, lab research.
   ========================================================= */

const VERSION = '1.32.0';

/* ---------- ANALYTICS (Google Analytics 4) ----------
   Anonymous usage metrics: how many people play, roughly where from, how long,
   and how far they get. It is OFF until you paste your GA4 Measurement ID here.
   Setup: analytics.google.com → Admin → Create property → add a "Web" data
   stream for https://vibecodingmatt.github.io/dino-defense/ → copy the
   Measurement ID (looks like G-XXXXXXXXXX) → paste it below → push.
   Nothing is sent while this is ''. Local (file://) and ?test= sessions are
   never tracked, so your own testing won't pollute the numbers. */
const ANALYTICS_ID = 'G-3K739141RH'; // GA4 Measurement ID — analytics live
/* Player-facing changelog — ONE entry per DAY (a daily recap), newest first.
   The `v` shown is the latest version released that day; `items` are the major,
   player-facing changes only. BE BRIEF: one short sentence per item, the WHAT
   not the HOW — no internal numbers, formulas, colour codes, or implementation
   detail. Minor same-day fixes can fold into an existing item or be dropped.
   IMPORTANT: date each entry with the ACTUAL current calendar date (check the
   real date — don't reuse the previous entry's date). When shipping on a new
   day, add a NEW dated entry at the top; when shipping again the same day,
   update that day's entry and bump its `v`. */
const CHANGELOG = [
  {v: '1.32.0', date: 'Jul 14, 2026', items: [
    '⚡ TESLA SUPERCHARGED: lightning now visibly races dino to dino down the chain, flashes white-hot on the strike, leaves a glowing scar hanging in the air, and throws bouncing welder sparks at every hit — with stray forks reaching for dinos it didn\'t catch.',
    '💀 The electrocution gag is now a full cartoon strobe: X-ray frames alternate with photo-negative frames, complete with glowing filament eyes, frazzled hide, tail vertebrae, toe bones, and a grinning skull.',
    '🦴 Dinosaurs killed by the Tesla now freeze as a skeleton and crumble into a smoking pile of bones.',
    '🌩️ A fully-maxed Tesla brews its own storm cloud that strikes down to recharge the floating orb — every discharge dims the whole island for a heartbeat, and nearby weapons pick up St. Elmo\'s fire.',
    '🔋 A charge pulse races up the coil faster as the next shot readies, sparks skitter around the scorched base, and the grass stands on end.',
    '🔥 Zapped dinosaurs stay sooty and smoking for a moment, static still crawling over their hide — and chained dinos stay visibly linked by a leftover arc.',
  ]},
  {v: '1.31.6', date: 'Jul 9, 2026', items: [
    '📐 The Armory panel dropped the "next wave" preview, freeing up more room to show your weapons.',
    '💥 Toned down the screen shake from mortar, missile, and air-strike explosions.',
    '📱 Isla Defense can now be installed to your phone — a new Install button on the home screen walks you through it (and shows iPhone users the Safari steps) to play full-screen and offline.',
    '👆 On touch, the weapon and its range now float above your fingertip while placing, so you can see exactly where it lands.',
    '🗺️ Drag with one finger to pan the map and pinch to zoom — with room past the edges so you can build right up to the bottom.',
    '🔍 Added a zoom slider at the top of the map on phones, so the pinch-to-zoom is easy to find and fine-tune.',
  ]},
  {v: '1.31.0', date: 'Jul 8, 2026', items: [
    '📐 Proving Grounds squares are now 4× bigger (a 20×11 field) — each weapon fills exactly one square, and weapon ranges are measured in squares: Gatling covers 1 square in every direction, Cryo 2, Missiles 3, Mortar 4 (growing to 5 fully upgraded), and the rest tuned to 1–2.',
    '🦶 Dinosaurs now walk the route line exactly — no more columns jamming at corners the line said were open, and big bosses can no longer barge through walls (they also stalk in along the route instead of appearing mid-field).',
    '🌿 The outer edge squares are ordinary walkable ground now — shut an edge route down the honest way, with a weapon placed flush against the border.',
    '🔲 Proving Grounds is now a true build grid: weapons snap to the grid and occupy exact 2×2 squares — place them flush against each other or the map edge to form seamless walls, and the grid appears while you place, highlighting walled-off squares and the exact footprint of the weapon in hand.',
    '🧱 Dinosaurs march in from one point in a single-file column, all following the same shortest route — a dashed guide line shows it live, and it only ever routes through squares dinosaurs can genuinely walk, one free square at a time.',
    '🛡️ Weapons are truly solid — dinosaurs (even big bosses like the T-Rex) physically cannot step over them or squeeze between a weapon and the map edge.',
    '❄️ The Cryo Cannon is now available from wave 1 — slow them down early.',
  ]},
  {v: '1.28.0', date: 'Jul 7, 2026', items: [
    '🧱 NEW MAP: THE PROVING GROUNDS — an open battlefield with no road. Dinosaurs roam freely from left to right and your weapons ARE the walls: build a zig-zag maze to grind them down. You can never seal the field completely, and flyers just soar straight over.',
    '🌊 NEW MAP: MOSASAUR LAGOON — a jungle road plus a living river swarming with all-new aquatic dinosaurs (Ichthyosaurus, Plesiosaurus, Kronosaurus), ruled by the mighty MOSASAURUS.',
    '🦷 Carnivores finally have carnivore teeth — jagged fangs instead of flat white strips, in-game and on the home screen.',
    '🏃 The home-screen giants now chase fleeing tourists — some trip and fall, and about a third get eaten.',
    '🔥 Dinosaurs hit by the Flame Thrower now visibly catch fire, with flames dancing on their backs while they burn.',
    '💀 Dinosaurs zapped by the Tesla now flash their skeleton, cartoon-style.',
    '🐛 Fixed the Flame Thrower being too short-ranged to hit anything — its range was doubled, and other short-range weapons got small bumps.',
    '🏞️ Map makeover: real dino skeletons, a rebuilt tour jeep, a wrecked bloodied gyrosphere, fallen logs, spent flares — and a hidden movie easter egg on every map.',
    '🦅 New boss: THE WHITE PTERANODON (waves 40 & 80) — only air-capable weapons can hurt it.',
    '🔫 Weapons now look bigger and meaner with every upgrade, and change colour entirely when fully maxed.',
    '⚡ Tesla lightning is thicker, forked, and far more dramatic — violet when maxed.',
    '🤖 Omega redesigned as a true robot T-Rex, blinking antenna and all.',
    '🦖 All ground bosses now move twice as fast.',
    '⏱️ Game speed auto-resets to 1× whenever a dinosaur reaches your base.',
    '🎯 Range buffs for the Missile Battery, Mortar, and Sonic Emitter.',
  ]},
  {v: '1.22.2', date: 'Jul 6, 2026', items: [
    '✨ All-new animated home screen with live map previews, a day/night toggle — and giant boss dinosaurs roaming the background.',
    '🎯 Research Lab: new one-time +10% range unlock for every weapon.',
    '💰 Selling now refunds 25% — a new Double Sell Value lab unlock doubles that to 50%.',
    '📏 Major range rebalance: cheap guns are short-reach, heavy ordnance reaches far. Placement matters.',
    '⚙️ Developer options now sit behind a single password gate.',
    '🐛 Fixes: a home-screen crash, hard-to-read menu buttons, and the victory screen shaking forever.',
  ]},
  {v: '1.18.1', date: 'Jul 5, 2026', items: [
    '🦾 NEW: OMEGA — unleash a colossal robot T-Rex once per run, from wave 75. (Mason\'s idea!)',
    '🦖 The Indominus Rex now turns fully invisible — only a Sonic Emitter can reveal and hurt it.',
    '🔥 New clean-play streak: clear waves without leaks to grow a DNA multiplier up to ×2.5.',
    '🏁 Victory bonuses and a full end-of-run recap screen.',
    '⏩ New 10× game speed.',
    '📱 Big mobile improvements: stable top bar, better landscape layout, smoother shop scrolling.',
    '🎯 Weapon ranges are now fixed — only the Mortar gains range when upgraded.',
    '🏆 New level-25 and level-75 trophies, an Achievements button on the win/loss screens, and a one-tap "Play Difficulty N" button after every win.',
    '🔇 Per-weapon mute buttons; Mason\'s Gas no longer affects flyers, bosses, or tall dinos.',
  ]},
  {v: '1.15.2', date: 'Jul 4, 2026', items: [
    '☣️ New weapon: MASON\'S GAS — a lingering poison cloud that melts packs of ground dinos. (Designed by Mason, age 9.)',
    '🎚️ New progression: play any map at any difficulty from 1 to 1000, unlocking 10 levels at a time.',
    '🧬 Research Lab reworked: uncapped weapon, health, and cash upgrades — DNA now drops from every kill and wave.',
    '🏆 25 achievements, each paying a DNA reward.',
    '💥 Air Strike reworked into a full-zone cluster bomb.',
    '🦖 Tougher bosses, a redrawn wave-100 finale, richer sounds, and a friendlier first level.',
    '💾 Automatic save backup, plus copy/paste save codes in Settings.',
  ]},
  {v: '1.2.0', date: 'Jul 3, 2026', items: [
    '🦖 Initial release: five maps, 26 dinosaurs, eight weapons, and a DNA research lab.',
    '🌐 Published to the web, with run-resume so you can pick up where you left off.',
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

  /* --- aquatic (Mosasaur Lagoon) — swim the water channel; can't burn, and
         they dive under gas clouds --- */
  ichthyosaurus:    {name:'Ichthyosaurus',      painter:'aquatic',  hp:120, speed:112, armor:0, bounty:12, dmg:2,  size:15, minWave:4,  weight:9, water:true, burnImmune:true,
                     pal:{body:'#5a7d92', belly:'#d9e6ea', accent:'#324b58'}, feat:{}},
  plesiosaurus:     {name:'Plesiosaurus',       painter:'aquatic',  hp:380, speed:60,  armor:1, bounty:28, dmg:5,  size:26, minWave:10, weight:7, water:true, burnImmune:true,
                     pal:{body:'#4f7a6e', belly:'#d5e6da', accent:'#2e4c42'}, feat:{longNeck:true}},
  kronosaurus:      {name:'Kronosaurus',        painter:'aquatic',  hp:750, speed:55,  armor:3, bounty:52, dmg:8,  size:30, minWave:26, weight:5, water:true, burnImmune:true,
                     pal:{body:'#44606e', belly:'#c6d6da', accent:'#263a44'}, feat:{bigJaw:true}},

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
  blue:             {name:'Blue — Alpha Raptor', epithet:'THE PACK HUNTS WITH HER', painter:'theropod', hp:900,  speed:192, armor:1, bounty:120, dmg:15, size:18, boss:true, weight:0,
                     pal:{body:'#5a6b78', belly:'#c3ccd4', accent:'#2c5f8a'}, feat:{stripes:true}},
  trex:             {name:'Tyrannosaurus Rex',   epithet:'THE TYRANT QUEEN', painter:'theropod', hp:3000, speed:120, armor:3, bounty:300, dmg:25, size:32, boss:true, weight:0, roar:true,
                     pal:{body:'#6e5a44', belly:'#c9b493', accent:'#3d3022'}, feat:{bigHead:true}},
  spinosaurus:      {name:'Spinosaurus',         epithet:'THE RIVER MONSTER', painter:'theropod', hp:3600, speed:112, armor:3, bounty:340, dmg:28, size:33, boss:true, weight:0, roar:true,
                     pal:{body:'#5d7268', belly:'#c2d1c0', accent:'#b0703c'}, feat:{sail:true, longSnout:true}},
  indominus:        {name:'Indominus Rex',       epithet:'THE UNTAMABLE', painter:'theropod', hp:5200, speed:124, armor:4, bounty:420, dmg:32, size:31, boss:true, weight:0, roar:true,
                     cloak:true, regen:0.006,
                     pal:{body:'#b9c2c4', belly:'#e9eef0', accent:'#7c8a8d'}, feat:{bigHead:true, spikes:true}},
  indoraptor:       {name:'Indoraptor',          epithet:'THE NIGHTMARE MADE FLESH', painter:'theropod', hp:4200, speed:176, armor:3, bounty:400, dmg:30, size:24, boss:true, weight:0, roar:true,
                     pal:{body:'#26262b', belly:'#4c4c55', accent:'#d9a531'}, feat:{stripes:true, slim:true}},
  giganotosaurus:   {name:'Giganotosaurus',      epithet:'THE APEX OF APEX PREDATORS', painter:'theropod', hp:9000, speed:108, armor:5, bounty:800, dmg:45, size:36, boss:true, weight:0, roar:true,
                     pal:{body:'#4f4a52', belly:'#b7b0ba', accent:'#8a2f2f'}, feat:{bigHead:true, ridge:true}},
  drex:             {name:'D-Rex — Distortus Rex', epithet:'THE DEVIL YOU CREATED', painter:'mutant', hp:16000, speed:116, armor:8, bounty:2000, dmg:60, size:46, boss:true, weight:0, roar:true, regen:0.004,
                     pal:{body:'#6f6a63', belly:'#9c968b', accent:'#b83a30'},
                     feat:{glowEyes:true, fourArms:true}},
  whiteptera:       {name:'The White Pteranodon', epithet:'DEATH RIDES THE WIND — AIR WEAPONS ONLY', painter:'flyer', hp:4200, speed:66, armor:2, bounty:400, dmg:30, size:40, boss:true, weight:0, roar:true, flying:true,
                     pal:{body:'#e6e3da', belly:'#fbfaf5', accent:'#c3beb2'}, feat:{crest:true, glowEyes:true}},
  mosasaurus:       {name:'Mosasaurus',           epithet:'THE LAGOON QUEEN', painter:'aquatic', hp:5000, speed:96, armor:4, bounty:450, dmg:34, size:44, boss:true, weight:0, roar:true, water:true, burnImmune:true,
                     pal:{body:'#31505f', belly:'#cfdde2', accent:'#1b323d'}, feat:{bigJaw:true, ridge:true}},
};

/* Boss schedule — every 10th wave. Values are arrays (escorts allowed). */
const BOSS_WAVES = {
  10:  ['blue'],
  20:  ['trex'],
  30:  ['spinosaurus'],
  40:  ['whiteptera'],                  // air-only boss — forces anti-air coverage
  50:  ['indominus'],
  60:  ['spinosaurus', 'trex'],
  70:  ['indoraptor'],
  80:  ['indominus', 'whiteptera'],     // ground camo + air terror together
  90:  ['indoraptor', 'indominus'],
  100: ['drex'],
};

/* ---------- TOWERS / WEAPONS ----------
   maxUp = how many times the weapon can be upgraded (single track).
   Each upgrade: damage ×1.65, fire rate ×1.25, splash grows. Range is FIXED
   and never grows with upgrades or lab levels — the ONLY exception is the
   Mortar, which gains reach (×1.12) on its single upgrade.
   Range design: cheap guns are short-reach and reward tight placement; the
   Sniper (its whole identity) and the big/expensive ordnance (Missiles,
   Mortar) reach much farther. unlock = first wave the weapon is purchasable. */
const TOWERS = {
  gatling: {name:'ACU Gatling',    icon:'🔫', cost:180, dmg:9,   rof:7,    range:56,  air:true,  proj:'bullet', maxUp:3, unlock:1,
            desc:'Asset Containment turret. Low damage, very high fire rate, short reach.', color:'#c9c9c9'},
  flamer:  {name:'Flame Thrower',  icon:'🔥', cost:210, dmg:7,   rof:9,    range:72,  air:false, proj:'flame', maxUp:2, unlock:1,
            burn:{dps:22, t:2.2}, cone:0.62,
            desc:'Point-blank cone of fire. Sets ground targets ablaze.', color:'#ff9a3d'},
  sniper:  {name:'Ranger Sniper',  icon:'🎯', cost:270, dmg:95,  rof:0.6,  range:113, air:true,  proj:'snipe', pierce:true, maxUp:2, unlock:6,
            desc:'Huge single-shot damage at extreme range. Ignores armor.', color:'#7fb2ff'},
  cryo:    {name:'Cryo Cannon',    icon:'❄️', cost:290, dmg:12,  rof:1.0,  range:62,  air:true,  proj:'cryo', maxUp:2, unlock:1,
            splash:60, slow:{f:0.5, t:2.4},
            desc:'Freezing shells that heavily slow everything they splash.', color:'#bfe8ff'},
  tesla:   {name:'Tesla Node',     icon:'⚡', cost:310, dmg:45,  rof:1.0,  range:62,  air:true,  proj:'tesla', maxUp:2, unlock:12,
            chain:4, chainRange:75,
            desc:'10,000-volt perimeter tech. Arcs between up to 4 dinosaurs.', color:'#6ee7ff'},
  sonic:   {name:'Sonic Emitter',  icon:'📡', cost:370, dmg:50,  rof:0.9,  range:79,  air:true,  proj:'pulse', maxUp:2, unlock:15,
            reveal:true,
            desc:'Damages ALL dinosaurs in radius. Reveals camouflaged bosses.', color:'#d6a3ff'},
  missile: {name:'Missile Battery',icon:'🚀', cost:470, dmg:90,  rof:0.55, range:97,  air:true,  proj:'missile', maxUp:2, unlock:18,
            splash:70,
            desc:'Homing rockets with splash and long reach. Upgrades add a 2nd and 3rd rocket per salvo — the whole volley slams the same target.', color:'#ff6b6b'},
  mortar:  {name:'Mortar',         icon:'💣', cost:1000, dmg:200, rof:0.3, range:145, air:false, proj:'mortar', maxUp:1, unlock:28,
            splash:100, minRange:30,
            desc:'Lobbed shells devastate herds at the longest range in the armory. Cannot hit flyers or anything too close. One upgrade: massive damage, splash, and extra range.', color:'#e0b64f'},
  gas:     {name:"Mason's Gas",    icon:'☣️', cost:240, dmg:42,  rof:0.6, range:58,  air:false, proj:'gas', maxUp:2, unlock:3,
            cloud:{r:78, dur:3.4},
            desc:'Lobs a lingering cloud of toxic gas that poisons ground dinosaurs inside it — brutal against packed groups, and it ignores armor. Flyers, bosses, and tall long-necked dinos rise above the cloud.', color:'#a6e04a'},
};

/* Single-track upgrade tuning: every upgrade costs more than the weapon
   itself, and each level costs more than the last (1.2x, 2.0x, 2.8x base). */
const UPG = {
  mult: {dmg: 1.65, rof: 1.25, range: 1.12},
  cost: (towerDef, ulv) => Math.round(towerDef.cost * (1.2 + ulv * 0.8)),
};

/* ---------- LAB: range unlocks & sell value ----------
   Each weapon has ONE permanent +10% range unlock. Buying any one raises the
   price of every remaining range unlock by RANGE_UP_STEP (global escalation).
   Selling refunds SELL_BASE of what was invested; a one-time lab unlock
   (SELL_DOUBLE_COST) doubles that. */
const RANGE_UP_MULT   = 1.10;    // per-weapon range unlock multiplier
const RANGE_UP_BASE   = 10000;   // DNA for the first range unlock
const RANGE_UP_STEP   = 5000;    // +DNA to every remaining range unlock per one bought
const SELL_BASE       = 0.25;    // sell refund = 25% of invested...
const SELL_DOUBLE_MULT = 2;      // ...doubled to 50% once the lab unlock is bought
const SELL_DOUBLE_COST = 25000;  // DNA for the double-sell unlock

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

/* ---------- OMEGA (consumable show-stopper, Mason's idea) ----------
   A colossal robotic T-Rex materialises at the EXIT and stomps BACKWARD up the
   busiest lane, one-shotting every dinosaur it meets. Each kill wears down its
   durability, so a big enough horde can bring it down. Bosses only lose a slice
   of health (they survive) and cost it a big chunk of durability. Once per run,
   from wave 75. */
const OMEGA = {
  unlock: 75,          // first wave it can be deployed
  cost: 9000,          // premium — it's a run-defining panic button
  maxUses: 1,          // per run
  durability: 55,      // regular kills it can absorb before it's destroyed
  bigCost: 2,          // durability lost per large (size>=34) dino
  bossFrac: 0.30,      // fraction of a boss's MAX hp it deals
  bossCost: 18,        // durability lost per boss it strikes
  speed: 125,          // px/s stomping up the path
  size: 62,            // render size (boss-scale)
};

/* ---------- ACHIEVEMENTS (persistent trophy case) ----------
   Awarded for major accomplishments and shown on the main menu.
   Runs that use any developer cheat do NOT earn trophies. */
/* Each achievement grants a one-time DNA boost on unlock — harder ones pay
   more, to reward chasing the whole set. Ordered roughly easy → hard. */
const ACHIEVEMENTS = [
  {key:'boss_first', icon:'🦴',  name:'First Blood',        desc:'Defeat your very first boss dinosaur.',              dna:300},
  {key:'airstrike',  icon:'✈️',  name:'Danger Close',       desc:'Call in an Air Strike.',                            dna:250},
  {key:'wave50',     icon:'⏱️',  name:'Halfway In',         desc:'Reach wave 50 in any run.',                         dna:300},
  {key:'diff_10',    icon:'🥉',  name:'Getting Started',    desc:'Beat difficulty level 10.',                         dna:400},
  {key:'secure_0',   icon:'🌿',  name:'Perimeter Held',     desc:'Clear all 100 waves on The Perimeter Fence.',       dna:400},
  {key:'secure_1',   icon:'🏛️',  name:'Center Cleared',     desc:'Clear all 100 waves on the Visitor Center.',        dna:500},
  {key:'secure_2',   icon:'🪺',  name:'Aviary Locked',      desc:'Clear all 100 waves on The Aviary.',                dna:600},
  {key:'secure_3',   icon:'🌊',  name:'Delta Defended',     desc:'Clear all 100 waves on Site B: River Delta.',       dna:700},
  {key:'secure_4',   icon:'🌙',  name:'Estate Secured',     desc:'Clear all 100 waves on Lockwood Estate.',           dna:800},
  {key:'kills_1k',   icon:'💀',  name:'Exterminator',       desc:'Defeat 1,000 dinosaurs in total.',                  dna:600},
  {key:'wlv_10',     icon:'🔧',  name:'Gunsmith',           desc:'Level any weapon to 10 in the Research Lab.',       dna:800},
  {key:'diff_25',    icon:'🎖️',  name:'Holding the Line',   desc:'Beat difficulty level 25.',                         dna:800},
  {key:'diff_50',    icon:'🌶️',  name:'Rising Threat',      desc:'Beat difficulty level 50.',                         dna:1500},
  {key:'apex',       icon:'☠️',  name:'Devil Slain',        desc:'Defeat the D-Rex, the wave-100 final boss.',        dna:2500},
  {key:'flawless',   icon:'🛡️',  name:'Untouchable',        desc:'Clear a full 100-wave run without your base taking a single hit.', dna:3000},
  {key:'arsenal5',   icon:'🧰',  name:'Full Arsenal',       desc:'Level every weapon to at least 5.',                 dna:4000},
  {key:'island',     icon:'🏝️',  name:'Every Map',          desc:'Clear all 100 waves on all five maps.',             dna:5000},
  {key:'diff_75',    icon:'⚔️',  name:'Veteran Ranger',     desc:'Beat difficulty level 75.',                         dna:3000},
  {key:'diff_100',   icon:'🥈',  name:'Triple Digits',      desc:'Beat difficulty level 100.',                        dna:6000},
  {key:'wlv_25',     icon:'🛠️',  name:'Master Armorer',     desc:'Level any weapon to 25.',                           dna:12000},
  {key:'flawless_hi',icon:'🕊️',  name:'Perfect Storm',      desc:'Clear difficulty level 100 or higher without your base taking a hit.', dna:25000},
  {key:'diff_250',   icon:'🌋',  name:'Deep Descent',       desc:'Beat difficulty level 250.',                        dna:40000},
  {key:'kills_50k',  icon:'🌑',  name:'Extinction Event',   desc:'Defeat 50,000 dinosaurs in total.',                 dna:60000},
  {key:'diff_500',   icon:'🥇',  name:'Into the Abyss',     desc:'Beat difficulty level 500.',                        dna:150000},
  {key:'wlv_50',     icon:'⚙️',  name:'Weapons Grandmaster',desc:'Level any weapon to 50.',                           dna:250000},
  {key:'diff_750',   icon:'🔥',  name:'The Long Climb',     desc:'Beat difficulty level 750.',                        dna:600000},
  {key:'diff_1000',  icon:'👑',  name:'Ascendant',          desc:'Beat difficulty level 1000 — the summit of the climb.', dna:2000000},
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

  /* OPEN-WORLD map: no road. Ground dinos pour in at the CENTER-LEFT and
     free-roam toward the CENTER-RIGHT exit; your weapons are physical walls
     they must path around (a placement that seals the field completely is
     rejected). Flyers soar straight across. paths[0] is the virtual straight
     line used by flyers, Omega, and the gate/checkpoint set dressing. */
  {name:'The Proving Grounds', sub:'Open savanna — your weapons ARE the wall', night:false, flyerBias:1.5, hpMult:3.4, maze:true,
   theme:{grass:'#41541f', grass2:'#4e6326', path:'#8a7a50', pathEdge:'#5e5232', tree:'#2b4218', water:null},
   paths:[[{x:-40,y:360},{x:1320,y:360}]]},

  /* LAND + WATER map: a jungle road AND a river channel. Aquatic dinosaurs
     (water:true) swim the river — the Mosasaurus rules it (map-specific boss
     schedule below). paths[1] is the water channel. */
  {name:'Mosasaur Lagoon', sub:'Site C — the water hunts back', night:false, flyerBias:1.1, hpMult:4.0, waterPaths:[1],
   theme:{grass:'#3a5030', grass2:'#466038', path:'#93714a', pathEdge:'#64512f', tree:'#26401e', water:'#2e5d74'},
   bosses:{30:['mosasaurus'], 60:['mosasaurus','trex'], 80:['indominus','mosasaurus']},
   paths:[[{x:-40,y:150},{x:350,y:150},{x:350,y:320},{x:700,y:320},{x:700,y:160},{x:1050,y:160},{x:1050,y:440},{x:1320,y:440}],
          [{x:-40,y:560},{x:300,y:560},{x:500,y:480},{x:820,y:480},{x:1010,y:570},{x:1160,y:500},{x:1320,y:440}]]},
];

const WAVES_PER_LEVEL = 100;

/* ---------- DIFFICULTY LEVELS (1..1000) ----------
   The player picks a MAP and a difficulty LEVEL. Enemy health (and a touch
   of speed) scale with the level; DNA income scales too so you can keep
   affording upgrades. Levels unlock a block of 10 at a time — clear the
   highest one available to open the next block.
   ---- BALANCE (first-pass — expect tuning) ---- */
const MAX_DIFFICULTY = 1000;
const DIFF_BLOCK     = 10;      // levels unlock 10 at a time
/* KEY BALANCE RELATIONSHIP: enemy-HP growth per level == weapon-damage growth
   per level (both 1.11). That makes "weapon level ≈ difficulty level" a fair
   fight: weapons a few levels ABOVE the difficulty dominate it, weapons a few
   levels BELOW get overwhelmed. DNA income grows at the same rate so the climb
   stays fundable. */
const DIFF_HP_GROWTH = 1.11;    // enemy HP ×/level — matches weapon damage growth
const DIFF_SPD_MAX   = 1.6;     // enemy speed creep from difficulty caps here
const DNA_GROWTH     = 1.12;    // DNA income ×/level — matches upgrade-cost growth so it stays ~1 upgrade per clear at every level
/* DNA economy is deliberately STINGY: beating a level should fund only ~1
   weapon upgrade, so you can't farm a weak level to over-level and trivialize
   the next ones. The level-CLEAR bonus is the real reward; per-kill DNA is
   just a small trickle (and partial credit if you lose). Both scale with
   difficulty, so pushing higher pays far more than replaying low levels. */
const DNA_PER_BOUNTY = 0.00012; // DNA per kill = enemy cash-bounty × this × difficulty factor (tiny)
/* DNA is banked EVERY wave cleared (× difficulty factor), so a run that dies
   partway still earns DNA proportional to how far it got — no more dead-ends
   where you can't beat a level and can never build DNA to get stronger. Later
   waves pay a little more. A full 100-wave clear also gets a finishing bonus. */
const WAVE_DNA_BASE  = 0.8;     // DNA for clearing a wave, before the ramp/difficulty factor
const WAVE_DNA_RAMP  = 0.016;   // extra DNA per wave number (wave 100 pays more than wave 1)
const waveDna = w => WAVE_DNA_BASE + WAVE_DNA_RAMP * w;

/* CLEAN-PLAY STREAK (inspired by Robo Defense's reward multiplier): clearing a
   wave with no leaks grows a bonus multiplier that scales ALL wave DNA; letting
   a dino through knocks it back down. Sloppy play stays at ×1.0 = the base
   economy, so this is a pure skill reward on top. */
const STREAK_STEP      = 0.05;  // +multiplier per clean (no-leak) wave
const STREAK_MAX       = 2.5;   // multiplier cap
const STREAK_LEAK_MULT = 0.5;   // multiplier is halved when a dino leaks
/* end-of-run (full 100-wave clear) bonuses, as a % of the DNA earned that run */
const VICTORY_PCT  = 0.20;      // +20% for finishing all 100 waves
const HEALTH_PCT   = 0.30;      // up to +30%, scaled by remaining base health
const FLAWLESS_PCT = 0.25;      // +25% more if your base took zero damage

/* Early-game easing: the low levels are softened so a fresh player can beat
   Level 1 (and climb the first stretch) with little or no upgrading — hard,
   but fair. The discount fades out to full strength by EASE_SPAN, after which
   the normal curve takes over. */
const EASE_FLOOR = 0.4;   // Level 1 enemies at 40% of the base-curve health
const EASE_SPAN  = 15;    // eased back to full strength by this level
const diffEase = D => Math.min(1, EASE_FLOOR + (1 - EASE_FLOOR) * (D - 1) / (EASE_SPAN - 1));

/* difficulty helpers */
const diffHpMult    = D => Math.pow(DIFF_HP_GROWTH, D - 1) * diffEase(D);
const diffSpdMult   = D => Math.min(DIFF_SPD_MAX, 1 + (D - 1) * 0.0015);
const diffDnaMult   = D => Math.pow(DNA_GROWTH, D - 1);
/* highest selectable level given the best level ever beaten */
const diffUnlocked  = best => Math.min(MAX_DIFFICULTY, (Math.floor((best || 0) / DIFF_BLOCK) + 1) * DIFF_BLOCK);

/* ---------- WEAPON LEVELS (persistent DNA research, UNCAPPED) ----------
   Every weapon starts at level 1 and can be leveled forever. Each level
   multiplies its damage and gives a little fire-rate, so you keep pouring
   DNA in to out-scale higher difficulties. Range is deliberately NOT scaled
   by weapon level — a weapon's reach is a fixed part of its identity. */
const WLV_DMG_GROWTH = 1.11;    // weapon damage ×/level (== DIFF_HP_GROWTH by design)
const WLV_ROF_PER    = 0.02;    // +2% fire rate /level (capped in stats)
const WLV_COST_GROWTH = 1.12;   // DNA cost ×/level — a hair above income so top levels get grindier

const wlvDmgMult  = L => Math.pow(WLV_DMG_GROWTH, (L || 1) - 1);
const wlvRofMult  = L => 1 + Math.min(1.5, ((L || 1) - 1) * WLV_ROF_PER);   // +up to 150% fire rate
/* cost to go from level L to L+1 — cheaper for cheap weapons, grows each level */
const wlvCost = (def, L) => Math.round((20 + def.cost / 5) * Math.pow(WLV_COST_GROWTH, (L || 1) - 1));

/* ---------- META UPGRADES (persistent DNA research, UNCAPPED) ----------
   Base health and starting cash — level them forever with DNA, just like
   weapons. These default to level 0 (no bonus) and scale linearly. */
const META = [
  {key:'base_hp',    icon:'🏥', name:'Bunker Plating', per:25, base:80,  desc:'+25 max base health per level.'},
  {key:'start_cash', icon:'💰', name:'InGen Funding',  per:75, base:100, desc:'+$75 starting cash per level.'},
];
const metaCost = (entry, L) => Math.round(entry.base * Math.pow(1.14, L || 0));
