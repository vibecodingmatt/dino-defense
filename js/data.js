'use strict';
/* =========================================================
   ISLA DEFENSE — game data
   Dinosaurs, towers, levels, lab research.
   ========================================================= */

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
  blue:             {name:'Blue — Alpha Raptor', epithet:'THE PACK HUNTS WITH HER', painter:'theropod', hp:900,  speed:92, armor:1, bounty:120, dmg:15, size:18, boss:true, weight:0,
                     pal:{body:'#5a6b78', belly:'#c3ccd4', accent:'#2c5f8a'}, feat:{stripes:true}},
  trex:             {name:'Tyrannosaurus Rex',   epithet:'THE TYRANT QUEEN', painter:'theropod', hp:3000, speed:46, armor:3, bounty:300, dmg:25, size:32, boss:true, weight:0, roar:true,
                     pal:{body:'#6e5a44', belly:'#c9b493', accent:'#3d3022'}, feat:{bigHead:true}},
  spinosaurus:      {name:'Spinosaurus',         epithet:'THE RIVER MONSTER', painter:'theropod', hp:3600, speed:42, armor:3, bounty:340, dmg:28, size:33, boss:true, weight:0, roar:true,
                     pal:{body:'#5d7268', belly:'#c2d1c0', accent:'#b0703c'}, feat:{sail:true, longSnout:true}},
  indominus:        {name:'Indominus Rex',       epithet:'THE UNTAMABLE', painter:'theropod', hp:5200, speed:48, armor:4, bounty:420, dmg:32, size:31, boss:true, weight:0, roar:true,
                     cloak:true, regen:0.006,
                     pal:{body:'#b9c2c4', belly:'#e9eef0', accent:'#7c8a8d'}, feat:{bigHead:true, spikes:true}},
  indoraptor:       {name:'Indoraptor',          epithet:'THE NIGHTMARE MADE FLESH', painter:'theropod', hp:4200, speed:76, armor:3, bounty:400, dmg:30, size:24, boss:true, weight:0, roar:true,
                     pal:{body:'#26262b', belly:'#4c4c55', accent:'#d9a531'}, feat:{stripes:true, slim:true}},
  giganotosaurus:   {name:'Giganotosaurus',      epithet:'THE APEX OF APEX PREDATORS', painter:'theropod', hp:9000, speed:40, armor:5, bounty:800, dmg:45, size:36, boss:true, weight:0, roar:true,
                     pal:{body:'#4f4a52', belly:'#b7b0ba', accent:'#8a2f2f'}, feat:{bigHead:true, ridge:true}},
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
  100: ['giganotosaurus', 'trex', 'trex'],
};

/* ---------- TOWERS / WEAPONS ---------- */
const TOWERS = {
  tranq:   {name:'Tranq Turret',   icon:'💉', cost:100, dmg:9,  rof:1.2,  range:135, air:true,  proj:'dart',
            slow:{f:0.82, t:1.2},
            desc:'Cheap dart rifle. Darts mildly sedate targets, slowing them.', color:'#8fd14f'},
  gatling: {name:'ACU Gatling',    icon:'🔫', cost:175, dmg:6,  rof:6.5,  range:125, air:true,  proj:'bullet',
            desc:'Asset Containment turret. Low damage, very high fire rate.', color:'#c9c9c9'},
  sniper:  {name:'Ranger Sniper',  icon:'🎯', cost:250, dmg:70, rof:0.55, range:270, air:true,  proj:'snipe', pierce:true,
            desc:'Huge single-shot damage at extreme range. Ignores armor.', color:'#7fb2ff'},
  flamer:  {name:'Flame Thrower',  icon:'🔥', cost:200, dmg:5,  rof:9,    range:95,  air:false, proj:'flame',
            burn:{dps:14, t:2}, cone:0.62,
            desc:'Short-range cone of fire. Sets ground targets ablaze.', color:'#ff9a3d'},
  tesla:   {name:'Tesla Node',     icon:'⚡', cost:300, dmg:30, rof:0.9,  range:145, air:true,  proj:'tesla',
            chain:3, chainRange:110,
            desc:'10,000-volt perimeter tech. Arcs between up to 3 dinosaurs.', color:'#6ee7ff'},
  missile: {name:'Missile Battery',icon:'🚀', cost:450, dmg:65, rof:0.5,  range:210, air:true,  proj:'missile',
            splash:65,
            desc:'Homing rockets with big splash damage. Great vs. herds.', color:'#ff6b6b'},
  cryo:    {name:'Cryo Cannon',    icon:'❄️', cost:275, dmg:8,  rof:0.9,  range:155, air:true,  proj:'cryo',
            splash:55, slow:{f:0.55, t:2.2},
            desc:'Freezing shells that heavily slow everything they splash.', color:'#bfe8ff'},
  sonic:   {name:'Sonic Emitter',  icon:'📡', cost:350, dmg:34, rof:0.8,  range:115, air:true,  proj:'pulse',
            reveal:true,
            desc:'Damages ALL dinosaurs in radius. Reveals camouflaged bosses.', color:'#d6a3ff'},
};

/* Per-stat upgrade tuning (5 levels each) */
const UPG = {
  maxLv: 5,
  dmg:   {label:'Damage',    mult:0.35},
  rate:  {label:'Fire Rate', mult:0.20},
  range: {label:'Range',     mult:0.12},
  cost: (towerDef, lv) => Math.round(towerDef.cost * 0.6 * Math.pow(1.55, lv)),
};

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
  {key:'ammo_tranq',   icon:'💉', name:'Potent Toxins',     max:5, baseCost:35, ammo:'tranq',   desc:'Tranq ammo: +8% dmg, +4% fire rate / tier.'},
  {key:'ammo_gatling', icon:'🔫', name:'AP Rounds',         max:5, baseCost:35, ammo:'gatling', desc:'Gatling ammo: +8% dmg, +4% fire rate / tier.'},
  {key:'ammo_sniper',  icon:'🎯', name:'Depleted Uranium',  max:5, baseCost:45, ammo:'sniper',  desc:'Sniper ammo: +8% dmg, +4% fire rate / tier.'},
  {key:'ammo_flamer',  icon:'🔥', name:'Napalm Mix',        max:5, baseCost:40, ammo:'flamer',  desc:'Flamer fuel: +8% dmg, +4% fire rate / tier.'},
  {key:'ammo_tesla',   icon:'⚡', name:'Supercapacitors',   max:5, baseCost:45, ammo:'tesla',   desc:'Tesla cells: +8% dmg, +4% fire rate / tier.'},
  {key:'ammo_missile', icon:'🚀', name:'HE Payloads',       max:5, baseCost:50, ammo:'missile', desc:'Missile ammo: +8% dmg, +4% fire rate / tier.'},
  {key:'ammo_cryo',    icon:'❄️', name:'Liquid Nitrogen',   max:5, baseCost:40, ammo:'cryo',    desc:'Cryo shells: +8% dmg, +4% fire rate / tier.'},
  {key:'ammo_sonic',   icon:'📡', name:'Resonance Tuning',  max:5, baseCost:45, ammo:'sonic',   desc:'Sonic emitter: +8% dmg, +4% fire rate / tier.'},
];
const labCost = (entry, tier) => Math.round(entry.baseCost * Math.pow(1.55, tier));
