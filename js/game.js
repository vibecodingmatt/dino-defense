'use strict';
/* =========================================================
   ISLA DEFENSE — engine, UI, and game logic
   ========================================================= */

/* ---------------- helpers ---------------- */
const $  = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rand  = (a, b) => a + Math.random() * (b - a);
const hyp   = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const fmt   = n => n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 10000 ? (n/1000).toFixed(1)+'k' : Math.floor(n).toString();

const W = 1280, H = 720;

/* ---------------- persistent save ---------------- */
const SAVE_KEY = 'islaDefense.v1';
function defaultSave(){
  return {unlocked:1, best:{}, dna:0, lab:{}, run:null,
          settings:{invincible:false, mute:false, auto:true, music:true}};
}
function loadSave(){
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!s) return defaultSave();
    const d = defaultSave();
    return {unlocked: s.unlocked || 1, best: s.best || {}, dna: s.dna || 0, lab: s.lab || {},
            run: s.run || null,
            settings: Object.assign(d.settings, s.settings || {})};
  } catch(e){ return defaultSave(); }
}
/* old saves stored per-stat tower levels; convert to the single track,
   and drop towers whose type no longer exists (e.g. the retired tranq) */
function migrateTowers(list){
  if (!list) return;
  for (let i = list.length - 1; i >= 0; i--){
    const t = list[i];
    if (!TOWERS[t.key]){ list.splice(i, 1); continue; }
    if (t.ulv === undefined){
      const old = t.lv ? (t.lv.dmg || 0) + (t.lv.rate || 0) + (t.lv.range || 0) : 0;
      t.ulv = clamp(Math.round(old / 5), 0, TOWERS[t.key].maxUp);
      delete t.lv;
    }
  }
}
let save = loadSave();
if (save.run){ migrateTowers(save.run.towers); if (save.run.cp) migrateTowers(save.run.cp.towers); }

/* Layered persistence: localStorage is primary, IndexedDB is a mirror
   that recovers the save if site data gets partially cleared, and we ask
   the browser to mark our storage persistent (protects from eviction). */
let idb = null;
try {
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
  const req = indexedDB.open('islaDefense', 1);
  req.onupgradeneeded = () => req.result.createObjectStore('kv');
  req.onsuccess = () => {
    idb = req.result;
    if (!localStorage.getItem(SAVE_KEY)){
      const get = idb.transaction('kv').objectStore('kv').get('save');
      get.onsuccess = () => {
        if (get.result){
          localStorage.setItem(SAVE_KEY, get.result);
          save = loadSave();
          if (save.run){ migrateTowers(save.run.towers); if (save.run.cp) migrateTowers(save.run.cp.towers); }
          syncSettings(); buildMenu();
        }
      };
    }
  };
} catch(e){}
function persist(){
  const j = JSON.stringify(save);
  localStorage.setItem(SAVE_KEY, j);
  try { if (idb) idb.transaction('kv', 'readwrite').objectStore('kv').put(j, 'save'); } catch(e){}
}
const labTier = k => save.lab[k] || 0;

/* ---------------- synthesized audio engine ----------------
   Everything routes through a compressor + a generated convolution
   reverb, so sounds are layered and roomy instead of raw beeps. */
let AC = null, master = null, verb = null, musicGain = null;
const DIST_CURVE = (() => { // soft-clip curve for growls / gritty hits
  const c = new Float32Array(257);
  for (let i = 0; i < 257; i++) c[i] = Math.tanh((i/128 - 1) * 3);
  return c;
})();
function audio(){
  if (save.settings.mute) return null;
  if (!AC){
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      const comp = AC.createDynamicsCompressor();
      comp.threshold.value = -20; comp.knee.value = 18; comp.ratio.value = 5;
      comp.attack.value = 0.003; comp.release.value = 0.25;
      master = AC.createGain(); master.gain.value = 0.6;
      master.connect(comp); comp.connect(AC.destination);
      // impulse-response reverb: decaying noise burst (dark, cavernous)
      verb = AC.createConvolver();
      const dur = 1.7, n = (AC.sampleRate * dur) | 0;
      const buf = AC.createBuffer(2, n, AC.sampleRate);
      for (let ch = 0; ch < 2; ch++){
        const d = buf.getChannelData(ch);
        for (let i = 0; i < n; i++) d[i] = (Math.random()*2 - 1) * Math.pow(1 - i/n, 2.8);
      }
      verb.buffer = buf;
      const vg = AC.createGain(); vg.gain.value = 0.4;
      verb.connect(vg); vg.connect(master);
      musicGain = AC.createGain(); musicGain.gain.value = 0.8;
      musicGain.connect(master);
    } catch(e){ AC = null; return null; }
  }
  if (AC.state === 'suspended') AC.resume();
  return AC;
}
function routeOut(node, wet, bus){
  node.connect(bus || master);
  if (wet > 0){
    const g = AC.createGain(); g.gain.value = wet;
    node.connect(g); g.connect(verb);
  }
}
function envGain(t0, peak, a, dur){
  const g = AC.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  return g;
}
/* filtered noise burst */
function sfxNoise(o){
  const ac = audio(); if (!ac) return;
  const t0 = ac.currentTime + (o.delay || 0);
  const dur = o.dur;
  const n = Math.max(64, (ac.sampleRate * dur) | 0);
  const buf = ac.createBuffer(1, n, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random()*2 - 1;
  const src = ac.createBufferSource(); src.buffer = buf;
  const fl = ac.createBiquadFilter();
  fl.type = o.type || 'lowpass';
  fl.frequency.setValueAtTime(o.f0 || 1000, t0);
  if (o.f1) fl.frequency.exponentialRampToValueAtTime(Math.max(30, o.f1), t0 + dur);
  if (o.Q) fl.Q.value = o.Q;
  const g = envGain(t0, o.peak, o.a || 0.003, dur);
  src.connect(fl); fl.connect(g); routeOut(g, o.wet || 0, o.bus);
  src.start(t0); src.stop(t0 + dur + 0.05);
}
/* pitched tone with optional distortion + tremolo (growl texture) */
function sfxTone(o){
  const ac = audio(); if (!ac) return;
  const t0 = ac.currentTime + (o.delay || 0);
  const dur = o.dur;
  const osc = ac.createOscillator();
  osc.type = o.type || 'sine';
  osc.frequency.setValueAtTime(o.f0, t0);
  if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t0 + dur);
  const g = envGain(t0, o.peak, o.a || 0.006, dur);
  let head = osc;
  if (o.dist){
    const ws = ac.createWaveShaper(); ws.curve = DIST_CURVE;
    head.connect(ws); head = ws;
  }
  head.connect(g);
  if (o.tremF){ // amplitude wobble — the "growl"
    const lfo = ac.createOscillator(); lfo.frequency.setValueAtTime(o.tremF, t0);
    if (o.tremF1) lfo.frequency.linearRampToValueAtTime(o.tremF1, t0 + dur);
    const lg = ac.createGain(); lg.gain.value = o.peak * (o.tremD || 0.4);
    lfo.connect(lg); lg.connect(g.gain);
    lfo.start(t0); lfo.stop(t0 + dur + 0.1);
  }
  routeOut(g, o.wet || 0, o.bus);
  osc.start(t0); osc.stop(t0 + dur + 0.1);
}
/* ---------------- background score (synthesized loop) ----------------
   A quiet 8-bar jungle-adventure theme: deep drone bass over Am–F–C–E,
   tribal tom/shaker percussion, and an airy pentatonic melody that
   surfaces on the back half of the loop. Scheduled a bar at a time so
   toggling music off stops it almost immediately. */
const MUS = {
  bpm: 88,
  barDur: 60 / 88 * 4,
  roots:  [110, 110, 87.31, 98, 110, 87.31, 130.81, 82.41], // Am Am F G Am F C E
  melody: [ // [bar, beat, freq, lengthInBeats]
    [4, 0, 440, 1.2], [4, 1.5, 523.25, 0.45], [4, 2, 659.25, 1.6],
    [5, 0, 587.33, 0.9], [5, 1, 523.25, 0.9], [5, 2, 440, 1.8],
    [6, 0, 659.25, 1.2], [6, 1.5, 783.99, 0.45], [6, 2, 880, 1.7],
    [7, 0, 783.99, 0.9], [7, 1, 659.25, 0.9], [7, 2, 587.33, 1.8],
  ],
};
let musicTimer = null, musicNextBar = 0, musicBarIdx = 0;
function scheduleBar(bar, t0){
  const beat = MUS.barDur / 4;
  const at = t => Math.max(0, t0 + t * beat - AC.currentTime);
  const root = MUS.roots[bar];
  // drone bass + soft pad (root, fifth, octave)
  sfxTone({type: 'triangle', f0: root,        dur: MUS.barDur * 0.98, peak: 0.05,  a: 0.5, wet: 0.3, bus: musicGain, delay: at(0)});
  sfxTone({type: 'sine',     f0: root * 1.5,  dur: MUS.barDur * 0.98, peak: 0.026, a: 0.9, wet: 0.45, bus: musicGain, delay: at(0)});
  sfxTone({type: 'sine',     f0: root * 2,    dur: MUS.barDur * 0.98, peak: 0.02,  a: 1.1, wet: 0.45, bus: musicGain, delay: at(0)});
  // tribal drums
  for (const [b, f, p] of [[0, 70, 0.13], [0.75, 70, 0.055], [1.5, 104, 0.085], [2.5, 70, 0.115], [3.25, 104, 0.055]])
    sfxTone({type: 'sine', f0: f, f1: f * 0.55, dur: 0.24, peak: p, wet: 0.3, bus: musicGain, delay: at(b)});
  // shaker eighths
  for (let i = 0; i < 8; i++)
    sfxNoise({dur: 0.05, peak: i % 2 ? 0.011 : 0.018, type: 'highpass', f0: 6200, wet: 0.35, bus: musicGain, delay: at(i * 0.5 + 0.5)});
  // melody (with a faint octave shimmer)
  for (const [mb, b, f, len] of MUS.melody){
    if (mb !== bar) continue;
    sfxTone({type: 'triangle', f0: f,         dur: len * beat, peak: 0.042, a: 0.04, wet: 0.55, bus: musicGain, delay: at(b)});
    sfxTone({type: 'sine',     f0: f * 2.003, dur: len * beat, peak: 0.011, a: 0.06, wet: 0.55, bus: musicGain, delay: at(b)});
  }
}
function ensureMusic(){
  if (!save.settings.music || save.settings.mute){ stopMusic(); return; }
  const ac = audio();
  if (!ac || ac.state !== 'running') return; // waits for the first user gesture
  if (musicTimer) return;
  musicGain.gain.cancelScheduledValues(ac.currentTime);
  musicGain.gain.setValueAtTime(0.8, ac.currentTime);
  musicNextBar = ac.currentTime + 0.15;
  musicBarIdx = 0;
  musicTimer = setInterval(() => {
    if (!AC || AC.state !== 'running') return;
    while (musicNextBar < AC.currentTime + 0.6){
      scheduleBar(musicBarIdx % MUS.roots.length, musicNextBar);
      musicBarIdx++;
      musicNextBar += MUS.barDur;
    }
  }, 200);
}
function stopMusic(){
  if (musicTimer){ clearInterval(musicTimer); musicTimer = null; }
  if (musicGain && AC){ // fade out whatever is already scheduled
    musicGain.gain.cancelScheduledValues(AC.currentTime);
    musicGain.gain.setValueAtTime(musicGain.gain.value, AC.currentTime);
    musicGain.gain.linearRampToValueAtTime(0.0001, AC.currentTime + 0.5);
  }
}
setInterval(ensureMusic, 600);

/* Rate limiter: rapid gunfire (especially at 4x with many towers) must not
   flood the audio thread — beyond a budget, extra combat sounds are dropped.
   Priority sounds (roars, fanfares, alarms) always play. */
let sfxTimes = [];
function sfxGate(){
  const now = performance.now();
  while (sfxTimes.length && now - sfxTimes[0] > 200) sfxTimes.shift();
  if (sfxTimes.length >= 11) return false;
  sfxTimes.push(now);
  return true;
}
const SFX = {
  jet(){ // fighter flyby: rising-then-falling roar (always plays)
    sfxNoise({dur: 2.2, peak: 0.22, type: 'bandpass', f0: 260, f1: 1700, Q: 0.7, wet: 0.5, a: 0.5});
    sfxTone({type: 'sawtooth', f0: 80, f1: 260, dur: 2.0, peak: 0.09, dist: true, wet: 0.4, a: 0.5});
  },
  alert(){ // strike-inbound radio blips
    sfxTone({type: 'triangle', f0: 1050, dur: 0.08, peak: 0.07, wet: 0.2});
    sfxTone({type: 'triangle', f0: 1050, dur: 0.08, peak: 0.07, wet: 0.2, delay: 0.16});
    sfxTone({type: 'triangle', f0: 1400, dur: 0.12, peak: 0.08, wet: 0.25, delay: 0.32});
  },
  firework(){ // celebration burst: thump + crackle
    sfxTone({type: 'sine', f0: 120, f1: 45, dur: 0.25, peak: 0.12, wet: 0.4});
    sfxNoise({dur: 0.5, peak: 0.06, type: 'highpass', f0: 3200, wet: 0.55, a: 0.05, delay: 0.08});
  },
  victoryTune(){ // triumphant fanfare for clearing wave 100
    const notes = [[523, 0], [659, 0.14], [784, 0.28], [1047, 0.45], [784, 0.75], [1047, 0.9]];
    for (const [f, d] of notes) sfxTone({type: 'triangle', f0: f, dur: 0.35, peak: 0.09, wet: 0.5, delay: d});
    sfxTone({type: 'triangle', f0: 262, dur: 1.6, peak: 0.07, wet: 0.5, delay: 0.9});
    sfxTone({type: 'triangle', f0: 330, dur: 1.6, peak: 0.06, wet: 0.5, delay: 0.9});
    sfxNoise({dur: 0.8, peak: 0.03, type: 'highpass', f0: 5000, wet: 0.6, delay: 1.0});
  },
  shot(){ // gatling: noise crack + tiny thump, randomized so bursts don't buzz
    if (!sfxGate()) return;
    sfxNoise({dur: 0.06, peak: 0.09, type: 'bandpass', f0: 1600 + Math.random()*500, f1: 650, Q: 0.8, wet: 0.08});
    sfxTone({type: 'triangle', f0: 210, f1: 90, dur: 0.05, peak: 0.05});
  },
  dart(){ // pneumatic pfft
    if (!sfxGate()) return;
    sfxNoise({dur: 0.1, peak: 0.06, type: 'bandpass', f0: 2600, f1: 900, Q: 2, wet: 0.1});
    sfxTone({type: 'sine', f0: 1400, f1: 480, dur: 0.09, peak: 0.03, wet: 0.1});
  },
  snipe(){ // heavy rifle crack + sub thump, big room
    if (!sfxGate()) return;
    sfxNoise({dur: 0.3, peak: 0.28, type: 'lowpass', f0: 3800, f1: 240, wet: 0.55});
    sfxTone({type: 'sine', f0: 130, f1: 42, dur: 0.28, peak: 0.18, wet: 0.3});
  },
  boom(){ // layered explosion
    if (!sfxGate()) return;
    sfxNoise({dur: 0.65, peak: 0.3, type: 'lowpass', f0: 950, f1: 75, wet: 0.6});
    sfxTone({type: 'sine', f0: 150, f1: 34, dur: 0.6, peak: 0.24, wet: 0.4});
    sfxNoise({dur: 0.09, peak: 0.16, type: 'highpass', f0: 1400, wet: 0.3}); // initial crack
  },
  thoomp(){ // mortar launch
    if (!sfxGate()) return;
    sfxTone({type: 'sine', f0: 130, f1: 48, dur: 0.2, peak: 0.22, wet: 0.3});
    sfxNoise({dur: 0.12, peak: 0.1, type: 'lowpass', f0: 380, f1: 120, wet: 0.2});
  },
  zap(){ // electric arc: hissy crackle + gritty buzz
    if (!sfxGate()) return;
    sfxNoise({dur: 0.12, peak: 0.11, type: 'highpass', f0: 2200, Q: 1, wet: 0.25});
    sfxTone({type: 'sawtooth', f0: 1300, f1: 240, dur: 0.11, peak: 0.05, dist: true, wet: 0.2});
  },
  cryo(){ // icy whoosh rising
    if (!sfxGate()) return;
    sfxNoise({dur: 0.26, peak: 0.08, type: 'bandpass', f0: 600, f1: 2600, Q: 1.4, wet: 0.3});
    sfxTone({type: 'sine', f0: 850, f1: 1650, dur: 0.18, peak: 0.035, wet: 0.3});
  },
  pulse(){ // deep sonic throb
    if (!sfxGate()) return;
    sfxTone({type: 'sine', f0: 210, f1: 52, dur: 0.38, peak: 0.16, wet: 0.4, tremF: 28, tremD: 0.5});
  },
  coin(){ // soft two-note chime
    if (!sfxGate()) return;
    sfxTone({type: 'triangle', f0: 880, dur: 0.09, peak: 0.035, wet: 0.2});
    sfxTone({type: 'triangle', f0: 1318, dur: 0.12, peak: 0.03, wet: 0.25, delay: 0.055});
  },
  fanfare(){ // wave-clear: rising three-note motif
    sfxTone({type: 'triangle', f0: 523, dur: 0.14, peak: 0.06, wet: 0.35});
    sfxTone({type: 'triangle', f0: 659, dur: 0.14, peak: 0.06, wet: 0.35, delay: 0.09});
    sfxTone({type: 'triangle', f0: 784, dur: 0.3,  peak: 0.07, wet: 0.45, delay: 0.18});
    sfxNoise({dur: 0.25, peak: 0.02, type: 'highpass', f0: 6000, wet: 0.5, delay: 0.18});
  },
  leak(){ // breach klaxon, two falling blasts
    sfxTone({type: 'sawtooth', f0: 330, f1: 190, dur: 0.22, peak: 0.09, dist: true, wet: 0.25});
    sfxTone({type: 'sawtooth', f0: 260, f1: 140, dur: 0.28, peak: 0.09, dist: true, wet: 0.3, delay: 0.2});
  },
  roar(){ // boss entrance: layered growl chord + throat noise
    sfxTone({type: 'sawtooth', f0: 110, f1: 42, dur: 1.15, peak: 0.3,  dist: true, wet: 0.55, tremF: 9,  tremD: 0.55, a: 0.06});
    sfxTone({type: 'sawtooth', f0: 165, f1: 62, dur: 1.0,  peak: 0.12, dist: true, wet: 0.5,  tremF: 11, tremD: 0.5,  a: 0.05});
    sfxNoise({dur: 1.05, peak: 0.14, type: 'bandpass', f0: 520, f1: 130, Q: 0.9, wet: 0.5, a: 0.05});
  },
  bossDie(){ // long dying bellow, growl slowing as it falls
    sfxTone({type: 'sawtooth', f0: 95,  f1: 24, dur: 1.75, peak: 0.3,  dist: true, wet: 0.6, tremF: 8, tremF1: 3, tremD: 0.6, a: 0.05});
    sfxTone({type: 'sawtooth', f0: 142, f1: 40, dur: 1.5,  peak: 0.1,  dist: true, wet: 0.5, tremF: 6, tremF1: 2.5, tremD: 0.5, a: 0.05});
    sfxNoise({dur: 1.45, peak: 0.12, type: 'bandpass', f0: 430, f1: 85, Q: 1, wet: 0.55, a: 0.04});
  },
  thud(){ // multi-ton body hitting the ground
    sfxTone({type: 'sine', f0: 88, f1: 28, dur: 0.4, peak: 0.3, wet: 0.35});
    sfxNoise({dur: 0.22, peak: 0.18, type: 'lowpass', f0: 420, f1: 80, wet: 0.35});
  },
  build(){ // mechanical clunk + metallic ping
    sfxNoise({dur: 0.12, peak: 0.14, type: 'lowpass', f0: 520, f1: 140, wet: 0.15});
    sfxTone({type: 'triangle', f0: 1250, f1: 820, dur: 0.1, peak: 0.045, wet: 0.25, delay: 0.04});
  },
  upgrade(){ // ascending servo chime
    sfxTone({type: 'triangle', f0: 520, dur: 0.08, peak: 0.05, wet: 0.2});
    sfxTone({type: 'triangle', f0: 700, dur: 0.08, peak: 0.05, wet: 0.25, delay: 0.07});
    sfxTone({type: 'triangle', f0: 950, dur: 0.14, peak: 0.055, wet: 0.3, delay: 0.14});
  },
  error(){ // gentle double-buzz
    sfxTone({type: 'triangle', f0: 170, f1: 130, dur: 0.08, peak: 0.05});
    sfxTone({type: 'triangle', f0: 150, f1: 110, dur: 0.1, peak: 0.05, delay: 0.1});
  },
};

/* ---------------- game state ---------------- */
const G = {
  state: 'menu',            // menu | playing
  levelIdx: 0, level: null,
  paths: [],                // [{pts, segs, len}]
  bg: null,
  wave: 0, waveActive: false,
  cash: 0, lives: 0, maxLives: 0,
  dinos: [], towers: [], projs: [], fx: [], bolts: [], texts: [], corpses: [], decals: [],
  spawnQ: [], spawnT: 0,
  speed: 1, paused: false,
  placing: null, selected: null,
  targeting: null, strikes: [], airUsed: 0,
  celebration: null, fw: [],
  mouse: {x: 0, y: 0, on: false},
  autoTimer: -1,
  shake: 0, banner: null,
  time: 0,
  over: false,
};

/* ---------------- paths ---------------- */
function buildPaths(level){
  return level.paths.map(pts => {
    const segs = [];
    let len = 0;
    for (let i = 0; i < pts.length - 1; i++){
      const a = pts[i], b = pts[i+1];
      const L = hyp(a.x, a.y, b.x, b.y);
      segs.push({a, b, start: len, len: L, ang: Math.atan2(b.y - a.y, b.x - a.x)});
      len += L;
    }
    return {pts, segs, len};
  });
}
function samplePath(path, d){
  d = clamp(d, 0, path.len - 0.001);
  for (const s of path.segs){
    if (d <= s.start + s.len){
      const t = (d - s.start) / s.len;
      return {x: s.a.x + (s.b.x - s.a.x) * t, y: s.a.y + (s.b.y - s.a.y) * t, ang: s.ang};
    }
  }
  const s = path.segs[path.segs.length - 1];
  return {x: s.b.x, y: s.b.y, ang: s.ang};
}
function distToAnyPath(x, y){
  let best = 1e9;
  for (const p of G.paths){
    for (const s of p.segs){
      const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y;
      const t = clamp(((x - s.a.x)*dx + (y - s.a.y)*dy) / (s.len*s.len), 0, 1);
      best = Math.min(best, hyp(x, y, s.a.x + dx*t, s.a.y + dy*t));
    }
  }
  return best;
}

/* ---------------- scaling / economy ---------------- */
const hpScale    = w => (0.7 + 0.3*w) * Math.pow(1.020, w) * G.level.hpMult;
const speedScale = w => Math.min(1.4, 1 + w*0.0035);
const bountyOf   = (def, w) => Math.max(1, Math.round(def.bounty * (1 + w*0.008) * (1 + 0.06*labTier('bounty'))));
const towerUnlocked = key => (G.wave + 1) >= (TOWERS[key].unlock || 1);
/* each additional copy of the same weapon costs more — spam gets expensive */
function towerCost(key){
  const def = TOWERS[key];
  const count = G.towers.filter(t => t.key === key).length;
  const esc = key === 'mortar' ? 0.35 : 0.15;
  return Math.round(def.cost * (1 + esc * count));
}
const startCash  = () => 280 + 60*labTier('start_cash');
const startLives = () => 100 + 15*labTier('base_hp');

function towerStats(t){
  const def = TOWERS[t.key];
  const ammo = labTier('ammo_' + t.key);
  const u = t.ulv || 0;
  return {
    dmg:   def.dmg   * Math.pow(UPG.mult.dmg, u)   * (1 + 0.06*labTier('dmg_all')) * (1 + 0.08*ammo),
    rof:   def.rof   * Math.pow(UPG.mult.rof, u)   * (1 + 0.04*ammo),
    range: def.range * Math.pow(UPG.mult.range, u) * (1 + 0.04*labTier('range_all')),
    splash: def.splash ? def.splash * (1 + (t.key === 'mortar' ? 0.35 : 0.15) * u) : 0,
  };
}

/* ---------------- wave generation ---------------- */
function poolFor(wave){
  const out = [];
  for (const [key, d] of Object.entries(DINOS)){
    if (d.boss || wave < d.minWave) continue;
    let w = d.weight;
    if (d.flying) w *= G.level.flyerBias;
    // fade out trivial dinos late
    if (wave > d.minWave + 45) w *= 0.35;
    out.push({key, w});
  }
  return out;
}
function pickWeighted(pool){
  let sum = 0; for (const p of pool) sum += p.w;
  let r = Math.random() * sum;
  for (const p of pool){ r -= p.w; if (r <= 0) return p.key; }
  return pool[pool.length - 1].key;
}
function buildWave(wave){
  const q = [];
  const pool = poolFor(wave);
  const count = Math.min(60, 8 + Math.floor(wave * 0.7));
  const nGroups = clamp(1 + Math.floor(wave / 8), 2, 4);
  const species = [];
  for (let i = 0; i < nGroups; i++) species.push(pickWeighted(pool));
  let t = 1.0;
  const gap = clamp(0.85 - wave * 0.004, 0.42, 0.85);
  for (let i = 0; i < count; i++){
    const key = species[i % species.length];
    q.push({at: t, key, pathI: Math.floor(Math.random() * G.paths.length), boss: false});
    t += gap * rand(0.8, 1.2) * (DINOS[key].size < 12 ? 0.55 : 1);
  }
  const bosses = BOSS_WAVES[wave];
  if (bosses){
    t += 2.2;
    bosses.forEach((bk, i) => { q.push({at: t + i*3.2, key: bk, pathI: Math.floor(Math.random()*G.paths.length), boss: true}); });
  }
  return q;
}

/* ---------------- spawning ---------------- */
function spawnDino(key, pathI, isBoss){
  const def = DINOS[key];
  const w = G.wave;
  const hp = isBoss
    ? def.hp * (0.25 + w * 0.075) * G.level.hpMult
    : def.hp * hpScale(w);
  // bosses run oversized — larger than life, above the normal cap
  // (the D-Rex gets to be truly colossal)
  const sz = isBoss
    ? Math.min(key === 'drex' ? 94 : 80, (def.size * 1.35 + 3) * 1.45)
    : Math.min(58, def.size * 1.35 + 3); // scaled up for visibility (small dinos get the biggest boost)
  const d = {
    key, def, boss: !!isBoss,
    name: def.name, painter: def.painter, pal: def.pal, feat: def.feat, flying: !!def.flying,
    size: sz,
    stride: clamp(def.speed * 1.7 / sz, 2.4, 9.5), // step frequency scales with speed & bulk
    dirT: 1, turn: 1, pitch: 0, lastStep: 0,
    armor: def.armor, dmgToBase: def.dmg,
    hp, maxHp: hp,
    speed: def.speed * speedScale(w),
    pathI, dist: 0,
    slowT: 0, slowF: 1, burnT: 0, burnDps: 0, revealT: 0,
    cloaked: false, cloakCd: def.cloak ? 5 : -1,
    regen: def.regen || 0,
    phase: rand(0, Math.PI * 2),
    bounty: bountyOf(def, w) * (isBoss ? 1 : 1),
    dead: false, leaked: false,
  };
  G.dinos.push(d);
  if (isBoss){
    // cinematic entrance: stalk in past the gate, stop, and roar
    // (the D-Rex takes its time — longer letterbox, second roar mid-entrance)
    d.dist = 100 + rand(0, 50);
    d.entranceT = key === 'drex' ? 3.4 : 2.2;
    d.seedE = rand(0, 1);
    G.cinT = key === 'drex' ? 4.4 : 2.8;
    G.banner = {text: def.name.toUpperCase(), sub: def.epithet || '⚠ CONTAINMENT FAILURE ⚠', t: key === 'drex' ? 4.4 : 3.4};
    SFX.roar();
    G.shake = Math.max(G.shake, 12);
    const p = dinoPos(d);
    addFx('shock', p.x, p.y, d.size * 2.4);
    addFx('dust', p.x - d.size * 0.6, p.y + 4, d.size * 0.8);
    addFx('dust', p.x + d.size * 0.6, p.y + 4, d.size * 0.8);
    addFx('birds', p.x, p.y, 60);
  }
}

/* ---------------- combat ---------------- */
function targetable(d, def){
  if (d.dead || d.leaked) return false;
  if (d.flying && !def.air) return false;
  if (d.cloaked && d.revealT <= 0 && !def.reveal) return false;
  return true;
}
function pickTarget(t, st){
  const def = TOWERS[t.key];
  let best = null, bestV = -1e18;
  for (const d of G.dinos){
    if (!targetable(d, def)) continue;
    const p = samplePath(G.paths[d.pathI], d.dist);
    const dd = hyp(t.x, t.y, p.x, p.y);
    if (dd > st.range + d.size * 0.4) continue;
    if (def.minRange && dd < def.minRange) continue; // mortars can't hit close targets
    let v;
    switch (t.mode){
      case 'strong': v = d.hp; break;
      case 'last':   v = -d.dist; break;
      case 'close':  v = -hyp(t.x, t.y, p.x, p.y); break;
      default:       v = d.dist + (d.boss ? 1e6 : 0); // first (bosses prioritized)
    }
    if (v > bestV){ bestV = v; best = d; }
  }
  return best;
}
function dinoPos(d){ return samplePath(G.paths[d.pathI], d.dist); }

function damage(d, amt, pierce, src){
  if (d.dead || d.leaked) return;
  const eff = pierce ? amt : Math.max(1, amt - d.armor);
  d.hp -= eff;
  if (eff >= 70){ // only truly big hits pop a damage number
    const p = dinoPos(d);
    addText(p.x + rand(-8, 8), p.y - d.size - 4, '−' + Math.round(eff), 'rgba(255,235,200,0.95)', 12);
  }
  if (d.hp <= 0){
    d.dead = true;
    const p = dinoPos(d);
    G.cash += d.bounty;
    addText(p.x, p.y - d.size, '+$' + d.bounty, '#ffd24a');
    if (d.boss){
      // cinematic collapse: the corpse tips over, thuds, and fades
      G.corpses.push({pal: d.pal, feat: d.feat, painter: d.painter, size: d.size,
                      flying: d.flying, boss: true, pathI: d.pathI,
                      x: p.x, y: p.y, dir: Math.cos(p.ang) >= 0 ? 1 : -1,
                      phase: d.phase, t: 0, thudded: false});
      G.shake = Math.max(G.shake, 10);
      SFX.bossDie();
      addFx('ring', p.x, p.y, 24);
      addFx('blood', p.x, p.y + 3, d.size * 0.7);
      for (let i = 0; i < 5; i++) addFx('spark', p.x + rand(-d.size, d.size), p.y - rand(0, d.size), 6);
    } else {
      addFx('puff', p.x, p.y, d.size);
      addFx('blood', p.x, p.y + 2, d.size * 0.45);
      if (Math.random() < 0.3) SFX.coin();
    }
  }
}
function applyHit(d, t, st, def){
  damage(d, st.dmg, def.pierce, t);
  if (def.slow && !d.dead){
    d.slowT = Math.max(d.slowT, def.slow.t);
    d.slowF = Math.min(d.slowF === 1 || d.slowT <= 0 ? 1 : d.slowF, def.slow.f);
    d.slowF = def.slow.f;
  }
  if (def.burn && !d.dead && !d.def.burnImmune){
    d.burnT = def.burn.t;
    d.burnDps = def.burn.dps * (1 + 0.08 * labTier('ammo_flamer'));
  }
}

function fireTower(t, dt){
  const def = TOWERS[t.key];
  const st = towerStats(t);
  t.cd -= dt;
  t.flash = Math.max(0, (t.flash || 0) - dt * 3);
  t.recoil = Math.max(0, (t.recoil || 0) - dt * 6);

  if (t.key === 'sonic'){
    if (t.cd > 0) return;
    let any = false;
    for (const d of G.dinos){
      if (d.dead || d.leaked) continue;
      const p = dinoPos(d);
      if (hyp(t.x, t.y, p.x, p.y) <= st.range + d.size*0.4){ any = true; break; }
    }
    if (!any) return;
    t.cd = 1 / st.rof;
    SFX.pulse();
    addFx('sonic', t.x, t.y, st.range);
    for (const d of G.dinos){
      if (d.dead || d.leaked) continue;
      const p = dinoPos(d);
      if (hyp(t.x, t.y, p.x, p.y) <= st.range + d.size*0.4){
        d.revealT = Math.max(d.revealT, 1.6);
        damage(d, st.dmg, false, t);
      }
    }
    return;
  }

  const target = pickTarget(t, st);
  if (target){
    const p = dinoPos(target);
    t.angle = Math.atan2(p.y - t.y, p.x - t.x);
  }
  if (t.key === 'gatling') t.spin = (t.spin || 0) + dt * (target ? 26 : 2);
  if (t.cd > 0 || !target) return;
  t.cd = 1 / st.rof;
  t.flash = 0.12;
  t.recoil = 1;
  const tp = dinoPos(target);

  switch (def.proj){
    case 'dart':
      SFX.dart();
      G.projs.push({kind:'dart', x:t.x, y:t.y, target, speed:520, dmg:st.dmg, tower:t, color:'#c8f08a'});
      break;
    case 'bullet':
      SFX.shot();
      G.projs.push({kind:'bullet', x:t.x, y:t.y, target, speed:760, dmg:st.dmg, tower:t, color:'#ffe9a0'});
      break;
    case 'snipe':
      SFX.snipe();
      G.bolts.push({x1:t.x, y1:t.y, x2:tp.x, y2:tp.y, t:0.09, color:'rgba(160,210,255,0.9)', w:2});
      applyHit(target, t, st, def);
      break;
    case 'flame': {
      // cone burst: hits everything in range within the cone
      for (const d of G.dinos){
        if (!targetable(d, def)) continue;
        const p = dinoPos(d);
        if (hyp(t.x, t.y, p.x, p.y) > st.range + d.size*0.4) continue;
        const a = Math.atan2(p.y - t.y, p.x - t.x);
        let da = Math.abs(a - t.angle); if (da > Math.PI) da = Math.PI*2 - da;
        if (da <= def.cone) applyHit(d, t, st, def);
      }
      addFx('flame', t.x, t.y, st.range, t.angle);
      break;
    }
    case 'tesla': {
      SFX.zap();
      let cur = target, from = {x:t.x, y:t.y};
      const hitset = new Set();
      for (let i = 0; i <= def.chain; i++){
        if (!cur) break;
        const cp = dinoPos(cur);
        G.bolts.push({x1:from.x, y1:from.y, x2:cp.x, y2:cp.y, t:0.12, color:'rgba(120,230,255,0.95)', w:2.5, jag:true});
        applyHit(cur, t, st, def);
        hitset.add(cur);
        from = cp;
        let next = null, bd = def.chainRange;
        for (const d of G.dinos){
          if (hitset.has(d) || !targetable(d, def)) continue;
          const p = dinoPos(d);
          const dd = hyp(cp.x, cp.y, p.x, p.y);
          if (dd < bd){ bd = dd; next = d; }
        }
        cur = next;
      }
      break;
    }
    case 'missile': {
      SFX.shot();
      // each upgrade adds a rocket; extra rockets seek their own targets
      const salvo = 1 + (t.ulv || 0);
      const targets = [target];
      for (const d of G.dinos){
        if (targets.length >= salvo) break;
        if (d === target || !targetable(d, def)) continue;
        const p2 = dinoPos(d);
        if (hyp(t.x, t.y, p2.x, p2.y) <= st.range + d.size * 0.4) targets.push(d);
      }
      while (targets.length < salvo) targets.push(target);
      targets.forEach((tg, i) => {
        const a = t.angle + (i - (targets.length - 1) / 2) * 0.4;
        G.projs.push({kind:'missile', x:t.x, y:t.y, target: tg, speed:420, dmg:st.dmg, splash:st.splash, tower:t,
                      vx:Math.cos(a)*420, vy:Math.sin(a)*420, color:'#ffb0a0'});
      });
      break;
    }
    case 'cryo':
      SFX.cryo();
      G.projs.push({kind:'cryo', x:t.x, y:t.y, target, speed:460, dmg:st.dmg, splash:st.splash, slow:def.slow, tower:t, color:'#cfeeff'});
      break;
    case 'mortar': {
      SFX.thoomp();
      // lob a shell at where the target will be when it lands
      const dd = hyp(t.x, t.y, tp.x, tp.y);
      const dur = clamp(dd / 300, 0.5, 1.3);
      const lead = samplePath(G.paths[target.pathI], target.dist + target.speed * (target.slowT > 0 ? target.slowF : 1) * dur * 0.9);
      G.projs.push({kind:'mortar', x0:t.x, y0:t.y, x:t.x, y:t.y, tx:lead.x, ty:lead.y,
                    t:0, dur, dmg:st.dmg, splash:st.splash, tower:t});
      break;
    }
  }
}

function updateProjs(dt){
  for (const pr of G.projs){
    if (pr.hit) continue;
    if (pr.kind === 'mortar'){ // ballistic: flies to a fixed landing point
      pr.t += dt;
      const k = clamp(pr.t / pr.dur, 0, 1);
      pr.x = pr.x0 + (pr.tx - pr.x0) * k;
      pr.y = pr.y0 + (pr.ty - pr.y0) * k;
      pr.arc = Math.sin(k * Math.PI) * (60 + hyp(pr.x0, pr.y0, pr.tx, pr.ty) * 0.22);
      if (k >= 1){
        pr.hit = true;
        const def = TOWERS[pr.tower.key];
        SFX.boom();
        G.shake = Math.max(G.shake, 5);
        addFx('boom', pr.tx, pr.ty, pr.splash);
        addFx('dust', pr.tx, pr.ty + 4, pr.splash * 0.5);
        for (const d of G.dinos){
          if (d.dead || d.leaked || d.flying) continue;
          const p = dinoPos(d);
          if (hyp(pr.tx, pr.ty, p.x, p.y) <= pr.splash + d.size * 0.4)
            applyHit(d, pr.tower, {dmg: pr.dmg}, def);
        }
      }
      continue;
    }
    let tx, ty;
    if (pr.target && !pr.target.dead && !pr.target.leaked){
      const p = dinoPos(pr.target);
      tx = p.x; ty = p.y - pr.target.size * 0.55;
    } else if (pr.kind === 'missile'){
      tx = pr.x + pr.vx * 0.1; ty = pr.y + pr.vy * 0.1; // fly straight
    } else { pr.hit = true; continue; }

    const dx = tx - pr.x, dy = ty - pr.y;
    const dd = Math.hypot(dx, dy);
    const step = pr.speed * dt;
    if (dd <= step + 6){
      pr.hit = true;
      const def = TOWERS[pr.tower.key];
      const st = {dmg: pr.dmg, rof: 0, range: 0};
      if (pr.splash){
        SFX.boom();
        addFx(pr.kind === 'cryo' ? 'frost' : 'boom', tx, ty, pr.splash);
        if (pr.kind !== 'cryo') G.shake = Math.max(G.shake, 3);
        for (const d of G.dinos){
          if (d.dead || d.leaked) continue;
          if (d.flying && !def.air) continue;
          const p = dinoPos(d);
          if (hyp(tx, ty, p.x, p.y) <= pr.splash + d.size*0.4) applyHit(d, pr.tower, st, def);
        }
      } else if (pr.target && !pr.target.dead && !pr.target.leaked){
        applyHit(pr.target, pr.tower, st, def);
        addFx('spark', tx, ty, 6);
      }
    } else {
      if (pr.kind === 'missile'){
        // homing with inertia
        const want = Math.atan2(dy, dx);
        const cur = Math.atan2(pr.vy, pr.vx);
        let da = want - cur; while (da > Math.PI) da -= Math.PI*2; while (da < -Math.PI) da += Math.PI*2;
        const na = cur + clamp(da, -4*dt, 4*dt);
        pr.vx = Math.cos(na) * pr.speed; pr.vy = Math.sin(na) * pr.speed;
        pr.x += pr.vx * dt; pr.y += pr.vy * dt;
        if (Math.random() < 0.5) addFx('trail', pr.x, pr.y, 3);
      } else {
        pr.x += dx / dd * step; pr.y += dy / dd * step;
      }
    }
  }
  G.projs = G.projs.filter(p => !p.hit);
}

/* ---------------- fx / floating text ---------------- */
function addFx(kind, x, y, r, ang){
  // blood lives in its own decal list so heavy action can never crowd it out
  if (kind === 'blood'){
    G.decals.push({x, y, r, t: 0, dur: 1.2, seed: Math.random() * 9});
    if (G.decals.length > 40) G.decals.shift();
    return;
  }
  if (kind === 'step' && G.fx.length > 150) return; // cosmetic footsteps yield first
  if (G.fx.length > 220) return;
  G.fx.push({kind, x, y, r, ang: ang || 0, t: 0, seed: Math.random() * 9,
             dur: kind === 'sonic' ? 0.5 : kind === 'boom' ? 0.45 : kind === 'frost' ? 0.5 : kind === 'flame' ? 0.22 : kind === 'ring' ? 0.8 : kind === 'dust' ? 0.9 : kind === 'step' ? 0.45 : kind === 'shock' ? 0.9 : kind === 'birds' ? 1.4 : 0.3});
}
function addText(x, y, txt, color, size){
  if (G.texts.length > 40) return;
  G.texts.push({x, y, txt, color, size: size || 15, t: 0});
}

/* ---------------- dino update ---------------- */
function updateDinos(dt){
  for (const d of G.dinos){
    if (d.dead || d.leaked) continue;
    // statuses
    if (d.slowT > 0){ d.slowT -= dt; if (d.slowT <= 0) d.slowF = 1; }
    if (d.burnT > 0){ d.burnT -= dt; damage(d, d.burnDps * dt, true); if (d.dead) continue; }
    if (d.revealT > 0) d.revealT -= dt;
    if (d.regen > 0 && d.hp < d.maxHp) d.hp = Math.min(d.maxHp, d.hp + d.regen * d.maxHp * dt);
    // cloak cycle (Indominus)
    if (d.cloakCd >= 0){
      d.cloakCd -= dt;
      if (d.cloakCd <= 0){
        d.cloaked = !d.cloaked;
        d.cloakCd = d.cloaked ? 2.5 : 6.5;
      }
    }
    // boss entrance: hold position and roar before advancing
    if (d.entranceT > 0){
      d.entranceT -= dt;
      d.phase += dt * 1.2;
      if (d.key === 'drex' && !d.roar2 && d.entranceT <= 1.7){ // second, angrier roar
        d.roar2 = true;
        SFX.roar();
        G.shake = Math.max(G.shake, 14);
        const dp = dinoPos(d);
        addFx('shock', dp.x, dp.y, d.size * 3);
        addFx('dust', dp.x - d.size * 0.7, dp.y + 6, d.size * 0.9);
        addFx('dust', dp.x + d.size * 0.7, dp.y + 6, d.size * 0.9);
      }
      continue;
    }
    // move
    const slow = d.slowT > 0 ? d.slowF : 1;
    d.dist += d.speed * slow * dt;
    d.phase += dt * (d.flying ? 6 : d.stride) * slow;
    const path = G.paths[d.pathI];
    // facing & body pitch follow the path (smoothed, so corners read as a turn)
    const pp = samplePath(path, d.dist);
    const cosA = Math.cos(pp.ang);
    if (Math.abs(cosA) > 0.15) d.dirT = cosA > 0 ? 1 : -1;
    d.turn += clamp(d.dirT - d.turn, -dt * 7, dt * 7);
    // rotate the body fully onto the path direction (accounting for the flip)
    let pitchT = d.dirT > 0 ? pp.ang : Math.PI - pp.ang;
    while (pitchT > Math.PI) pitchT -= Math.PI * 2;
    while (pitchT < -Math.PI) pitchT += Math.PI * 2;
    d.pitch += clamp(pitchT - d.pitch, -dt * 3.5, dt * 3.5);
    // heavy footfalls: dust + a rumble from the giants
    if (!d.flying && d.size >= 26){
      const stepNow = Math.floor(d.phase / Math.PI);
      if (stepNow !== d.lastStep){
        d.lastStep = stepNow;
        addFx('step', pp.x - d.dirT * d.size * 0.15 + rand(-4, 4), pp.y + 2, d.size * 0.35);
        if (d.boss) G.shake = Math.max(G.shake, 2.4);
        else if (d.size >= 40) G.shake = Math.max(G.shake, 1.3);
      }
    }
    if (d.dist >= path.len){
      d.leaked = true;
      if (!save.settings.invincible){
        G.lives -= d.dmgToBase * (d.boss ? 1 : 1);
        G.shake = Math.max(G.shake, 4);
        G.hurtT = 0.6;
      }
      SFX.leak();
      if (G.lives <= 0 && !G.over){ G.lives = 0; defeat(); }
    }
  }
  G.dinos = G.dinos.filter(d => !d.dead && !d.leaked);
}

/* ---------------- wave flow ---------------- */
function startWave(){
  if (G.waveActive || G.over) return;
  G.wave++;
  G.waveActive = true;
  G.autoTimer = -1;
  G.spawnQ = G.pendingWave || buildWave(G.wave);
  G.waveTotal = G.spawnQ.length;
  G.pendingWave = G.wave < WAVES_PER_LEVEL ? buildWave(G.wave + 1) : null;
  updateIncoming();
  G.spawnT = 0;
  // record best
  const b = save.best[G.levelIdx] || 0;
  if (G.wave > b){ save.best[G.levelIdx] = G.wave; persist(); }
  updateHUD();
}
function endWave(){
  G.waveActive = false;
  const bonus = 40 + 3 * G.wave;
  G.cash += bonus;
  const dna = Math.round((2 + Math.floor(G.wave / 4) + (BOSS_WAVES[G.wave] ? 15 * BOSS_WAVES[G.wave].length : 0)) * (1 + G.levelIdx * 0.5));
  save.dna += dna;
  persist();
  addText(W/2, 120, `Wave ${G.wave} cleared!  +$${bonus}  +${dna} DNA`, '#9fe870');
  G.flashT = 0.45;
  SFX.fanfare();
  if (G.wave >= WAVES_PER_LEVEL){ victory(); return; }
  saveRun();
  if (save.settings.auto) G.autoTimer = 3;
  updateHUD();
}
function snapshot(){
  return {
    wave: G.wave, cash: G.cash, lives: G.lives, airUsed: G.airUsed,
    towers: G.towers.map(t => ({key: t.key, x: t.x, y: t.y, ulv: t.ulv, invested: t.invested, mode: t.mode})),
  };
}

/* persist the current run so a closed tab can pick up where it left off.
   If saved mid-wave, the resume point is the start of that wave. */
function saveRun(){
  if (G.state !== 'playing' || G.over) return;
  const s = snapshot();
  s.wave = G.waveActive ? G.wave - 1 : G.wave;   // completed waves
  s.levelIdx = G.levelIdx;
  save.run = s;
  persist();
}
function clearRun(){ save.run = null; persist(); }
function restoreSnapshot(s){
  migrateTowers(s.towers);
  G.wave = s.wave; G.cash = s.cash; G.lives = Math.max(s.lives, Math.round(startLives() * 0.5));
  G.towers = s.towers.map(t => ({key: t.key, x: t.x, y: t.y, ulv: t.ulv || 0, invested: t.invested, mode: t.mode, cd: 0, angle: 0, flash: 0}));
}

/* ---------------- level lifecycle ---------------- */
/* mode: 'fresh' | 'resume' (saved run) */
function startLevel(idx, mode){
  G.levelIdx = idx;
  G.level = LEVELS[idx];
  G.paths = buildPaths(G.level);
  const bg = renderBackground(G.level, W, H);
  G.bg = bg.cv; G.flames = bg.flames; G.exitFx = bg.exit;
  G.hurtT = 0; G.flashT = 0; G.waveTotal = 0; G.cinT = 0;
  initAmbient();
  G.dinos = []; G.projs = []; G.fx = []; G.bolts = []; G.texts = []; G.spawnQ = []; G.corpses = []; G.decals = [];
  G.selected = null; G.placing = null; G.targeting = null; G.strikes = [];
  G.celebration = null; G.fw = [];
  G.waveActive = false; G.autoTimer = -1; G.over = false; G.banner = null;
  G.speed = 1;
  if (mode === 'resume' && save.run){
    restoreSnapshot(save.run);
    G.wave = save.run.wave; G.lives = save.run.lives;
    G.airUsed = save.run.airUsed || 0;
  } else {
    G.wave = 0; G.cash = startCash(); G.towers = [];
    G.lives = startLives(); G.airUsed = 0;
  }
  G.maxLives = startLives();
  saveRun();
  G.state = 'playing';
  $('#menu').classList.add('hidden');
  $('#gameover').classList.add('hidden');
  $('#victory').classList.add('hidden');
  $('#hud').classList.remove('hidden');
  $('#shop').classList.remove('hidden');
  $('#levelTitle').textContent = G.level.name;
  buildShop();
  selectTower(null);
  G.pendingWave = G.wave < WAVES_PER_LEVEL ? buildWave(G.wave + 1) : null;
  updateIncoming();
  updateHUD();
}

/* ambient particles: fireflies at night, spores in mist, drifting leaves by day */
function initAmbient(){
  G.amb = [];
  const n = G.level.night ? 34 : G.level.mist ? 24 : 14;
  for (let i = 0; i < n; i++){
    G.amb.push({x: rand(0, W), y: rand(0, H), p: rand(0, 6.28), v: rand(5, 12)});
  }
}

/* "incoming" preview panel showing next wave composition */
function updateIncoming(){
  const el = $('#incoming');
  if (!el) return;
  if (!G.pendingWave){
    el.innerHTML = '<div class="incTitle">All waves cleared</div>';
    return;
  }
  const counts = {}, bosses = [];
  for (const s of G.pendingWave){
    if (s.boss) bosses.push(DINOS[s.key].name);
    else counts[s.key] = (counts[s.key] || 0) + 1;
  }
  let html = `<div class="incTitle">📡 Wave ${G.wave + 1} incoming</div>`;
  html += Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, n]) => {
    const d = DINOS[k];
    return `<span class="chip${d.flying ? ' fly' : ''}">${d.flying ? '🪽 ' : ''}${d.name} ×${n}</span>`;
  }).join('');
  for (const b of bosses) html += `<span class="chip boss">⚠ ${b}</span>`;
  el.innerHTML = html;
}
function victory(){
  G.over = true;
  save.run = null;
  const reward = Math.round((400 + 150 * G.levelIdx));
  save.dna += reward;
  if (G.levelIdx + 1 >= save.unlocked && save.unlocked < LEVELS.length) save.unlocked = G.levelIdx + 2 > LEVELS.length ? LEVELS.length : G.levelIdx + 2;
  save.best[G.levelIdx] = WAVES_PER_LEVEL;
  persist();
  $('#victoryText').innerHTML =
    `<b>${G.level.name}</b> is secure. All 100 waves contained.<br>` +
    `Bonus research: <b class="dna">+${reward} DNA</b>` +
    (G.levelIdx + 1 < LEVELS.length ? `<br><br>🔓 New zone unlocked: <b>${LEVELS[G.levelIdx+1].name}</b>` : '<br><br>🏆 You have secured the entire island!');
  // fireworks over the battlefield before the results screen appears
  G.celebration = {t: 0, dur: 5.4, next: 0.2};
  G.fw = [];
  G.flashT = 0.6;
  SFX.victoryTune();
}
function defeat(){
  G.over = true;
  clearRun();
  $('#defeatText').innerHTML =
    `The perimeter fell on <b>wave ${G.wave}</b> of ${G.level.name}.<br>` +
    `DNA you earned this run has been banked — spend it in the Lab, then try again.`;
  $('#gameover').classList.remove('hidden');
}
function toMenu(){
  G.state = 'menu';
  $('#hud').classList.add('hidden');
  $('#shop').classList.add('hidden');
  $('#gameover').classList.add('hidden');
  $('#victory').classList.add('hidden');
  $('#menu').classList.remove('hidden');
  buildMenu();
}

/* ---------------- towers: place / select / upgrade ---------------- */
function canPlace(x, y){
  if (x < 20 || x > W - 20 || y < 20 || y > H - 20) return false;
  if (distToAnyPath(x, y) < 42) return false;
  for (const t of G.towers) if (hyp(x, y, t.x, t.y) < 38) return false;
  return true;
}
function placeTower(key, x, y, force){
  if (!force && !towerUnlocked(key)){ SFX.error(); return; }
  const cost = force ? TOWERS[key].cost : towerCost(key);
  if (G.cash < cost || !canPlace(x, y)) { SFX.error(); return; }
  G.cash -= cost;
  G.towers.push({key, x, y, ulv: 0, cd: 0, angle: rand(0, 6.28), flash: 0, invested: cost, mode: 'first'});
  SFX.build();
  addFx('ring', x, y, 10);
  saveRun();
  updateHUD();
}
function selectTower(t){
  G.selected = t;
  const panel = $('#towerPanel');
  if (!t){ panel.classList.add('hidden'); return; }
  panel.classList.remove('hidden');
  renderTowerPanel();
}
function renderTowerPanel(){
  const t = G.selected; if (!t) return;
  const def = TOWERS[t.key];
  const st = towerStats(t);
  const maxed = t.ulv >= def.maxUp;
  $('#tpName').textContent = `${def.icon} ${def.name} — Lv ${t.ulv + 1}${maxed ? ' ★MAX' : ''}`;
  $('#tpStats').innerHTML =
    `DMG <b>${st.dmg.toFixed(0)}</b> · ROF <b>${st.rof.toFixed(2)}/s</b> · RNG <b>${Math.round(st.range)}</b>` +
    (t.key === 'missile' ? ` · <b>${1 + t.ulv}</b> rocket${t.ulv ? 's' : ''}/salvo` : '') +
    (st.splash ? ` · SPLASH <b>${Math.round(st.splash)}</b>` : '') +
    (def.air ? '' : ' · <span class="warn">cannot hit flyers</span>');
  const btn = $('#up_main');
  if (maxed){
    btn.textContent = '★ Fully upgraded';
    btn.disabled = true;
  } else {
    const cost = UPG.cost(def, t.ulv);
    const extra = t.key === 'missile' ? ` (+1 rocket)` : t.key === 'mortar' ? ' (huge blast)' : '';
    btn.textContent = `⬆ Upgrade to Lv ${t.ulv + 2}${extra} — $${cost}`;
    btn.disabled = G.cash < cost;
  }
  $('#tpMode').textContent = 'Target: ' + t.mode.toUpperCase();
  $('#tpSell').textContent = `Sell for $${Math.round(t.invested * 0.7)}`;
}
function upgrade(){
  const t = G.selected; if (!t) return;
  const def = TOWERS[t.key];
  if (t.ulv >= def.maxUp) return;
  const cost = UPG.cost(def, t.ulv);
  if (G.cash < cost){ SFX.error(); return; }
  G.cash -= cost; t.ulv++; t.invested += cost;
  SFX.upgrade();
  saveRun();
  renderTowerPanel(); updateHUD();
}
function sellSelected(){
  const t = G.selected; if (!t) return;
  G.cash += Math.round(t.invested * 0.7);
  G.towers = G.towers.filter(x => x !== t);
  selectTower(null);
  SFX.coin(); saveRun(); updateHUD();
}

/* ---------------- air strike ---------------- */
const airUnlocked = () => (G.wave + 1) >= AIRSTRIKE.unlock;
const airCost = () => AIRSTRIKE.costs[Math.min(G.airUsed, AIRSTRIKE.costs.length - 1)];
function updateAirCard(){
  const el = $('#airCard');
  if (!el) return;
  const spent = G.airUsed >= AIRSTRIKE.maxUses;
  const locked = !airUnlocked();
  el.classList.toggle('locked', locked || spent);
  el.classList.toggle('cant', !locked && !spent && G.cash < airCost());
  el.classList.toggle('sel', G.targeting === 'strike');
  el.querySelector('.cost').textContent =
    locked ? `🔒 Wave ${AIRSTRIKE.unlock}` :
    spent ? 'DEPLETED' :
    `$${fmt(airCost())} · ${AIRSTRIKE.maxUses - G.airUsed} left`;
}
function launchStrike(x, y){
  const cost = airCost();
  if (!airUnlocked() || G.airUsed >= AIRSTRIKE.maxUses || G.cash < cost){ SFX.error(); return; }
  G.cash -= cost;
  G.airUsed++;
  G.targeting = null;
  // choreography: radio alert → two F-22s sweep in → each releases a
  // cluster canister over the mark → staggered carpet of bomblets
  const startX = -260, lead = 0.45;
  const jets = [
    {dx: 0,    oy: -30},
    {dx: -130, oy: 30},
  ];
  const canisters = [], events = [];
  let end = 0;
  for (const j of jets){
    j.sx = startX + j.dx;
    j.drop = lead + (x - j.sx) / AIRSTRIKE.jetSpeed;   // moment this jet is over the mark
    const land = j.drop + 0.6;
    canisters.push({oy: j.oy, t0: j.drop, dur: 0.6});
    for (let i = 0; i < AIRSTRIKE.bomblets; i++){
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * AIRSTRIKE.scatter;
      const t = land + Math.random() * 0.9;
      events.push({t, x: x + Math.cos(a) * r, y: y + j.oy * 0.3 + Math.sin(a) * r * 0.75, done: false});
      end = Math.max(end, t);
    }
  }
  G.strikes.push({x, y, t: 0, lead, jets, canisters, events, end: end + 1.2});
  SFX.alert();
  SFX.jet();
  saveRun();
  updateHUD();
}
function updateStrikes(dt){
  for (const s of G.strikes){
    s.t += dt;
    for (const e of s.events){
      if (!e.done && s.t >= e.t){
        e.done = true;
        SFX.boom();
        G.shake = Math.max(G.shake, 6);
        addFx('boom', e.x, e.y, AIRSTRIKE.splash * rand(0.8, 1.2));
        addFx('shock', e.x, e.y, AIRSTRIKE.splash * 1.3);
        addFx('dust', e.x, e.y + 4, AIRSTRIKE.splash * 0.55);
        for (const d of G.dinos){ // hits everything, even flyers — it's an airburst
          if (d.dead || d.leaked) continue;
          const p = dinoPos(d);
          if (hyp(e.x, e.y, p.x, p.y) <= AIRSTRIKE.splash + d.size * 0.4) damage(d, AIRSTRIKE.dmg, true);
        }
      }
    }
  }
  G.strikes = G.strikes.filter(s => s.t < s.end);
}

/* ---------------- HUD / UI ---------------- */
function updateHUD(){
  $('#hCash').textContent = '$' + fmt(G.cash);
  $('#hDna').textContent = fmt(save.dna) + ' DNA';
  $('#hWave').textContent = `Wave ${G.wave}/${WAVES_PER_LEVEL}`;
  $('#hLives').textContent = '❤ ' + Math.max(0, Math.ceil(G.lives));
  $('#hLives').classList.toggle('low', G.lives <= G.maxLives * 0.25);
  $('#invBadge').classList.toggle('hidden', !save.settings.invincible);
  $('#btnWave').disabled = G.waveActive || G.over;
  $('#btnWave').textContent = G.waveActive ? '⚔ Wave in progress' : (G.autoTimer > 0 ? `▶ Next in ${Math.ceil(G.autoTimer)}…` : '▶ Start Wave ' + (G.wave + 1));
  $$('#speedBtns button').forEach(b => b.classList.toggle('on', +b.dataset.s === G.speed && !G.paused));
  $('#btnPause').classList.toggle('on', G.paused);
  $('#btnMute').textContent = save.settings.mute ? '🔇' : '🔊';
  $('#btnMute').classList.toggle('on', save.settings.mute);
  // shop affordability + wave-gated unlocks + escalating same-type prices
  $$('.shopCard').forEach(el => {
    const def = TOWERS[el.dataset.key];
    const locked = !towerUnlocked(el.dataset.key);
    const cost = towerCost(el.dataset.key);
    el.classList.toggle('locked', locked);
    el.classList.toggle('cant', !locked && G.cash < cost);
    el.classList.toggle('sel', G.placing === el.dataset.key);
    const costEl = el.querySelector('.cost');
    const label = locked ? `🔒 Wave ${def.unlock}` : '$' + cost;
    if (costEl.textContent !== label) costEl.textContent = label;
  });
  updateAirCard();
  // keep the upgrade button in sync with cash while a tower is selected
  if (G.selected) renderTowerPanel();
}
function buildShop(){
  const el = $('#shopCards');
  el.innerHTML = '';
  for (const [key, def] of Object.entries(TOWERS)){
    const card = document.createElement('div');
    card.className = 'shopCard';
    card.dataset.key = key;
    card.style.borderTop = `3px solid ${def.color}`;
    card.innerHTML = `<div class="ico">${def.icon}</div><div class="nm">${def.name}</div><div class="cost">$${def.cost}</div>`;
    card.title = def.desc + (def.air ? '' : '  (Cannot hit flying dinosaurs.)');
    card.onclick = () => {
      if (!towerUnlocked(key)){ SFX.error(); return; }
      G.placing = (G.placing === key) ? null : key;
      G.pendingTap = null; G.targeting = null;
      selectTower(null);
      updateHUD();
    };
    el.appendChild(card);
  }
}
function buildMenu(){
  $('#verChip').innerHTML = `v${VERSION} · 📜 what's new`;
  $('#menuDna').innerHTML = `🧬 <b>${fmt(save.dna)} DNA</b> banked &nbsp;·&nbsp; spend it in the Research Lab ▸`;
  // pulse the Lab button whenever an upgrade is affordable
  const canBuy = LAB.some(e => labTier(e.key) < e.max && save.dna >= labCost(e, labTier(e.key)));
  $('#btnLab').classList.toggle('attention', canBuy);
  $('#btnLab').innerHTML = canBuy ? '🧬 Research Lab — upgrades available!' : '🧬 Research Lab';
  const el = $('#levelCards');
  el.innerHTML = '';
  if (save.run){
    const r = save.run, lv = LEVELS[r.levelIdx];
    const card = document.createElement('div');
    card.className = 'levelCard resume';
    card.innerHTML =
      `<div class="lvNum">▶ Continue run</div>` +
      `<div class="lvName">${lv.name}</div>` +
      `<div class="lvSub">Wave ${r.wave}/100 cleared · $${fmt(r.cash)} · ${r.towers.length} weapons placed</div>` +
      `<div class="lvBest">Click to pick up where you left off</div>`;
    card.onclick = () => startLevel(r.levelIdx, 'resume');
    el.appendChild(card);
  }
  LEVELS.forEach((lv, i) => {
    const locked = i >= save.unlocked;
    const best = save.best[i] || 0;
    const card = document.createElement('div');
    card.className = 'levelCard' + (locked ? ' locked' : '');
    card.innerHTML =
      `<div class="lvNum">${locked ? '🔒' : '📍'} Zone ${i+1}</div>` +
      `<div class="lvName">${lv.name}</div>` +
      `<div class="lvSub">${lv.sub}</div>` +
      `<div class="lvBest">${locked ? 'Beat the previous zone to unlock' : best >= WAVES_PER_LEVEL ? '✅ SECURED — 100/100' : best > 0 ? 'Best: wave ' + best + '/100' : 'Not attempted'}</div>`;
    if (!locked) card.onclick = () => {
      if (save.run && save.run.wave >= 1 &&
          !confirm(`You have a saved run in ${LEVELS[save.run.levelIdx].name} at wave ${save.run.wave}. Starting a new run will discard it. Continue?`)) return;
      startLevel(i, 'fresh');
    };
    el.appendChild(card);
  });
}
function buildLab(){
  $('#labDna').textContent = fmt(save.dna) + ' DNA';
  const el = $('#labList');
  el.innerHTML = '';
  for (const entry of LAB){
    const tier = labTier(entry.key);
    const maxed = tier >= entry.max;
    const cost = labCost(entry, tier);
    const row = document.createElement('div');
    row.className = 'labRow';
    row.innerHTML =
      `<div class="labIco">${entry.icon}</div>` +
      `<div class="labInfo"><b>${entry.name}</b> <span class="tier">${'●'.repeat(tier)}${'○'.repeat(entry.max - tier)}</span><br><small>${entry.desc}</small></div>` +
      `<button class="labBuy" ${maxed || save.dna < cost ? 'disabled' : ''}>${maxed ? 'MAX' : cost + ' DNA'}</button>`;
    if (!maxed){
      row.querySelector('button').onclick = () => {
        if (save.dna < cost) return;
        save.dna -= cost;
        save.lab[entry.key] = tier + 1;
        persist(); SFX.upgrade(); buildLab();
        $('#menuDna').textContent = fmt(save.dna) + ' DNA';
      };
    }
    el.appendChild(row);
  }
}
/* ---------------- tips / field manual ---------------- */
const TIPS = [
  '<b>Hotkeys:</b> 1–9 select weapons, <b>Space</b> starts a wave or pauses, <b>M</b> mutes, <b>Esc</b> cancels. Hold <b>Shift</b> while building to place several.',
  '<b>Upgrades:</b> click a placed weapon to upgrade it (2–3 levels max — each level is a big jump in damage, fire rate, and range, and the hardware visibly grows). Upgrades cost more than the weapon itself, and each level costs more than the last.',
  '<b>The armory grows with you:</b> heavier weapons unlock as you survive deeper waves — the shop card shows the unlock wave on locked gear.',
  '<b>Duplicates cost extra:</b> every additional copy of the same weapon is pricier than the last (mortars especially). Diversify your arsenal.',
  '<b>✈️ Air Strike</b> (from wave 50): jets carpet-bomb wherever you click — huge armor-piercing damage that even hits flyers. Max two calls per run, and the second costs more. Save them for boss waves.',
  '<b>Targeting:</b> the selected weapon\'s "Target" button cycles FIRST / LAST / STRONG / CLOSE. Snipers on STRONG melt tanks; slows on FIRST hold the line.',
  '<b>Flyers</b> (Pteranodons & friends) can only be hit by air-capable weapons — Flame Throwers and Mortars can\'t touch them.',
  '<b>Armor</b> (Ankylosaurus, Triceratops) shrugs off weak hits. 🎯 Snipers pierce armor completely.',
  '<b>The Indominus Rex camouflages.</b> Only a 📡 Sonic Emitter reveals it — bring one to wave 50.',
  '<b>💣 Mortars</b> have a minimum range: nothing within 90px can be hit. Place them behind your front line and cover their blind spot.',
  '<b>🚀 Missile Batteries</b> gain a rocket per upgrade level, and extra rockets pick their own targets.',
  '<b>Selling</b> refunds 70% of everything invested — repositioning late is fine.',
  '<b>DNA is never lost.</b> Every cleared wave banks DNA even if the run fails. Spend it in the 🧬 Research Lab for permanent upgrades, then try again stronger.',
  '<b>Your run auto-saves</b> between waves — close the tab and the map shows a "Continue run" card. Back up progress with Settings → Copy save code.',
  '<b>Practice mode:</b> Settings → 🛡 Invincibility lets you experiment with layouts, and 2×/4× speed keeps long waves moving.',
];
function buildTips(){
  const el = $('#tipsList');
  let html = '<h3 class="tipsH">Weapons</h3>';
  for (const def of Object.values(TOWERS)){
    html += `<div class="labRow"><div class="labIco">${def.icon}</div><div class="labInfo">` +
            `<b>${def.name}</b> — $${def.cost} · up to Lv ${def.maxUp + 1}` +
            (def.unlock > 1 ? ` · unlocks wave ${def.unlock}` : '') +
            (def.air ? '' : ' · <span class="warn">ground only</span>') +
            `<br><small>${def.desc}</small></div></div>`;
  }
  html += '<h3 class="tipsH">Field notes</h3>' + TIPS.map(t => `<div class="tipRow">${t}</div>`).join('');
  el.innerHTML = html;
}
function buildChangelog(){
  $('#clogList').innerHTML = CHANGELOG.map(c =>
    `<div class="clogVer"><b>v${c.v}</b> <small>· ${c.date}</small></div>` +
    `<ul class="clogItems">${c.items.map(i => `<li>${i}</li>`).join('')}</ul>`
  ).join('');
}

function syncSettings(){
  $('#optInv').checked = save.settings.invincible;
  $('#optMute').checked = save.settings.mute;
  $('#optAuto').checked = save.settings.auto;
  $('#optMusic').checked = save.settings.music;
}

/* ---------------- main loop ---------------- */
const cv = $('#game');
const ctx = cv.getContext('2d');
let lastT = performance.now();
let hudTick = 0;

function frame(now){
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  if (G.state !== 'playing') return;
  try {
    if (!G.paused && !G.over){
      for (let i = 0; i < G.speed; i++) step(dt);
    }
    render(dt);
  } catch (e) {
    const el = $('#errbox');
    el.classList.remove('hidden');
    el.textContent = 'Error: ' + e.message + ' @ ' + (e.stack || '').split('\n')[1];
  }
  hudTick -= dt;
  if (hudTick <= 0){ hudTick = 0.2; updateHUD(); }
}

function step(dt){
  // spawn queue
  if (G.waveActive){
    G.spawnT += dt;
    while (G.spawnQ.length && G.spawnQ[0].at <= G.spawnT){
      const s = G.spawnQ.shift();
      spawnDino(s.key, s.pathI, s.boss);
    }
    if (!G.spawnQ.length && G.dinos.length === 0) endWave();
  }
  if (G.autoTimer > 0){
    G.autoTimer -= dt;
    if (G.autoTimer <= 0) startWave();
  }
  for (const t of G.towers) fireTower(t, dt);
  updateDinos(dt);
  updateProjs(dt);
  updateStrikes(dt);
  // boss corpses: fall, hit the ground, fade out
  for (const c of G.corpses){
    c.t += dt;
    if (!c.thudded && c.t >= 0.55){
      c.thudded = true;
      SFX.thud();
      G.shake = Math.max(G.shake, 7);
      addFx('dust', c.x + c.dir * c.size * 0.8, c.y, c.size);
      addFx('dust', c.x + c.dir * c.size * 1.4, c.y + 4, c.size * 0.7);
    }
  }
  G.corpses = G.corpses.filter(c => c.t < 2.4);
  for (const f of G.fx) f.t += dt;
  G.fx = G.fx.filter(f => f.t < f.dur);
  for (const f of G.decals) f.t += dt;
  G.decals = G.decals.filter(f => f.t < f.dur);
  for (const b of G.bolts) b.t -= dt;
  G.bolts = G.bolts.filter(b => b.t > 0);
  for (const tx of G.texts) tx.t += dt;
  G.texts = G.texts.filter(tx => tx.t < 1.4);
  if (G.banner){ G.banner.t -= dt; if (G.banner.t <= 0) G.banner = null; }
  G.shake = Math.max(0, G.shake - dt * 18);
}

function render(dt){
  G.time += dt;
  ctx.save();
  if (G.shake > 0) ctx.translate(rand(-G.shake, G.shake), rand(-G.shake, G.shake));
  ctx.drawImage(G.bg, 0, 0);

  // range ring of the selected tower (under everything)
  if (G.selected){
    const st = towerStats(G.selected);
    ctx.strokeStyle = 'rgba(255,220,120,0.55)'; ctx.setLineDash([8, 7]); ctx.lineWidth = 1.6;
    ctx.lineDashOffset = -G.time * 26;
    ctx.beginPath(); ctx.arc(G.selected.x, G.selected.y, st.range, 0, Math.PI*2); ctx.stroke();
    ctx.setLineDash([]); ctx.lineDashOffset = 0;
  }

  // blood splatter decals (ground layer, under corpses and dinos)
  for (const f of G.decals){
    const k = f.t / f.dur;
    const a = 1 - k;
    const grow = 0.6 + Math.min(1, k * 4) * 0.4; // splash out fast, then just fade
    ctx.fillStyle = `rgba(118,14,10,${0.5 * a})`;
    ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * grow, f.r * 0.55 * grow, f.seed, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = `rgba(140,18,12,${0.45 * a})`;
    for (let i = 0; i < 5; i++){
      const aa = f.seed + i * 2.4;
      const dd = f.r * (0.7 + ((i * 2.7 + f.seed) % 1.3)) * grow;
      ctx.beginPath();
      ctx.arc(f.x + Math.cos(aa) * dd, f.y + Math.sin(aa) * dd * 0.55, f.r * 0.13 * (1 + (i % 3) * 0.4), 0, Math.PI*2);
      ctx.fill();
    }
  }

  // boss corpses tipping over (under the living)
  for (const c of G.corpses){
    const k = Math.min(1, c.t / 0.55);
    const ease = 1 - Math.pow(1 - k, 3);            // accelerating fall, abrupt stop
    const fade = clamp((2.4 - c.t) / 0.7, 0, 1);
    ctx.save();
    ctx.globalAlpha = 0.32 * fade;
    ctx.fillStyle = '#000';                          // spreading shadow
    ctx.beginPath(); ctx.ellipse(c.x + c.dir*ease*c.size*0.5, c.y + 2, c.size * (0.85 + ease*0.5), c.size * 0.22, 0, 0, Math.PI*2); ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(c.x, c.y);
    if (c.dir < 0) ctx.scale(-1, 1);
    ctx.rotate(ease * 1.35);                         // tip over nose-first
    ctx.scale(c.size, c.size);
    PAINTERS[c.painter](ctx, c, c.phase);
    ctx.restore();
  }

  // ground entities are y-sorted together (towers AND dinos) so a big
  // dino walking below a turret correctly passes in front of it
  const ground = [], air = [];
  for (const d of G.dinos) (d.flying ? air : ground).push(d);

  const drawOne = d => {
    const p = dinoPos(d);
    const alpha = d.cloaked && d.revealT <= 0 ? 0.22 : 1;
    // rearing back during the entrance roar
    const pitch = d.pitch - (d.entranceT > 0 ? Math.min(0.22, (2.2 - d.entranceT) * 0.6) : 0);
    drawDino(ctx, d, p.x, p.y, d.turn, d.phase, alpha, pitch);
    // status tints
    if (d.burnT > 0){
      ctx.fillStyle = 'rgba(255,120,20,0.35)';
      ctx.beginPath(); ctx.arc(p.x, p.y - d.size*0.7, d.size*0.5, 0, Math.PI*2); ctx.fill();
    }
    if (d.slowT > 0){
      ctx.fillStyle = 'rgba(140,220,255,0.3)';
      ctx.beginPath(); ctx.arc(p.x, p.y - d.size*0.7, d.size*0.55, 0, Math.PI*2); ctx.fill();
    }
    // health bar
    if (d.hp < d.maxHp){
      const w = Math.max(22, d.size * 1.6), y0 = p.y - d.size * (d.flying ? 2.1 : 1.6) - 6;
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(p.x - w/2, y0, w, 4.5);
      ctx.fillStyle = d.boss ? '#ff5a5a' : '#7ae05a';
      ctx.fillRect(p.x - w/2, y0, w * clamp(d.hp / d.maxHp, 0, 1), 4.5);
    }
    if (d.boss){
      ctx.strokeStyle = 'rgba(255,80,60,' + (0.4 + 0.3*Math.sin(d.phase)) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, d.size * 1.1, 0, Math.PI*2); ctx.stroke();
      // embers drifting off the apex predator (the D-Rex smolders harder)
      const emberN = d.key === 'drex' ? 9 : 4;
      for (let i = 0; i < emberN; i++){
        const cyc = (G.time * 0.45 + i * 0.29 + (d.seedE || 0)) % 1;
        const ex = p.x + Math.sin(i * 2.1 + G.time * 0.8) * d.size * 0.55;
        const ey = p.y - d.size * 0.4 - cyc * d.size * 1.15;
        ctx.fillStyle = `rgba(255,${110 + i * 26},30,${0.4 * (1 - cyc)})`;
        ctx.beginPath(); ctx.arc(ex, ey, 1.5 + (1 - cyc) * 1.3, 0, Math.PI*2); ctx.fill();
      }
    }
  };
  const depth = [];
  for (const t of G.towers) depth.push({y: t.y + 12, t});
  for (const d of ground) depth.push({y: dinoPos(d).y, d});
  depth.sort((a, b) => a.y - b.y);
  for (const it of depth){
    if (it.t){
      const t = it.t;
      drawTowerBase(ctx, t.x, t.y, t.key, t === G.selected, t.ulv || 0);
      drawTowerTurret(ctx, t, t.flash || 0, G.time);
      if (t.ulv > 0){ // upgrade pips
        ctx.fillStyle = '#ffd24a';
        for (let i = 0; i < t.ulv; i++){
          ctx.beginPath(); ctx.arc(t.x - (t.ulv - 1) * 3.5 + i * 7, t.y - 27, 2.2, 0, Math.PI*2); ctx.fill();
        }
      }
    } else {
      drawOne(it.d);
    }
  }

  // projectiles
  for (const pr of G.projs){
    ctx.fillStyle = pr.color;
    if (pr.kind === 'mortar'){
      // ground shadow + arcing shell
      const k = clamp(pr.t / pr.dur, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(pr.x, pr.y, 5 - k * 2, 2.5, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#3a3630';
      ctx.beginPath(); ctx.arc(pr.x, pr.y - (pr.arc || 0), 4.5, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#e0b64f';
      ctx.beginPath(); ctx.arc(pr.x - 1, pr.y - (pr.arc || 0) - 1.5, 1.5, 0, Math.PI*2); ctx.fill();
      if (Math.random() < 0.4) addFx('trail', pr.x, pr.y - (pr.arc || 0) + 4, 2);
    } else if (pr.kind === 'missile'){
      ctx.save(); ctx.translate(pr.x, pr.y); ctx.rotate(Math.atan2(pr.vy, pr.vx));
      ctx.fillRect(-6, -2.5, 12, 5);
      ctx.fillStyle = '#ffd24a'; ctx.fillRect(-9, -1.5, 4, 3);
      ctx.restore();
    } else {
      ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.kind === 'dart' ? 3 : 2.5, 0, Math.PI*2); ctx.fill();
    }
  }
  // bolts (tesla / sniper tracer)
  for (const b of G.bolts){
    ctx.strokeStyle = b.color; ctx.lineWidth = b.w;
    ctx.beginPath();
    if (b.jag){
      const n = 6;
      ctx.moveTo(b.x1, b.y1);
      for (let i = 1; i < n; i++){
        const t = i/n;
        ctx.lineTo(b.x1 + (b.x2-b.x1)*t + rand(-7, 7), b.y1 + (b.y2-b.y1)*t + rand(-7, 7));
      }
      ctx.lineTo(b.x2, b.y2);
    } else { ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); }
    ctx.stroke();
  }
  // fx
  for (const f of G.fx){
    const k = f.t / f.dur;
    switch (f.kind){
      case 'shock': { // boss-entrance shockwave
        ctx.lineWidth = 3 * (1 - k);
        ctx.strokeStyle = `rgba(255,90,50,${0.6 * (1 - k)})`;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * k, 0, Math.PI*2); ctx.stroke();
        ctx.strokeStyle = `rgba(255,235,200,${0.5 * (1 - k)})`;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * k * 0.7, 0, Math.PI*2); ctx.stroke();
        break;
      }
      case 'birds': { // startled birds scattering from the canopy
        ctx.strokeStyle = `rgba(20,24,16,${0.8 * (1 - k)})`;
        ctx.lineWidth = 1.8; ctx.lineCap = 'round';
        for (let i = 0; i < 6; i++){
          const aa = -Math.PI * (0.25 + 0.5 * ((f.seed + i * 1.7) % 1));
          const bx = f.x + Math.cos(aa) * (30 + k * 260) * (i % 2 ? 1 : -1);
          const by = f.y - 30 - k * 150 - (i % 3) * 12;
          const flap = Math.sin(k * 26 + i * 2) * 4;
          ctx.beginPath();
          ctx.moveTo(bx - 5, by - flap); ctx.lineTo(bx, by); ctx.lineTo(bx + 5, by - flap);
          ctx.stroke();
        }
        break;
      }
      case 'boom':
        ctx.fillStyle = `rgba(255,${160 - k*120|0},40,${0.55*(1-k)})`;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.4 + k*0.8), 0, Math.PI*2); ctx.fill();
        break;
      case 'frost':
        ctx.fillStyle = `rgba(170,225,255,${0.5*(1-k)})`;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.4 + k*0.8), 0, Math.PI*2); ctx.fill();
        break;
      case 'sonic':
        ctx.strokeStyle = `rgba(214,163,255,${0.7*(1-k)})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * k, 0, Math.PI*2); ctx.stroke();
        break;
      case 'flame': {
        ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.ang);
        const g = ctx.createLinearGradient(0, 0, f.r, 0);
        g.addColorStop(0, `rgba(255,220,90,${0.5*(1-k)})`);
        g.addColorStop(1, `rgba(255,80,20,0)`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(10, 0);
        ctx.arc(0, 0, f.r, -0.55, 0.55);
        ctx.closePath(); ctx.fill();
        ctx.restore();
        break;
      }
      case 'puff':
        ctx.fillStyle = `rgba(200,60,40,${0.4*(1-k)})`;
        ctx.beginPath(); ctx.arc(f.x, f.y - f.r*0.5, f.r * (0.5 + k*0.7), 0, Math.PI*2); ctx.fill();
        break;
      case 'spark':
        ctx.fillStyle = `rgba(255,240,160,${0.8*(1-k)})`;
        ctx.beginPath(); ctx.arc(f.x, f.y, 3 + k*4, 0, Math.PI*2); ctx.fill();
        break;
      case 'ring':
        ctx.strokeStyle = `rgba(255,210,80,${0.7*(1-k)})`; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r + k*36, 0, Math.PI*2); ctx.stroke();
        break;
      case 'trail':
        ctx.fillStyle = `rgba(200,200,200,${0.35*(1-k)})`;
        ctx.beginPath(); ctx.arc(f.x, f.y, 2 + k*3, 0, Math.PI*2); ctx.fill();
        break;
      case 'step': // small footfall puff
        ctx.fillStyle = `rgba(150,138,102,${0.22*(1-k)})`;
        ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * (0.35 + k*0.75), f.r * (0.2 + k*0.4), 0, 0, Math.PI*2); ctx.fill();
        break;
      case 'dust': // impact dust rolling outward
        ctx.fillStyle = `rgba(168,150,112,${0.4*(1-k)})`;
        for (let i = -1; i <= 1; i++){
          ctx.beginPath();
          ctx.arc(f.x + i * f.r * (0.35 + k*0.65), f.y - k*f.r*0.35 - Math.abs(i)*2,
                  f.r * (0.28 + k*0.55) * (1 - Math.abs(i)*0.25), 0, Math.PI*2);
          ctx.fill();
        }
        break;
    }
  }

  // animated set pieces: gate torches + checkpoint beacon
  for (let i = 0; i < G.flames.length; i++) drawTorchFlame(ctx, G.flames[i].x, G.flames[i].y, G.time + i * 1.7);
  if (G.exitFx) drawExitBeacon(ctx, G.exitFx, G.time, !!G.level.night);

  // flyers on top
  air.forEach(drawOne);

  // air strike: inbound reticle → F-22 flyby → falling cluster canisters
  for (const s of G.strikes){
    // pulsing mark on the target until the first canister lands
    if (s.t < s.jets[0].drop + 0.6){
      const pl = (Math.sin(G.time * 9) + 1) / 2;
      ctx.strokeStyle = `rgba(255,70,45,${0.5 + 0.4 * pl})`;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([10, 8]); ctx.lineDashOffset = -G.time * 60;
      ctx.beginPath(); ctx.arc(s.x, s.y, AIRSTRIKE.scatter + 20, 0, Math.PI*2); ctx.stroke();
      ctx.setLineDash([]); ctx.lineDashOffset = 0;
      ctx.beginPath(); ctx.moveTo(s.x - 14, s.y); ctx.lineTo(s.x + 14, s.y);
      ctx.moveTo(s.x, s.y - 14); ctx.lineTo(s.x, s.y + 14); ctx.stroke();
    }
    for (const j of s.jets){
      const jx = j.sx + Math.max(0, s.t - s.lead) * AIRSTRIKE.jetSpeed;
      if (jx < -80 || jx > W + 120) continue;
      const jy = s.y + j.oy;
      // wingtip vapor trails
      for (const wy of [-20, 20]){
        const ct = ctx.createLinearGradient(jx - 200, 0, jx - 12, 0);
        ct.addColorStop(0, 'rgba(255,255,255,0)'); ct.addColorStop(1, 'rgba(255,255,255,0.3)');
        ctx.strokeStyle = ct; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(jx - 200, jy + wy); ctx.lineTo(jx - 12, jy + wy); ctx.stroke();
      }
      drawF22(ctx, jx, jy, 1.7, G.time);
    }
    // cluster canisters falling away toward the ground (top-down: they shrink)
    for (const c of s.canisters){
      const k = (s.t - c.t0) / c.dur;
      if (k < 0 || k > 1) continue;
      const cx = s.x + 26 * (1 - k), cy = s.y + c.oy * (1 - k * 0.7);
      const sc = 1.25 - k * 0.55;
      ctx.fillStyle = `rgba(0,0,0,${0.12 + 0.22 * k})`; // shadow converging
      ctx.beginPath(); ctx.ellipse(s.x, s.y + c.oy * 0.3, 10 * (1.4 - k * 0.5), 5, 0, 0, Math.PI*2); ctx.fill();
      ctx.save();
      ctx.translate(cx, cy); ctx.scale(sc, sc); ctx.rotate(k * 2.2);
      ctx.fillStyle = '#3a4034';
      ctx.beginPath(); ctx.ellipse(0, 0, 9, 3.6, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#e0b64f'; ctx.fillRect(-2, -3.6, 4, 7.2); // band
      ctx.fillStyle = '#262b22'; // fins
      ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(-13, -4); ctx.lineTo(-13, 4); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  // placing ghost
  if (G.placing && G.mouse.on){
    const def = TOWERS[G.placing];
    const ok = canPlace(G.mouse.x, G.mouse.y) && G.cash >= towerCost(G.placing);
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = ok ? 'rgba(140,240,140,0.6)' : 'rgba(255,90,90,0.7)';
    ctx.fillStyle = ok ? 'rgba(140,240,140,0.12)' : 'rgba(255,90,90,0.12)';
    const rng = def.range * (1 + 0.04*labTier('range_all'));
    ctx.beginPath(); ctx.arc(G.mouse.x, G.mouse.y, rng, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    drawTowerBase(ctx, G.mouse.x, G.mouse.y, G.placing, false, 0);
    if (G.pendingTap){
      ctx.font = 'bold 13px Verdana, sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillText(ok ? 'TAP AGAIN TO BUILD' : 'BLOCKED — TAP ELSEWHERE', G.mouse.x + 1, G.mouse.y - 33);
      ctx.fillStyle = ok ? '#9fe870' : '#ff8a7a';
      ctx.fillText(ok ? 'TAP AGAIN TO BUILD' : 'BLOCKED — TAP ELSEWHERE', G.mouse.x, G.mouse.y - 34);
    }
    ctx.globalAlpha = 1;
  }

  // air-strike targeting reticle
  if (G.targeting === 'strike' && G.mouse.on){
    const canCall = G.cash >= airCost();
    ctx.strokeStyle = canCall ? 'rgba(255,80,50,0.75)' : 'rgba(150,150,150,0.6)';
    ctx.lineWidth = 2; ctx.setLineDash([8, 6]); ctx.lineDashOffset = -G.time * 30;
    ctx.beginPath(); ctx.arc(G.mouse.x, G.mouse.y, AIRSTRIKE.scatter + AIRSTRIKE.splash * 0.5, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.arc(G.mouse.x, G.mouse.y, AIRSTRIKE.scatter * 0.45, 0, Math.PI*2); ctx.stroke();
    ctx.setLineDash([]); ctx.lineDashOffset = 0;
    ctx.beginPath(); ctx.moveTo(G.mouse.x - 16, G.mouse.y); ctx.lineTo(G.mouse.x + 16, G.mouse.y);
    ctx.moveTo(G.mouse.x, G.mouse.y - 16); ctx.lineTo(G.mouse.x, G.mouse.y + 16); ctx.stroke();
    ctx.font = 'bold 13px Verdana, sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillText(canCall ? '✈ CLICK TO CALL THE STRIKE' : 'NOT ENOUGH CASH', G.mouse.x + 1, G.mouse.y - 139);
    ctx.fillStyle = canCall ? '#ff9a7a' : '#c9c9c9';
    ctx.fillText(canCall ? '✈ CLICK TO CALL THE STRIKE' : 'NOT ENOUGH CASH', G.mouse.x, G.mouse.y - 140);
  }

  // floating texts
  ctx.textAlign = 'center';
  for (const tx of G.texts){
    ctx.font = `bold ${tx.size}px Verdana, sans-serif`;
    ctx.globalAlpha = 1 - tx.t / 1.4;
    ctx.fillStyle = '#000'; ctx.fillText(tx.txt, tx.x + 1, tx.y - tx.t * 26 + 1);
    ctx.fillStyle = tx.color; ctx.fillText(tx.txt, tx.x, tx.y - tx.t * 26);
  }
  ctx.globalAlpha = 1;

  // night overlay + tower lights
  if (G.level.night){
    ctx.fillStyle = 'rgba(10,14,40,0.42)';
    ctx.fillRect(-20, -20, W + 40, H + 40);
    ctx.globalCompositeOperation = 'lighter';
    for (const t of G.towers){
      const g = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, 90);
      g.addColorStop(0, 'rgba(255,230,150,0.16)'); g.addColorStop(1, 'rgba(255,230,150,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(t.x, t.y, 90, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  if (G.level.mist){
    ctx.fillStyle = 'rgba(180,200,190,0.07)';
    ctx.fillRect(-20, -20, W + 40, H + 40);
  }

  // ambient particles (fireflies / spores / leaves) — above the light grading
  for (const a of G.amb){
    a.p += dt;
    a.x += Math.sin(a.p * 0.7) * 0.4 - a.v * dt * (G.level.night ? 0.35 : 0.9);
    a.y += Math.cos(a.p * 0.5) * 0.3 + (G.level.night ? 0 : a.v * dt * 0.35);
    if (a.x < -12) a.x = W + 10; if (a.x > W + 12) a.x = -10;
    if (a.y > H + 12) a.y = -10; if (a.y < -12) a.y = H + 10;
    if (G.level.night){
      const tw = (Math.sin(a.p * 3) + 1) / 2;
      ctx.fillStyle = `rgba(255,240,140,${0.12 + 0.45 * tw})`;
      ctx.beginPath(); ctx.arc(a.x, a.y, 1.4 + tw * 1.2, 0, Math.PI*2); ctx.fill();
    } else if (G.level.mist){
      ctx.fillStyle = 'rgba(222,235,226,0.16)';
      ctx.beginPath(); ctx.arc(a.x, a.y, 2.4, 0, Math.PI*2); ctx.fill();
    } else {
      ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(a.p);
      ctx.fillStyle = 'rgba(130,170,75,0.45)'; ctx.fillRect(-2.6, -1.2, 5.2, 2.4);
      ctx.restore();
    }
  }

  // wave spawn progress (thin bar along the top)
  if (G.waveActive && G.waveTotal){
    const rem = clamp((G.spawnQ.length + G.dinos.length) / G.waveTotal, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, W, 5);
    ctx.fillStyle = '#e8b93a'; ctx.fillRect(0, 0, W * (1 - rem), 5);
  }

  // boss health bar
  const bosses = G.dinos.filter(d => d.boss && !d.dead && !d.leaked);
  if (bosses.length){
    let b = bosses[0];
    for (const d of bosses) if (d.maxHp > b.maxHp) b = d;
    const bw = 460, bx = (W - bw) / 2, by = 30;
    ctx.fillStyle = 'rgba(12,8,8,0.72)'; ctx.fillRect(bx - 10, by - 18, bw + 20, 38);
    ctx.strokeStyle = '#a03828'; ctx.lineWidth = 1.5; ctx.strokeRect(bx - 10, by - 18, bw + 20, 38);
    ctx.fillStyle = '#ffd24a'; ctx.font = 'bold 12px Verdana, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('☠  ' + b.name.toUpperCase() + (bosses.length > 1 ? `  (+${bosses.length - 1} more)` : ''), W/2, by - 4);
    ctx.fillStyle = '#38130e'; ctx.fillRect(bx, by + 2, bw, 10);
    const grd = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    grd.addColorStop(0, '#ff6a4a'); grd.addColorStop(1, '#c02818');
    ctx.fillStyle = grd; ctx.fillRect(bx, by + 2, bw * clamp(b.hp / b.maxHp, 0, 1), 10);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
    for (let i = 1; i < 10; i++){ ctx.beginPath(); ctx.moveTo(bx + bw*i/10, by + 2); ctx.lineTo(bx + bw*i/10, by + 12); ctx.stroke(); }
  }

  // hurt vignette when a dino breaches
  if (G.hurtT > 0){
    G.hurtT = Math.max(0, G.hurtT - dt);
    const a = G.hurtT / 0.6;
    const hg = ctx.createRadialGradient(W/2, H/2, H*0.38, W/2, H/2, H*0.78);
    hg.addColorStop(0, 'rgba(200,20,10,0)'); hg.addColorStop(1, `rgba(200,20,10,${0.3 * a})`);
    ctx.fillStyle = hg; ctx.fillRect(0, 0, W, H);
  }
  // gold flash on wave clear
  if (G.flashT > 0){
    G.flashT = Math.max(0, G.flashT - dt);
    ctx.fillStyle = `rgba(255,214,90,${0.16 * (G.flashT / 0.45)})`;
    ctx.fillRect(0, 0, W, H);
  }

  // cinematic letterbox during a boss entrance
  if (G.cinT > 0){
    G.cinT = Math.max(0, G.cinT - dt);
    const a = clamp(Math.min((2.8 - G.cinT) * 4, G.cinT * 1.6), 0, 1);
    const bh = 58 * a;
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, 0, W, bh); ctx.fillRect(0, H - bh, W, bh);
    const rg = ctx.createRadialGradient(W/2, H/2, H*0.3, W/2, H/2, H*0.85);
    rg.addColorStop(0, 'rgba(60,0,0,0)'); rg.addColorStop(1, `rgba(60,0,0,${0.35 * a})`);
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  }

  // boss banner: name + epithet title card
  if (G.banner){
    const a = clamp(Math.min((3.4 - G.banner.t) * 4, G.banner.t * 1.8), 0, 1);
    ctx.globalAlpha = a;
    const cy = 108;
    const grad = ctx.createLinearGradient(0, cy - 44, 0, cy + 34);
    grad.addColorStop(0, 'rgba(60,6,6,0)'); grad.addColorStop(0.5, 'rgba(70,8,8,0.85)'); grad.addColorStop(1, 'rgba(60,6,6,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, cy - 44, W, 78);
    ctx.strokeStyle = 'rgba(232,185,58,0.7)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(W*0.24, cy - 40); ctx.lineTo(W*0.76, cy - 40); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W*0.24, cy + 30); ctx.lineTo(W*0.76, cy + 30); ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#000';
    ctx.font = 'bold 34px Verdana, sans-serif';
    ctx.fillText(G.banner.text, W/2 + 2, cy + 2);
    ctx.fillStyle = '#ffd24a';
    ctx.fillText(G.banner.text, W/2, cy);
    ctx.fillStyle = '#e8a0a0';
    ctx.font = 'bold 13px Verdana, sans-serif';
    const sub = G.banner.sub || '';
    ctx.fillText('—  ' + sub + '  —', W/2, cy + 22);
    ctx.globalAlpha = 1;
  }
  // wave-100 fireworks celebration
  if (G.celebration){
    const c = G.celebration;
    c.t += dt;
    if (c.t >= c.next && c.t < c.dur - 1.2){
      c.next = c.t + rand(0.22, 0.4);
      G.fw.push({x: rand(W*0.12, W*0.88), y: rand(H*0.12, H*0.55), t: 0,
                 hue: rand(0, 360), n: 14 + (Math.random()*8 | 0), r: rand(70, 120)});
      SFX.firework();
      G.shake = Math.max(G.shake, 1.5);
    }
    for (const f of G.fw){
      f.t += dt;
      const k = Math.min(1, f.t / 1.1);
      const spread = f.r * (1 - Math.pow(1 - k, 2.2));
      for (let i = 0; i < f.n; i++){
        const a = i / f.n * Math.PI * 2 + f.hue;
        const px = f.x + Math.cos(a) * spread;
        const py = f.y + Math.sin(a) * spread * 0.85 + 55 * k * k; // gravity
        ctx.fillStyle = `hsla(${f.hue + i * 9}, 90%, ${70 - k * 25}%, ${1 - k})`;
        ctx.beginPath(); ctx.arc(px, py, 2.6 - k * 1.4, 0, Math.PI*2); ctx.fill();
      }
      if (f.t < 0.15){ // launch flash
        ctx.fillStyle = `hsla(${f.hue}, 90%, 85%, ${0.8 - f.t * 5})`;
        ctx.beginPath(); ctx.arc(f.x, f.y, 9, 0, Math.PI*2); ctx.fill();
      }
    }
    G.fw = G.fw.filter(f => f.t < 1.1);
    // triumphant title zooming in
    const ta = clamp(c.t * 2, 0, 1);
    const sc = 1 + Math.max(0, 0.6 - c.t) * 1.4;
    ctx.save();
    ctx.globalAlpha = ta;
    ctx.translate(W/2, H * 0.42);
    ctx.scale(sc, sc);
    ctx.textAlign = 'center';
    ctx.font = 'bold 54px Verdana, sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillText('🏆 ZONE SECURED!', 3, 3);
    const tg = ctx.createLinearGradient(0, -40, 0, 20);
    tg.addColorStop(0, '#ffe9a0'); tg.addColorStop(1, '#e8a93a');
    ctx.fillStyle = tg;
    ctx.fillText('🏆 ZONE SECURED!', 0, 0);
    ctx.font = 'bold 17px Verdana, sans-serif';
    ctx.fillStyle = '#d8dcc8';
    ctx.fillText('100 waves held. The dinosaurs are contained.', 0, 34);
    ctx.restore();
    if (c.t >= c.dur){
      G.celebration = null;
      $('#victory').classList.remove('hidden');
    }
  }

  if (G.paused){
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 40px Verdana, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('⏸ PAUSED', W/2, H/2);
  }
  ctx.restore();
}

/* ---------------- input ---------------- */
function canvasPos(e){
  const r = cv.getBoundingClientRect();
  return {x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height)};
}
cv.addEventListener('mousemove', e => {
  const p = canvasPos(e);
  G.mouse.x = p.x; G.mouse.y = p.y; G.mouse.on = true;
});
cv.addEventListener('mouseleave', () => { G.mouse.on = false; });
const IS_COARSE = matchMedia('(pointer: coarse)').matches; // touch devices
cv.addEventListener('click', e => {
  if (G.state !== 'playing') return;
  const p = canvasPos(e);
  if (G.targeting === 'strike'){
    launchStrike(p.x, p.y);
    return;
  }
  if (G.placing){
    if (IS_COARSE){
      // two-tap on touch: first tap previews, second tap (near it) confirms
      if (!G.pendingTap || hyp(p.x, p.y, G.pendingTap.x, G.pendingTap.y) > 36){
        G.pendingTap = {x: p.x, y: p.y};
        G.mouse.x = p.x; G.mouse.y = p.y; G.mouse.on = true;
        return;
      }
      placeTower(G.placing, G.pendingTap.x, G.pendingTap.y);
      G.pendingTap = null;
    } else {
      placeTower(G.placing, p.x, p.y);
    }
    if (!e.shiftKey && G.cash < towerCost(G.placing)) { G.placing = null; }
    updateHUD();
    return;
  }
  // select tower under cursor
  let hit = null;
  for (const t of G.towers) if (hyp(p.x, p.y, t.x, t.y) < 22) hit = t;
  selectTower(hit);
});
cv.addEventListener('contextmenu', e => {
  e.preventDefault();
  G.placing = null; G.pendingTap = null; G.targeting = null; selectTower(null); updateHUD();
});
window.addEventListener('keydown', e => {
  if (G.state !== 'playing') return;
  const keys = Object.keys(TOWERS);
  if (e.key >= '1' && e.key <= String(keys.length)){
    const k = keys[+e.key - 1];
    if (towerUnlocked(k)){ G.placing = k; selectTower(null); updateHUD(); }
    else SFX.error();
  }
  if (e.key === 'Escape'){ G.placing = null; G.pendingTap = null; G.targeting = null; selectTower(null); updateHUD(); }
  if (e.key === ' '){ e.preventDefault(); if (!G.waveActive) startWave(); else togglePause(); }
  if (e.key === 'm' || e.key === 'M') toggleMute();
});
function togglePause(){ G.paused = !G.paused; updateHUD(); }

/* ---------------- wire up UI ---------------- */
$('#btnWave').onclick = () => { startWave(); };
$('#btnPause').onclick = togglePause;
function toggleMute(){
  save.settings.mute = !save.settings.mute;
  persist();
  if ($('#optMute')) $('#optMute').checked = save.settings.mute;
  updateHUD();
}
$('#btnMute').onclick = toggleMute;
$$('#speedBtns button').forEach(b => b.onclick = () => { G.speed = +b.dataset.s; G.paused = false; updateHUD(); });
$('#btnMenu').onclick = () => { if (!G.over) saveRun(); toMenu(); };
$('#up_main').onclick = () => upgrade();
$('#airCard').onclick = () => {
  if (!airUnlocked() || G.airUsed >= AIRSTRIKE.maxUses){ SFX.error(); return; }
  G.targeting = (G.targeting === 'strike') ? null : 'strike';
  G.placing = null; G.pendingTap = null;
  selectTower(null);
  updateHUD();
};
$('#tpSell').onclick = sellSelected;
$('#tpMode').onclick = () => {
  const modes = ['first', 'last', 'strong', 'close'];
  const t = G.selected; if (!t) return;
  t.mode = modes[(modes.indexOf(t.mode) + 1) % modes.length];
  renderTowerPanel();
};
const openLab = () => { buildLab(); $('#lab').classList.remove('hidden'); };
$('#btnTips').onclick = () => { buildTips(); $('#tips').classList.remove('hidden'); };
$('#tipsClose').onclick = () => $('#tips').classList.add('hidden');
$('#verChip').onclick = () => { buildChangelog(); $('#changelog').classList.remove('hidden'); };
$('#clogClose').onclick = () => $('#changelog').classList.add('hidden');
$('#btnLab').onclick = openLab;
$('#menuDna').onclick = openLab;
$('#vLab').onclick = openLab;
$('#goLab').onclick = openLab;
$('#labClose').onclick = () => { $('#lab').classList.add('hidden'); buildMenu(); };
$$('.modalX').forEach(b => b.onclick = () => {
  const m = b.closest('.modal');
  m.classList.add('hidden');
  if (m.id === 'lab') buildMenu();
});
$('#btnSettings').onclick = () => { syncSettings(); $('#settings').classList.remove('hidden'); };
$('#setClose').onclick = () => { $('#settings').classList.add('hidden'); };
$('#optInv').onchange = e => { save.settings.invincible = e.target.checked; persist(); updateHUD(); };
$('#optMute').onchange = e => { save.settings.mute = e.target.checked; persist(); ensureMusic(); };
$('#optMusic').onchange = e => { save.settings.music = e.target.checked; persist(); ensureMusic(); };
$('#optAuto').onchange = e => { save.settings.auto = e.target.checked; persist(); };
$('#btnExport').onclick = () => {
  const code = btoa(unescape(encodeURIComponent(JSON.stringify(save))));
  prompt('Copy this save code and keep it somewhere safe:', code);
};
$('#btnImport').onclick = () => {
  const code = prompt('Paste your save code:');
  if (!code) return;
  try {
    const s = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
    if (!s || typeof s.unlocked !== 'number') throw new Error('bad save');
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
    save = loadSave();
    if (save.run){ migrateTowers(save.run.towers); if (save.run.cp) migrateTowers(save.run.cp.towers); }
    persist();
    syncSettings(); buildMenu();
    alert('Save imported successfully!');
  } catch(e){ alert('That save code could not be read.'); }
};
$('#btnReset').onclick = () => {
  if (confirm('Wipe ALL progress (unlocks, DNA, research)? This cannot be undone.')){
    localStorage.removeItem(SAVE_KEY);
    save = loadSave();
    syncSettings(); buildMenu();
    $('#settings').classList.add('hidden');
  }
};
$('#goMenu').onclick = toMenu;
$('#goRetry').onclick = () => startLevel(G.levelIdx, 'fresh');
$('#vMenu').onclick = toMenu;
$('#vNext').onclick = () => {
  const next = G.levelIdx + 1;
  if (next < LEVELS.length && next < save.unlocked) startLevel(next, 'fresh');
  else toMenu();
};
window.addEventListener('beforeunload', () => { if (G.state === 'playing' && !G.over) saveRun(); });

/* error overlay for easier debugging */
window.onerror = (msg, src, line) => {
  const el = $('#errbox');
  el.classList.remove('hidden');
  el.textContent = 'Error: ' + msg + ' (' + (src || '').split('/').pop() + ':' + line + ')';
};

/* ---------------- boot ---------------- */
buildMenu();
syncSettings();
requestAnimationFrame(frame);

if (new URLSearchParams(location.search).has('dbg')){
  setTimeout(() => {
    const el = $('#errbox');
    el.classList.remove('hidden');
    el.textContent = ['body', '#app', '#main', '#stage', '#game', '#shop', '#shopCards', '#hud']
      .map(s => s + '=' + Math.round(document.querySelector(s === 'body' ? 'body' : s).getBoundingClientRect().width)).join(' ');
  }, 800);
}

if (new URLSearchParams(location.search).has('tips')){ buildTips(); $('#tips').classList.remove('hidden'); }
if (new URLSearchParams(location.search).has('log')){ buildChangelog(); $('#changelog').classList.remove('hidden'); }

/* headless smoke-test hook: ?test=1 jumps straight into gameplay,
   &sim=SECONDS fast-forwards the simulation synchronously */
const testParams = new URLSearchParams(location.search);
if (testParams.has('resume') && save.run){
  startLevel(save.run.levelIdx, 'resume');
}
if (testParams.has('test')){
  save.run = null;
  startLevel(clamp(parseInt(testParams.get('level'), 10) || 0, 0, LEVELS.length - 1), 'fresh');
  G.cash = 5000;
  placeTower('gatling', 420, 260, true);
  placeTower('flamer', 550, 330, true);
  placeTower('missile', 800, 300, true);
  placeTower('mortar', 900, 490, true);
  if (testParams.has('strike')){ // stage an air strike for visual checks
    G.cash = 99999; G.wave = 60;
    launchStrike(640, 430);
    G.wave = 0;
    for (let s = 0; s < (parseFloat(testParams.get('strike')) || 0.6); s += 0.05) step(0.05);
    G.paused = true; // freeze mid-flight so the frame can be inspected
  }
  if (testParams.has('upg')){ // preview upgraded-tower visuals
    const lv = clamp(parseInt(testParams.get('upg'), 10) || 3, 0, 3);
    G.towers.forEach(t => { t.ulv = Math.min(TOWERS[t.key].maxUp, lv); });
  }
  startWave();
  const sim = parseFloat(testParams.get('sim')) || 0;
  for (let s = 0; s < sim; s += 0.05) step(0.05);
  if (testParams.has('wave')){ G.wave = parseInt(testParams.get('wave'), 10) - 1; G.waveActive = false; startWave(); for (let s = 0; s < (sim || 6); s += 0.05) step(0.05); }
  if (testParams.has('win')){ // stage the wave-100 celebration
    G.wave = WAVES_PER_LEVEL;
    victory();
  }
  if (testParams.has('boss')){ // stage a live boss entrance
    spawnDino(DINOS[testParams.get('bosskey')] ? testParams.get('bosskey') : 'trex', 0, true);
    const bt = parseFloat(testParams.get('boss')) || 1;
    for (let s = 0; s < bt; s += 0.05) step(0.05);
    G.paused = true;
  }
  if (testParams.has('kill')){ // stage a boss death mid-map to check the collapse
    spawnDino('trex', 0, true);
    const b = G.dinos[G.dinos.length - 1];
    b.dist = G.paths[0].len * 0.45;
    damage(b, 1e9, true);
    const ft = parseFloat(testParams.get('kill')) || 0.4;
    for (let s = 0; s < ft; s += 0.05) step(0.05);
  }
}
