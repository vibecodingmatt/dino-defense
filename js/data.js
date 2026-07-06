'use strict';
/* =========================================================
   ISLA DEFENSE — game data
   Dinosaurs, towers, levels, lab research.
   ========================================================= */

const VERSION = '1.18.0';

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
   player-facing changes only. Keep it about what changed for the player — no
   internal numbers, formulas, or how things are calculated.
   IMPORTANT: date each entry with the ACTUAL current calendar date (check the
   real date — don't reuse the previous entry's date). When shipping on a new
   day, add a NEW dated entry at the top; when shipping again the same day,
   update that day's entry and bump its `v`. */
const CHANGELOG = [
  {v: '1.18.0', date: 'Jul 5, 2026', items: [
    '🦖 The Indominus Rex is finally the apex threat it should be: a couple of seconds after it charges in — you\'ll get a "👻 It vanished!" warning — it turns completely invisible AND invulnerable. Only a 📡 Sonic Emitter\'s pulse can reveal and damage it, so you MUST guard its lane with one. It stalks in on waves 50, 80 and 90.',
    '🎉 The victory celebration settles down now — the screen-shake eases off after about 3 seconds instead of rattling the whole time.',
    '📖 Refreshed the in-game Field Manual with entries for Omega, the clean-play streak, end-of-run bonuses, Mason\'s Gas, achievements, and the new 10× speed.',
    '🛠️ Fixed the weapon-upgrade panel jittering up and down (and becoming impossible to close) after upgrading near the edge of the map — it now stays put over the weapon.',
    '✨ Cleaned up a stray, purposeless scrollbar that sometimes appeared on the weapon-upgrade panel on desktop.',
    '🏆 The win and defeat screens now have an Achievements button, so you can jump straight to your trophy case after a run — a handy nudge if you didn\'t spot it on the menu.',
    '➜ After clearing a level, the top button now reads "Play Difficulty N" and drops you straight into the next difficulty on the same map to keep the climb going (it steps aside once you\'ve conquered level 1000).',
    '🏅 Two new difficulty milestones to chase: trophies for beating level 25 and level 75, filling the gap between the level 10, 50, and 100 badges.',
    '🦾 NEW SHOW-STOPPER — OMEGA! From wave 75 you can unleash a colossal robotic T-Rex that materialises at the exit and stomps up your busiest lane, one-shotting every dinosaur it meets in a shower of sparks. Each kill wears down its armor, so a big horde can bring it down — and bosses only lose 30% and keep coming. One deployment per run. (Dreamed up by Mason, age 9.)',
    '⏩ Replaced the 6× game-speed with a new 10× — hit fast-forward to blast through a wave once you know you\'ve got it handled.',
    '📱 Tidied the top bar on mobile: money, DNA, health and the pause/mute buttons now stay locked on a single line instead of jumping onto a second row and stealing space from the game.',
    '📱 Fixed the weapon-upgrade menu getting cut off the bottom of the screen on mobile landscape — it now stays fully on-screen (and is more compact on short screens) so Upgrade and Sell are always visible.',
    '📱 Mobile landscape overhaul: the weapon shop now sits beside the map (no more scrolling below it to reach your weapons). Drag a weapon sideways onto the map to drop it — its range/blast radius previews right under your finger before you release — or just tap to select, then tap the map. Scrolling the weapon list is smooth again: a normal up/down swipe on the cards scrolls the shop.',
    '🔥 New CLEAN-PLAY STREAK: clear waves without letting anything leak and a bonus multiplier climbs (up to ×2.5), boosting all the DNA you earn — but a leak knocks it back down. Watch it in the HUD and protect it! Skilled, tidy play now pays off much better, while sloppy play earns the same as before.',
    '🏁 Beating all 100 waves now adds end-of-run bonuses: a victory bonus, a bonus scaled to your remaining base health, and an extra kicker for a flawless (no-damage) run.',
    '📊 Full victory recap: clearing a level pops a detailed results screen — dinosaurs defeated, best streak, DNA from the fight, every bonus, total DNA banked, and cash earned.',
    '🔇 Every weapon now has a mute button in its popup menu — tap a weapon to silence just that weapon\'s sounds. Mason\'s Gas is also a much softer, quieter toot now.',
    '☣️ Mason\'s Gas balance: flyers, bosses, and tall long-necked dinos (like Brachiosaurus) now rise above the cloud and take no poison — it\'s for clearing packs of regular ground dinos.',
  ]},
  {v: '1.15.2', date: 'Jul 4, 2026', items: [
    '☣️ New weapon — MASON\'S GAS! It toots out a puff of green poison gas that lingers on the ground and poisons the dinosaurs that walk through the cloud (ignoring armor). Flyers float above it. A little stronger than the Flame Thrower, and great against big packs. (Designed by Mason, age 9.)',
    '🎚️ New progression: choose a map and a difficulty level from 1 to 1000. Levels unlock 10 at a time — beat the highest one available to open the next block.',
    '🧬 Research Lab reworked: spend DNA to permanently level up every weapon — plus your base health and starting cash — with no cap. DNA now drops from every kill and every wave you clear (so even a run that falls short earns something), and pays out more the higher you climb.',
    '⚔️ Keep your weapon levels close to the level you\'re playing: get ahead and it\'s a breeze, fall behind and you\'ll be overrun. Beating a level funds roughly one weapon upgrade, so you can\'t grind an easy level to over-level and trivialize the rest.',
    '🐣 Friendlier start: begin with 80 DNA for a first upgrade, and the early levels are softened so Level 1 is beatable with little or no upgrading (full difficulty returns by Level 15). A "Place a weapon to begin" prompt guides the opening, and the first wave auto-starts a few seconds after you place your first weapon.',
    '🛠️ Tap any placed weapon for a menu right over it — upgrade (cost shown, glows green when affordable) or sell (refund shown, with a confirm tap so a stray tap can\'t sell it).',
    '🏆 25 achievements on their own menu page — each awards a DNA bonus, with far bigger payouts for the tougher feats.',
    '💥 Air Strike reworked into a full-zone cluster bomb: it carpets the whole map, wipes out regular dinosaurs, and takes a big bite out of any boss.',
    '☠ Bosses are much tougher, and the wave-100 finale — the four-armed D-Rex — was completely redrawn.',
    '🦖 The island comes alive: dinosaurs screech, snarl and bellow as they fall, with the occasional distant roar. Boss roars are bigger, and gunfire and explosions hit harder.',
    '🚀 Missile Battery: a salvo\'s rockets now all lock onto the same target for concentrated splash — and rockets no longer circle their target before hitting.',
    '🧪 Developer options (invincibility, unlimited cash, level skip) are password-protected, and runs that use them earn no DNA or achievements.',
    '🎵 Original looping soundtrack, boss roars, blood splatter, and a wave-100 fireworks celebration.',
    '💾 Save protection: your progress is backed up automatically, with copy/paste save codes in Settings to move it between devices.',
    '💡 Added a Tips / Field Manual to the menu.',
  ]},
  {v: '1.2.0', date: 'Jul 3, 2026', items: [
    '🦖 Initial release: five maps, 26 dinosaurs, eight weapons, and a DNA research lab.',
    '🌐 Published to the web, with run-resume so you can close the tab and pick up right where you left off.',
    '🎨 Graphics and audio overhaul: jungle terrain, the park gates, boss health bars, damage numbers, and boss roars.',
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
            desc:'Homing rockets with splash. Upgrades add a 2nd and 3rd rocket per salvo — the whole volley slams the same target.', color:'#ff6b6b'},
  mortar:  {name:'Mortar',         icon:'💣', cost:1000, dmg:200, rof:0.3, range:310, air:false, proj:'mortar', maxUp:1, unlock:28,
            splash:100, minRange:90,
            desc:'Lobbed shells devastate herds at long range. Cannot hit flyers or anything too close. One upgrade: massive damage and splash.', color:'#e0b64f'},
  gas:     {name:"Mason's Gas",    icon:'☣️', cost:240, dmg:42,  rof:0.6, range:150, air:false, proj:'gas', maxUp:2, unlock:3,
            cloud:{r:78, dur:3.4},
            desc:'Lobs a lingering cloud of toxic gas that poisons ground dinosaurs inside it — brutal against packed groups, and it ignores armor. Flyers, bosses, and tall long-necked dinos rise above the cloud.', color:'#a6e04a'},
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
   multiplies its damage and gives a little fire-rate/range, so you keep
   pouring DNA in to out-scale higher difficulties. */
const WLV_DMG_GROWTH = 1.11;    // weapon damage ×/level (== DIFF_HP_GROWTH by design)
const WLV_ROF_PER    = 0.02;    // +2% fire rate /level (capped in stats)
const WLV_RANGE_PER  = 0.015;   // +1.5% range   /level (capped in stats)
const WLV_COST_GROWTH = 1.12;   // DNA cost ×/level — a hair above income so top levels get grindier

const wlvDmgMult  = L => Math.pow(WLV_DMG_GROWTH, (L || 1) - 1);
const wlvRofMult  = L => 1 + Math.min(1.5, ((L || 1) - 1) * WLV_ROF_PER);   // +up to 150% fire rate
const wlvRangeMult = L => 1 + Math.min(0.6, ((L || 1) - 1) * WLV_RANGE_PER); // +up to 60% range
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
