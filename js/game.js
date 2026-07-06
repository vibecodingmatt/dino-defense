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
const fmt   = n => {
  if (!isFinite(n)) return '∞';
  n = Math.floor(n);
  const a = Math.abs(n);
  if (a >= 1e15) return n.toExponential(1);
  if (a >= 1e12) return (n/1e12).toFixed(1)+'T';
  if (a >= 1e9)  return (n/1e9).toFixed(1)+'B';
  if (a >= 1e6)  return (n/1e6).toFixed(1)+'M';
  if (a >= 1e4)  return (n/1e3).toFixed(1)+'k';
  return n.toString();
};

const W = 1280, H = 720;

/* ---------------- analytics (GA4) ----------------
   Off unless a real Measurement ID is set in data.js. Never fires on local
   (file://) or ?test=/debug sessions, so your own testing stays out of it. */
const DEV_SESSION = location.protocol === 'file:' ||
  ['test','econ','pop','firstwave','misl','strike','dbg','lab','settings','ach','tips','log','resume','dev']
    .some(k => new URLSearchParams(location.search).has(k));
function initAnalytics(){
  if (DEV_SESSION || !/^G-[A-Z0-9]+$/i.test(ANALYTICS_ID || '')) return;
  const s = document.createElement('script');
  s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ANALYTICS_ID;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function(){ window.dataLayer.push(arguments); };
  gtag('js', new Date());
  gtag('config', ANALYTICS_ID);
}
function track(event, params){
  if (DEV_SESSION) return;
  try { if (window.gtag) gtag('event', event, params || {}); } catch(e){}
}

/* ---------------- persistent save ---------------- */
const SAVE_KEY = 'islaDefense.v1';
const START_DNA = 80;   // grant so a new player can buy their first upgrade right away
function defaultSave(){
  return {bestDiff:0, mapBest:{}, wlv:{}, dna:START_DNA, kills:0, run:null, ach:{}, granted:true,
          settings:{invincible:false, unlimitedCash:false, levelSkip:false, mute:false, auto:true, music:true, mutedWeapons:{}}};
}
/* per-weapon sound mute (toggled from the weapon's popup menu) */
const weaponMuted = key => !!(save.settings.mutedWeapons && save.settings.mutedWeapons[key]);
function loadSave(){
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!s) return defaultSave();
    const d = defaultSave();
    return {bestDiff: s.bestDiff || 0, mapBest: s.mapBest || {}, wlv: s.wlv || {},
            dna: s.dna || 0, kills: s.kills || 0, run: s.run || null, ach: s.ach || {},
            granted: !!s.granted,
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
// one-time starting DNA grant (covers players whose save predates the grant)
if (!save.granted){ save.dna = (save.dna || 0) + START_DNA; save.granted = true; persist(); }
/* persistent weapon level (starts at 1, uncapped) */
const wlv = key => (save.wlv && save.wlv[key]) || 1;
/* persistent meta-upgrade level — base HP / starting cash (starts at 0, uncapped) */
const mlvl = key => (save.wlv && save.wlv[key]) || 0;
/* lab: per-weapon one-time +10% range unlocks (escalating global cost) + double-sell */
const rangeUnlocked   = key => mlvl('range_' + key) > 0;
const rangeUnlockCount = () => Object.keys(TOWERS).filter(rangeUnlocked).length;
const rangeUnlockCost  = () => RANGE_UP_BASE + RANGE_UP_STEP * rangeUnlockCount();
const rangeUpMult      = key => rangeUnlocked(key) ? RANGE_UP_MULT : 1;
const sellDoubled      = () => mlvl('sell_double') > 0;
const sellRefund       = t => Math.round(t.invested * SELL_BASE * (sellDoubled() ? SELL_DOUBLE_MULT : 1));

/* ---------------- developer cheats & achievements ---------------- */
const CHEAT_PASSWORD = 'matttest';
const cheatsActive = () =>
  save.settings.invincible || save.settings.unlimitedCash || save.settings.levelSkip;
/* trophies are only earned on clean runs — using any cheat this run forfeits them */
const runDisqualified = () => G.runCheated || cheatsActive();

let achToastQ = [];
function unlockAch(key){
  if (!save.ach) save.ach = {};
  if (save.ach[key]) return false;
  if (runDisqualified()) return false;
  const a = ACHIEVEMENTS.find(x => x.key === key);
  if (!a) return false;
  save.ach[key] = Date.now();
  if (a.dna) save.dna += a.dna;   // one-time DNA reward for earning it
  persist();
  if (G.state === 'playing') updateHUD();
  achToastQ.push(a);
  if (achToastQ.length === 1) showNextToast();
  return true;
}
function showNextToast(){
  const a = achToastQ[0];
  const el = $('#achToast');
  if (!a || !el) return;
  el.innerHTML =
    `<div class="atIco">${a.icon}</div>` +
    `<div class="atTxt"><div class="atH">🏆 Achievement Unlocked</div>` +
    `<div class="atN">${a.name}</div><div class="atD">${a.desc}</div></div>` +
    (a.dna ? `<div class="atR">+${fmt(a.dna)}<span>DNA</span></div>` : '');
  el.classList.remove('hidden');
  // reflow so the transition always fires, then slide in
  void el.offsetWidth;
  el.classList.add('show');
  try { SFX.fanfare(); } catch(e){}
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => { achToastQ.shift(); el.classList.add('hidden'); showNextToast(); }, 420);
  }, 3200);
}

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
/* separate, gentler budget for creature vocalizations so a mass wipe
   (e.g. an air strike) doesn't unleash a wall of screeches at once */
let voxTimes = [];
function voxGate(){
  const now = performance.now();
  while (voxTimes.length && now - voxTimes[0] > 550) voxTimes.shift();
  if (voxTimes.length >= 3) return false;
  voxTimes.push(now);
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
  shot(){ // gatling: punchy crack + muzzle snap, randomized so bursts don't buzz
    if (!sfxGate()) return;
    sfxNoise({dur: 0.055, peak: 0.11, type: 'bandpass', f0: 1700 + Math.random()*500, f1: 600, Q: 0.9, wet: 0.07});
    sfxTone({type: 'square', f0: 230, f1: 80, dur: 0.045, peak: 0.06, dist: true});
    sfxNoise({dur: 0.028, peak: 0.06, type: 'highpass', f0: 3400, wet: 0.03}); // muzzle snap
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
  boom(){ // layered explosion: sharp transient → deep body → debris tail
    if (!sfxGate()) return;
    sfxNoise({dur: 0.05, peak: 0.22, type: 'highpass', f0: 1900, wet: 0.2});               // sharp crack
    sfxTone({type: 'sine', f0: 185, f1: 30, dur: 0.72, peak: 0.30, wet: 0.42});             // deep sub body
    sfxNoise({dur: 0.7, peak: 0.30, type: 'lowpass', f0: 1000, f1: 60, wet: 0.6, a: 0.004}); // blast
    sfxNoise({dur: 0.5, peak: 0.09, type: 'bandpass', f0: 2600, f1: 700, Q: 0.7, wet: 0.42, delay: 0.06}); // debris rain
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
  roar(){ // boss entrance: a huge, layered, double-swell bellow
    sfxTone({type: 'sine',     f0: 62,  f1: 38, dur: 1.45, peak: 0.34, wet: 0.35, a: 0.09});               // sub-bass ground rumble
    sfxTone({type: 'sawtooth', f0: 104, f1: 44, dur: 1.25, peak: 0.28, dist: true, wet: 0.55, tremF: 8,  tremD: 0.5,  a: 0.06}); // core growl
    sfxTone({type: 'sawtooth', f0: 156, f1: 66, dur: 1.1,  peak: 0.13, dist: true, wet: 0.5,  tremF: 11, tremD: 0.45, a: 0.05}); // harmonic snarl
    sfxNoise({dur: 1.05, peak: 0.16, type: 'bandpass', f0: 900, f1: 300, Q: 1.6, wet: 0.5, a: 0.05});       // upper formant rasp
    sfxNoise({dur: 1.1,  peak: 0.10, type: 'bandpass', f0: 500, f1: 130, Q: 0.8, wet: 0.5, a: 0.05});       // throat/breath
    sfxTone({type: 'sawtooth', f0: 120, f1: 52, dur: 0.9, peak: 0.2, dist: true, wet: 0.55, tremF: 9, tremD: 0.5, a: 0.05, delay: 0.9}); // 2nd swell
    sfxNoise({dur: 0.85, peak: 0.12, type: 'bandpass', f0: 820, f1: 260, Q: 1.4, wet: 0.5, delay: 0.9});
  },
  screech(){ // small raptor / compy: a sharp, darting shriek
    sfxTone({type: 'sawtooth', f0: 720, f1: 1500, dur: 0.13, peak: 0.10, dist: true, wet: 0.35, a: 0.008});
    sfxTone({type: 'sawtooth', f0: 900, f1: 380,  dur: 0.17, peak: 0.07, dist: true, wet: 0.35, a: 0.01, delay: 0.05});
    sfxNoise({dur: 0.13, peak: 0.06, type: 'bandpass', f0: 2600, f1: 1400, Q: 1.5, wet: 0.3});
  },
  snarl(){ // mid predator: short guttural growl
    sfxTone({type: 'sawtooth', f0: 190, f1: 88, dur: 0.34, peak: 0.16, dist: true, wet: 0.4, tremF: 16, tremD: 0.5, a: 0.02});
    sfxNoise({dur: 0.32, peak: 0.09, type: 'bandpass', f0: 700, f1: 260, Q: 1, wet: 0.35, a: 0.02});
  },
  bellow(){ // big tank / sauropod: low mournful groan
    sfxTone({type: 'sine',     f0: 90,  f1: 60, dur: 0.72, peak: 0.20, wet: 0.35, a: 0.06});
    sfxTone({type: 'sawtooth', f0: 120, f1: 70, dur: 0.66, peak: 0.12, dist: true, wet: 0.45, tremF: 7, tremD: 0.4, a: 0.05});
    sfxNoise({dur: 0.6, peak: 0.08, type: 'bandpass', f0: 420, f1: 180, Q: 0.9, wet: 0.4, a: 0.05});
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
  gas(){ // a soft little poot — quiet enough to hear over and over without grating
    if (!sfxGate()) return;
    sfxTone({type: 'sawtooth', f0: 118, f1: 62, dur: 0.26, peak: 0.075, dist: true, wet: 0.10, tremF: 20, tremF1: 11, tremD: 0.55, a: 0.02});
    sfxNoise({dur: 0.2, peak: 0.028, type: 'bandpass', f0: 560, f1: 260, Q: 1.2, wet: 0.1, a: 0.02}); // faint wet splatter
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
  targeting: null, strikes: [], clouds: [], airUsed: 0,
  omega: null, omegaUsed: 0,
  celebration: null, fw: [],
  mouse: {x: 0, y: 0, on: false},
  autoTimer: -1,
  shake: 0, banner: null,
  time: 0,
  over: false,
  difficulty: 1,           // selected difficulty level (1..MAX_DIFFICULTY)
  dnaRun: 0,               // DNA earned this run (for the results screen)
  streak: 1,               // clean-play multiplier on wave DNA
  waveLeaked: false,       // did anything leak during the current wave?
  stat: null,              // per-run tally for the recap
  flawless: true,          // no base damage taken this run
  runCheated: false,       // any developer cheat active/used this run → no trophies
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
const BOSS_HP_MULT = 3; // bosses are far tankier than regular dinos — 3× the health bar
const FIRST_WAVE_DELAY = 3; // seconds after the first weapon is placed before wave 1 auto-starts
const hpScale    = w => (0.7 + 0.3*w) * Math.pow(1.020, w) * G.level.hpMult;
const speedScale = w => Math.min(1.4, 1 + w*0.0035);
const bountyOf   = (def, w) => Math.max(1, Math.round(def.bounty * (1 + w*0.008)));
const towerUnlocked = key => (G.wave + 1) >= (TOWERS[key].unlock || 1);
/* each additional copy of the same weapon costs more — spam gets expensive */
function towerCost(key){
  const def = TOWERS[key];
  const count = G.towers.filter(t => t.key === key).length;
  const esc = key === 'mortar' ? 0.35 : 0.15;
  return Math.round(def.cost * (1 + esc * count));
}
const startCash  = () => 300 + 75 * mlvl('start_cash');
const startLives = () => 100 + 25 * mlvl('base_hp');

function towerStats(t){
  const def = TOWERS[t.key];
  const L = wlv(t.key);            // persistent weapon level (the main power lever)
  const u = t.ulv || 0;           // in-run cash upgrades
  return {
    dmg:   def.dmg   * Math.pow(UPG.mult.dmg, u)   * wlvDmgMult(L),
    rof:   def.rof   * Math.pow(UPG.mult.rof, u)   * wlvRofMult(L),
    // range doesn't grow with weapon LEVEL; only the Mortar's in-run upgrade
    // expands it, plus each weapon's optional one-time +10% lab range unlock.
    range: def.range * (t.key === 'mortar' ? Math.pow(UPG.mult.range, u) : 1) * rangeUpMult(t.key),
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
  const dh = diffHpMult(G.difficulty);   // difficulty-level health multiplier
  const hp = (isBoss
    ? def.hp * (0.25 + w * 0.075) * G.level.hpMult * BOSS_HP_MULT
    : def.hp * hpScale(w)) * dh;
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
    speed: def.speed * speedScale(w) * diffSpdMult(G.difficulty),
    pathI, dist: 0,
    slowT: 0, slowF: 1, burnT: 0, burnDps: 0, revealT: 0,
    // Indominus camouflage: cloakCd counts down its brief on-field visibility;
    // when it hits 0 the dino vanishes and stays cloaked for good (-1 = never cloaks)
    cloaked: false, cloakCd: def.cloak ? 2 : -1, vanishAnnounced: false,
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
  // camouflaged Indominus is invulnerable unless a Sonic Emitter has revealed it
  if (d.cloaked && d.revealT <= 0) return;
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
    if (G.stat){ G.stat.kills++; G.stat.cashEarned += d.bounty; }
    addText(p.x, p.y - d.size, '+$' + d.bounty, '#ffd24a');
    // DNA drops from every kill, scaled by difficulty (clean runs only)
    if (!runDisqualified()){
      const dna = d.bounty * DNA_PER_BOUNTY * diffDnaMult(G.difficulty) * (d.boss ? 12 : 1);
      save.dna += dna;
      G.dnaRun += dna;
      if (G.stat) G.stat.dnaKills += dna;
      save.kills = (save.kills || 0) + 1;
      if (save.kills >= 1000  && !save.ach.kills_1k)  unlockAch('kills_1k');
      if (save.kills >= 50000 && !save.ach.kills_50k) unlockAch('kills_50k');
    }
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
      unlockAch('boss_first');
      if (d.key === 'drex') unlockAch('apex');
    } else {
      addFx('puff', p.x, p.y, d.size);
      addFx('blood', p.x, p.y + 2, d.size * 0.45);
      if (Math.random() < 0.3) SFX.coin();
      // dying vocalization, flavored by body size (occasional + rate-limited)
      if (voxGate() && Math.random() < 0.5){
        if (d.size < 20) SFX.screech();
        else if (d.size >= 34) SFX.bellow();
        else SFX.snarl();
      }
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
    d.burnDps = def.burn.dps * wlvDmgMult(wlv('flamer'));
  }
}

function fireTower(t, dt){
  const def = TOWERS[t.key];
  const st = towerStats(t);
  const say = m => { if (!weaponMuted(t.key)) SFX[m](); }; // per-weapon sound gate
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
    say('pulse');
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
      say('dart');
      G.projs.push({kind:'dart', x:t.x, y:t.y, target, speed:520, dmg:st.dmg, tower:t, color:'#c8f08a'});
      break;
    case 'bullet':
      say('shot');
      G.projs.push({kind:'bullet', x:t.x, y:t.y, target, speed:760, dmg:st.dmg, tower:t, color:'#ffe9a0'});
      break;
    case 'snipe':
      say('snipe');
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
      say('zap');
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
      say('shot');
      // each upgrade adds a rocket — the WHOLE salvo locks onto the same target
      const salvo = 1 + (t.ulv || 0);
      for (let i = 0; i < salvo; i++){
        const a = t.angle + (i - (salvo - 1) / 2) * 0.4; // fanned launch, same target
        G.projs.push({kind:'missile', x:t.x, y:t.y, target, speed:420, dmg:st.dmg, splash:st.splash, tower:t,
                      vx:Math.cos(a)*420, vy:Math.sin(a)*420, color:'#ffb0a0'});
      }
      break;
    }
    case 'cryo':
      say('cryo');
      G.projs.push({kind:'cryo', x:t.x, y:t.y, target, speed:460, dmg:st.dmg, splash:st.splash, slow:def.slow, tower:t, color:'#cfeeff'});
      break;
    case 'gas': {
      // toot! a puff of green gas out the nozzle, then a lingering cloud on the target
      say('gas');
      addFx('gaspuff', t.x + Math.cos(t.angle) * 20, t.y + Math.sin(t.angle) * 20, 16, t.angle);
      if (G.clouds.length > 40) G.clouds.shift();
      G.clouds.push({x: tp.x, y: tp.y, r: def.cloud.r, t: 0, dur: def.cloud.dur, dps: st.dmg, tower: t, seed: Math.random()*9});
      break;
    }
    case 'mortar': {
      say('thoomp');
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
        if (!weaponMuted(pr.tower.key)) SFX.boom();
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
    // decide whether the projectile detonates this frame
    let impact = dd <= step + 6;
    if (pr.kind === 'missile'){
      pr.life = (pr.life || 0) + dt;
      // proximity fuse: a rocket must never orbit its target forever. Detonate
      // once it's captured the target, has passed its closest approach, or times out.
      if (dd <= 18) impact = true;
      else if (dd < 46 && dd > (pr.lastDist != null ? pr.lastDist : 1e9)) impact = true;
      else if (pr.life > 2.5) impact = true;
      pr.lastDist = dd;
    }
    if (impact){
      pr.hit = true;
      const def = TOWERS[pr.tower.key];
      const st = {dmg: pr.dmg, rof: 0, range: 0};
      if (pr.splash){
        if (!weaponMuted(pr.tower.key)) SFX.boom();
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
        // homing with inertia; turn harder up close so it can capture the target
        // instead of settling into a wide circular orbit around it
        const want = Math.atan2(dy, dx);
        const cur = Math.atan2(pr.vy, pr.vx);
        let da = want - cur; while (da > Math.PI) da -= Math.PI*2; while (da < -Math.PI) da += Math.PI*2;
        const turnRate = dd < 120 ? 12 : 7;
        const na = cur + clamp(da, -turnRate*dt, turnRate*dt);
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
  // the air-strike carpet must always be visible, so its bursts bypass the soft cap
  if (G.fx.length > 360 && kind !== 'airburst' && kind !== 'shock') return;
  G.fx.push({kind, x, y, r, ang: ang || 0, t: 0, seed: Math.random() * 9,
             dur: kind === 'sonic' ? 0.5 : kind === 'boom' ? 0.45 : kind === 'airburst' ? 0.55 : kind === 'frost' ? 0.5 : kind === 'flame' ? 0.22 : kind === 'gaspuff' ? 0.55 : kind === 'ring' ? 0.8 : kind === 'dust' ? 0.9 : kind === 'step' ? 0.45 : kind === 'shock' ? 0.9 : kind === 'birds' ? 1.4 : 0.3});
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
    // Indominus camouflage: after a brief window of visibility once it's on
    // the field (past its entrance), it gains permanent cloak — from then on
    // it can only be seen or hurt while a Sonic Emitter's pulse is revealing it.
    if (d.cloakCd >= 0 && !d.cloaked && d.entranceT <= 0){
      d.cloakCd -= dt;
      if (d.cloakCd <= 0) d.cloaked = true;
    }
    // Announce the vanish the FIRST time it's actually unseen — cloaked AND not
    // currently lit up by an emitter. If an emitter is covering it when it
    // cloaks it never visibly disappears (no banner); the cue only fires if/when
    // it slips out of emitter cover somewhere along the path.
    if (d.cloaked && d.revealT <= 0 && !d.vanishAnnounced){
      d.vanishAnnounced = true;
      const cp = dinoPos(d);
      addFx('shock', cp.x, cp.y, d.size * 2.2);
      addText(cp.x, cp.y - d.size, '👻 vanished!', '#cbb6ff', 14);
      G.banner = {text: 'IT VANISHED!', sub: 'The Indominus turned invisible — only a 📡 Sonic Emitter can expose it', t: 4.2, t0: 4.2};
      SFX.pulse();
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
      G.waveLeaked = true; // a dino got through — breaks the clean-wave streak
      if (!save.settings.invincible){
        G.lives -= d.dmgToBase * (d.boss ? 1 : 1);
        G.flawless = false; // base took a hit — no longer a flawless run
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
  if (cheatsActive()) G.runCheated = true; // latch: cheating any wave forfeits this run's trophies
  G.waveLeaked = false; // fresh clean-wave chance for the streak
  G.waveActive = true;
  G.autoTimer = -1;
  G.spawnQ = G.pendingWave || buildWave(G.wave);
  G.waveTotal = G.spawnQ.length;
  G.pendingWave = G.wave < WAVES_PER_LEVEL ? buildWave(G.wave + 1) : null;
  updateIncoming();
  G.spawnT = 0;
  if (G.wave >= 50) unlockAch('wave50');
  updateHUD();
}
function endWave(){
  G.waveActive = false;
  const bonus = 40 + 3 * G.wave;
  G.cash += bonus;
  if (G.stat) G.stat.cashEarned += bonus;
  // clean-play streak: a wave cleared with no leaks grows the multiplier,
  // a leak knocks it back down
  if (G.waveLeaked) G.streak = Math.max(1, G.streak * STREAK_LEAK_MULT);
  else G.streak = Math.min(STREAK_MAX, G.streak + STREAK_STEP);
  if (G.stat) G.stat.streakMax = Math.max(G.stat.streakMax, G.streak);
  // bank DNA for clearing this wave (clean runs only), boosted by the streak —
  // this is the main way a run that can't reach wave 100 still earns DNA
  let dnaGain = 0;
  if (!runDisqualified()){
    dnaGain = waveDna(G.wave) * diffDnaMult(G.difficulty) * G.streak;
    save.dna += dnaGain; G.dnaRun += dnaGain;
    if (G.stat) G.stat.dnaWaves += dnaGain;
  }
  persist();
  const streakTag = G.streak > 1.001 ? `  🔥×${G.streak.toFixed(1)}` : '';
  addText(W/2, 120, `Wave ${G.wave} cleared!  +$${bonus}${dnaGain >= 1 ? '  +' + fmt(dnaGain) + ' DNA' : ''}${streakTag}`, '#9fe870');
  G.flashT = 0.45;
  SFX.fanfare();
  if (G.wave >= WAVES_PER_LEVEL){ victory(); return; }
  saveRun();
  if (save.settings.auto) G.autoTimer = 3;
  updateHUD();
}
/* level-skip cheat: instantly clear the current wave and bank it. Clears the
   field with no base penalty so you can fast-forward toward late waves/bosses. */
function skipWave(){
  if (!save.settings.levelSkip || G.state !== 'playing' || G.over) return;
  G.runCheated = true;
  G.dinos = []; G.spawnQ = [];
  if (!G.waveActive) startWave();
  G.dinos = []; G.spawnQ = [];
  if (G.waveActive) endWave();
  updateHUD();
}
function snapshot(){
  return {
    wave: G.wave, cash: G.cash, lives: G.lives, airUsed: G.airUsed, omegaUsed: G.omegaUsed,
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
  s.difficulty = G.difficulty;
  s.dnaRun = G.dnaRun;
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
/* mode: 'fresh' | 'resume' (saved run). diff = chosen difficulty level. */
function startLevel(idx, mode, diff){
  G.levelIdx = idx;
  G.level = LEVELS[idx];
  G.difficulty = mode === 'resume' && save.run ? (save.run.difficulty || 1) : clamp(diff || 1, 1, unlockedCap());
  G.dnaRun = mode === 'resume' && save.run ? (save.run.dnaRun || 0) : 0;
  G.paths = buildPaths(G.level);
  const bg = renderBackground(G.level, W, H);
  G.bg = bg.cv; G.flames = bg.flames; G.exitFx = bg.exit;
  G.hurtT = 0; G.flashT = 0; G.waveTotal = 0; G.cinT = 0;
  initAmbient();
  G.dinos = []; G.projs = []; G.fx = []; G.bolts = []; G.texts = []; G.spawnQ = []; G.corpses = []; G.decals = [];
  G.selected = null; G.placing = null; G.targeting = null; G.strikes = []; G.clouds = []; G.omega = null;
  G.celebration = null; G.fw = [];
  G.waveActive = false; G.autoTimer = -1; G.over = false; G.banner = null;
  G.speed = 1;
  // a flawless run means zero base damage; resuming can't verify past waves,
  // so only a fresh run is eligible. Cheats used this run also disqualify it.
  G.flawless = (mode !== 'resume');
  G.runCheated = cheatsActive();
  if (mode === 'resume' && save.run){
    restoreSnapshot(save.run);
    G.wave = save.run.wave; G.lives = save.run.lives;
    G.airUsed = save.run.airUsed || 0; G.omegaUsed = save.run.omegaUsed || 0;
  } else {
    G.wave = 0; G.cash = startCash(); G.towers = [];
    G.lives = startLives(); G.airUsed = 0; G.omegaUsed = 0;
  }
  G.maxLives = startLives();
  G.streak = 1; G.waveLeaked = false;
  G.stat = {dnaWaves: 0, dnaKills: 0, cashEarned: 0, kills: 0, streakMax: 1};
  saveRun();
  G.state = 'playing';
  $('#menu').classList.add('hidden');
  $('#gameover').classList.add('hidden');
  $('#victory').classList.add('hidden');
  $('#hud').classList.remove('hidden');
  $('#shop').classList.remove('hidden');
  $('#levelTitle').textContent = `${G.level.name} · Lv ${G.difficulty}`;
  buildShop();
  selectTower(null);
  G.pendingWave = G.wave < WAVES_PER_LEVEL ? buildWave(G.wave + 1) : null;
  updateIncoming();
  updateHUD();
  G.runStartT = performance.now();
  track(mode === 'resume' ? 'run_resume' : 'run_start', {map_name: G.level.name, difficulty: G.difficulty});
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
  const D = G.difficulty;
  const cheated = runDisqualified();
  track('run_end', {result: 'win', map_name: G.level.name, difficulty: D, wave: WAVES_PER_LEVEL,
                    duration_sec: Math.round((performance.now() - (G.runStartT || performance.now())) / 1000)});
  track('level_beaten', {map_name: G.level.name, difficulty: D});
  // end-of-run bonuses, as a % of the DNA earned during the run (clean runs only)
  const s = G.stat || {dnaWaves: 0, dnaKills: 0, cashEarned: 0, kills: 0, streakMax: G.streak};
  const earned = s.dnaWaves + s.dnaKills;                     // banked wave + kill DNA
  const healthPct = clamp(G.lives / (G.maxLives || 1), 0, 1);
  const victoryBonus  = cheated ? 0 : Math.round(earned * VICTORY_PCT);
  const healthBonus   = cheated ? 0 : Math.round(earned * HEALTH_PCT * healthPct);
  const flawlessBonus = (!cheated && G.flawless) ? Math.round(earned * FLAWLESS_PCT) : 0;
  const bonusTotal = victoryBonus + healthBonus + flawlessBonus;
  save.dna += bonusTotal; G.dnaRun += bonusTotal;
  const wasUnlocked = diffUnlocked(save.bestDiff);
  let newBlock = false;
  if (!cheated){
    if (D > save.bestDiff){ save.bestDiff = D; newBlock = diffUnlocked(save.bestDiff) > wasUnlocked; }
    save.mapBest[G.levelIdx] = Math.max(save.mapBest[G.levelIdx] || 0, D);
  }
  persist();
  // trophies (skipped automatically if any cheat was used this run)
  unlockAch('secure_' + G.levelIdx);
  if (G.flawless){ unlockAch('flawless'); if (D >= 100) unlockAch('flawless_hi'); }
  if ([0,1,2,3,4].every(i => (save.mapBest[i] || 0) > 0)) unlockAch('island');
  if (D >= 10)   unlockAch('diff_10');
  if (D >= 25)   unlockAch('diff_25');
  if (D >= 50)   unlockAch('diff_50');
  if (D >= 75)   unlockAch('diff_75');
  if (D >= 100)  unlockAch('diff_100');
  if (D >= 250)  unlockAch('diff_250');
  if (D >= 500)  unlockAch('diff_500');
  if (D >= 750)  unlockAch('diff_750');
  if (D >= 1000) unlockAch('diff_1000');
  const unlockNote = newBlock && diffUnlocked(save.bestDiff) <= MAX_DIFFICULTY
    ? `<div class="recapUnlock">🔓 New block unlocked — you can now play up to <b>Level ${diffUnlocked(save.bestDiff)}</b>!</div>`
    : (D >= MAX_DIFFICULTY ? `<div class="recapUnlock">👑 You conquered <b>Level 1000</b> — the summit of the climb!</div>` : '');
  const row = (label, val, cls) => `<div class="rl">${label}</div><div class="rv ${cls || ''}">${val}</div>`;
  const totalDna = Math.round(G.dnaRun);
  let recap;
  if (cheated){
    recap = `<div class="recapSub"><b>${G.level.name}</b> cleared at Difficulty ${D} — all 100 waves.</div>` +
            `<div class="dim" style="margin-top:10px">No DNA or trophies — a developer cheat was used this run.</div>`;
  } else {
    recap =
      `<div class="recapSub"><b>${G.level.name}</b> cleared at <b>Difficulty ${D}</b> — all 100 waves contained.</div>` +
      `<div class="recapGrid">` +
        row('☠ Dinosaurs defeated', fmt(s.kills)) +
        row('🔥 Best clean streak', '×' + s.streakMax.toFixed(1), 'streak') +
        `<div class="rsep"></div>` +
        row('🧬 DNA earned in the fight', '+' + fmt(earned), 'dna') +
        row('🏁 Victory bonus (+20%)', '+' + fmt(victoryBonus), 'dna') +
        row(`❤ Health bonus (${Math.round(healthPct*100)}% left)`, '+' + fmt(healthBonus), 'dna') +
        (flawlessBonus ? row('🛡️ Flawless bonus (+25%)', '+' + fmt(flawlessBonus), 'dna') : '') +
        `<div class="rl total">🧬 Total DNA banked</div><div class="rv dna total">+${fmt(totalDna)}</div>` +
        `<div class="rsep"></div>` +
        row('💰 Cash earned', '$' + fmt(s.cashEarned), 'cash') +
      `</div>` + unlockNote;
  }
  $('#victoryText').innerHTML = recap;
  // "Next Difficulty" climbs to D+1 on this same map; hide it once there's
  // nothing higher unlocked (i.e. you just beat Level 1000).
  const nextD = D + 1;
  const vNextBtn = $('#vNext');
  if (nextD <= unlockedCap()){
    vNextBtn.style.display = '';
    vNextBtn.textContent = `➜ Play Difficulty ${nextD}`;
  } else {
    vNextBtn.style.display = 'none';
  }
  // fireworks over the battlefield before the results screen appears
  G.celebration = {t: 0, dur: 5.4, next: 0.2};
  G.fw = [];
  G.flashT = 0.6;
  SFX.victoryTune();
}
function defeat(){
  G.over = true;
  clearRun();
  track('run_end', {result: 'loss', map_name: G.level.name, difficulty: G.difficulty, wave: G.wave,
                    duration_sec: Math.round((performance.now() - (G.runStartT || performance.now())) / 1000)});
  const banked = runDisqualified()
    ? `<span class="dim">No DNA — a developer cheat was used this run.</span>`
    : `You banked <b class="dna">+${fmt(G.dnaRun)} DNA</b> from the ${G.wave} wave${G.wave === 1 ? '' : 's'} you cleared — spend it in the Lab to level up, then try again.`;
  $('#defeatText').innerHTML =
    `The perimeter fell on <b>wave ${G.wave}</b> of ${G.level.name} (Difficulty ${G.difficulty}).<br>` + banked;
  $('#gameover').classList.remove('hidden');
}
function toMenu(){
  G.state = 'menu';
  G.runCheated = false;   // no run in progress — Lab actions here are eligible for trophies
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
  if (!force) track('weapon_built', {weapon: key});
  // onboarding: the moment the very first weapon is down, count wave 1 in
  if (G.wave === 0 && !G.waveActive && !G.over && G.towers.length === 1 && !(G.autoTimer > 0)){
    G.autoTimer = FIRST_WAVE_DELAY;
  }
  saveRun();
  updateHUD();
}
function selectTower(t){
  disarmSell();            // reset any pending sell-confirm when selection changes
  G.selected = t;
  const pop = $('#towerPop');
  if (!t){ pop.classList.add('hidden'); return; }
  pop.classList.remove('hidden');
  renderTowerPanel();      // fills content
  positionTowerPop(t);     // then place it over the tower
}
/* place the floating menu just above (or below) the selected weapon */
function positionTowerPop(t){
  const pop = $('#towerPop');
  if (!t || pop.classList.contains('hidden')) return;
  const stage = $('#stage'), cvEl = $('#game');
  const sr = stage.getBoundingClientRect(), cr = cvEl.getBoundingClientRect();
  if (!cr.width) return;
  const scale = cr.width / W;                        // screen px per world unit
  const cx = (cr.left - sr.left) + t.x * scale;      // tower centre, stage-relative
  const cy = (cr.top  - sr.top)  + t.y * scale;
  const towerR = 22 * scale;
  const margin = 6;
  // Only let the panel scroll internally when it genuinely can't fit the stage
  // (short mobile-landscape screens); otherwise keep it overflow-free so no
  // vestigial scrollbar shows on desktop and the height can't flicker.
  const avail = sr.height - margin * 2;
  pop.classList.toggle('scroll', pop.scrollHeight > avail + 1);
  const pw = pop.offsetWidth, ph = pop.offsetHeight;
  let left = clamp(cx - pw / 2, margin, Math.max(margin, sr.width - pw - margin));
  let top = cy - towerR - ph - 6;                    // prefer above the tower
  pop.classList.toggle('below', top < margin);
  if (top < margin) top = cy + towerR + 6;           // ...else below it
  top = clamp(top, margin, Math.max(margin, sr.height - ph - margin));
  pop.style.left = left + 'px';
  pop.style.top = top + 'px';
}
function renderTowerPanel(){
  const t = G.selected; if (!t) return;
  const def = TOWERS[t.key];
  const st = towerStats(t);
  const maxed = t.ulv >= def.maxUp;
  $('#tpName').textContent = `${def.icon} ${def.name} — Lv ${t.ulv + 1}${maxed ? ' ★MAX' : ''}`;
  $('#tpStats').innerHTML =
    (t.key === 'gas'
      ? `POISON <b>${st.dmg.toFixed(0)}</b>/s · CLOUD every <b>${(1/st.rof).toFixed(1)}s</b> · RNG <b>${Math.round(st.range)}</b>`
      : `DMG <b>${st.dmg.toFixed(0)}</b> · ROF <b>${st.rof.toFixed(2)}/s</b> · RNG <b>${Math.round(st.range)}</b>`) +
    (t.key === 'missile' ? ` · <b>${1 + t.ulv}</b> rocket${t.ulv ? 's' : ''}/salvo` : '') +
    (st.splash ? ` · SPLASH <b>${Math.round(st.splash)}</b>` : '') +
    (def.air ? '' : ' · <span class="warn">cannot hit flyers</span>');
  const btn = $('#up_main');
  if (maxed){
    btn.textContent = '★ Fully upgraded';
    btn.disabled = true;
    btn.classList.remove('can');
  } else {
    const cost = UPG.cost(def, t.ulv);
    const extra = t.key === 'missile' ? ` (+1 rocket)` : t.key === 'mortar' ? ' (huge blast)' : '';
    btn.textContent = `⬆ Upgrade to Lv ${t.ulv + 2}${extra} — $${cost}`;
    const afford = G.cash >= cost;
    btn.disabled = !afford;                 // greyed-out disabled look when broke
    btn.classList.toggle('can', afford);    // bright green when you can afford it
  }
  $('#tpMode').textContent = 'Target: ' + t.mode.toUpperCase();
  const muted = weaponMuted(t.key), muteBtn = $('#tpMute');
  muteBtn.textContent = muted ? '🔇' : '🔊';
  muteBtn.classList.toggle('muted', muted);
  muteBtn.title = (muted ? 'Unmute' : 'Mute') + ' all ' + def.name + ' sounds';
  const sell = $('#tpSell'), refund = sellRefund(t);
  sell.classList.toggle('confirm', sellArmed);
  sell.textContent = sellArmed ? `⚠ Tap to confirm sell` : `💰 Sell — $${refund}`;
  // NB: positioning is intentionally NOT done here. renderTowerPanel() runs
  // every frame (to keep the upgrade cost/affordability live), and
  // repositioning per-frame caused the panel to oscillate up/down near map
  // edges. The tower never moves, so we reposition only on discrete layout
  // changes (select/upgrade/sell-arm/mode/mute) and on resize.
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
  renderTowerPanel(); positionTowerPop(t); updateHUD();
}
/* selling asks for a confirming second tap so an accidental tap can't sell */
let sellArmed = false, sellTimer = null;
function disarmSell(){ sellArmed = false; if (sellTimer){ clearTimeout(sellTimer); sellTimer = null; } }
function armOrSell(){
  const t = G.selected; if (!t) return;
  if (!sellArmed){
    sellArmed = true;
    renderTowerPanel(); positionTowerPop(t);
    sellTimer = setTimeout(() => { sellArmed = false; if (G.selected){ renderTowerPanel(); positionTowerPop(G.selected); } }, 3000);
    return;
  }
  disarmSell();
  sellSelected();
}
function sellSelected(){
  const t = G.selected; if (!t) return;
  G.cash += sellRefund(t);
  G.towers = G.towers.filter(x => x !== t);
  // sold the last weapon before wave 1 started → cancel the auto-start countdown
  if (G.wave === 0 && !G.waveActive && !G.over && G.towers.length === 0) G.autoTimer = -1;
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
  // choreography: radio alert → two F-22s sweep in → each releases a cluster
  // canister → a rolling carpet of bomblets that emanates from the mark and
  // blankets the ENTIRE field, sweeping outward to the far edges.
  const startX = -260, lead = 0.45;
  const jets = [
    {dx: 0,    oy: -30},
    {dx: -130, oy: 30},
  ];
  const canisters = [];
  for (const j of jets){
    j.sx = startX + j.dx;
    j.drop = lead + (x - j.sx) / AIRSTRIKE.jetSpeed;   // moment this jet is over the mark
    canisters.push({oy: j.oy, t0: j.drop, dur: 0.6});
  }
  const firstLand = Math.min(...jets.map(j => j.drop)) + 0.6;
  // carpet the whole battlefield: one bomblet per jittered grid cell,
  // timed by distance from the mark so the blast rolls out from ground zero
  const events = [];
  const gx = AIRSTRIKE.gridX, gy = AIRSTRIKE.gridY, maxD = Math.hypot(W, H);
  let end = 0;
  for (let ix = 0; ix < gx; ix++){
    for (let iy = 0; iy < gy; iy++){
      const ex = (ix + 0.5) / gx * W + rand(-AIRSTRIKE.jitter, AIRSTRIKE.jitter);
      const ey = (iy + 0.5) / gy * H + rand(-AIRSTRIKE.jitter, AIRSTRIKE.jitter);
      const t = firstLand + (hyp(x, y, ex, ey) / maxD) * AIRSTRIKE.sweep + rand(0, 0.07);
      events.push({t, x: ex, y: ey, done: false});
      end = Math.max(end, t);
    }
  }
  G.strikes.push({x, y, t: 0, lead, jets, canisters, events, hitBosses: new Set(), end: end + 1.2});
  SFX.alert();
  SFX.jet();
  unlockAch('airstrike');
  track('air_strike_called', {difficulty: G.difficulty});
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
        G.shake = Math.max(G.shake, 7);
        const r = AIRSTRIKE.splash * rand(0.95, 1.35);
        addFx('airburst', e.x, e.y, r);
        addFx('shock', e.x, e.y, r * 1.25);
        addFx('dust', e.x, e.y + 4, r * 0.6);
        for (let i = 0; i < 3; i++) addFx('spark', e.x + rand(-r*0.4, r*0.4), e.y + rand(-r*0.4, r*0.4), 6);
        for (const d of G.dinos){ // hits everything, even flyers — it's an airburst
          if (d.dead || d.leaked) continue;
          const p = dinoPos(d);
          if (hyp(e.x, e.y, p.x, p.y) > AIRSTRIKE.splash + d.size * 0.4) continue;
          if (d.boss){
            // bosses shrug off the one-shot but lose a flat 25% per strike
            if (!s.hitBosses.has(d)){
              s.hitBosses.add(d);
              damage(d, d.maxHp * AIRSTRIKE.bossFrac, true);
            }
          } else {
            damage(d, d.hp, true); // guaranteed one-shot kill
          }
        }
      }
    }
  }
  G.strikes = G.strikes.filter(s => s.t < s.end);
}
/* poison gas clouds: damage GROUND dinos inside, over time. Flyers rise above
   it; so do bosses and tall long-necked sauropods (Brachiosaurus/Apatosaurus) —
   their heads are well clear of a ground-hugging cloud. */
const gasImmune = d => d.flying || d.boss || d.painter === 'sauropod';
function updateClouds(dt){
  for (const c of G.clouds){
    c.t += dt;
    for (const d of G.dinos){
      if (d.dead || d.leaked || gasImmune(d)) continue;
      const p = dinoPos(d);
      if (hyp(c.x, c.y, p.x, p.y) <= c.r + d.size * 0.35) damage(d, c.dps * dt, true, c.tower);
    }
  }
  G.clouds = G.clouds.filter(c => c.t < c.dur);
}

/* ---------------- Omega — robotic T-Rex show-stopper ---------------- */
const omegaUnlocked = () => (G.wave + 1) >= OMEGA.unlock;
function updateOmegaCard(){
  const el = $('#omegaCard');
  if (!el) return;
  const spent = G.omegaUsed >= OMEGA.maxUses, active = !!G.omega, locked = !omegaUnlocked();
  el.classList.toggle('locked', locked || spent || active);
  el.classList.toggle('cant', !locked && !spent && !active && G.cash < OMEGA.cost);
  el.querySelector('.cost').textContent =
    locked ? `🔒 Wave ${OMEGA.unlock}` :
    active ? '⚡ RAMPAGING' :
    spent ? 'DEPLETED' :
    `$${fmt(OMEGA.cost)} · ${OMEGA.maxUses - G.omegaUsed} left`;
}
function deployOmega(){
  if (!omegaUnlocked() || G.omegaUsed >= OMEGA.maxUses || G.omega || G.cash < OMEGA.cost){ SFX.error(); return; }
  G.cash -= OMEGA.cost;
  G.omegaUsed++;
  // deploy on the lane with the most live grounded dinos (max carnage)
  let pathI = 0, best = -1;
  for (let i = 0; i < G.paths.length; i++){
    let n = 0;
    for (const d of G.dinos) if (!d.dead && !d.leaked && d.pathI === i) n++;
    if (n > best){ best = n; pathI = i; }
  }
  const len = G.paths[pathI].len;
  G.omega = {
    pathI, dist: len, speed: OMEGA.speed, hp: OMEGA.durability, maxHp: OMEGA.durability,
    phase: 0, turn: -1, dirT: -1, pitch: 0, t: 0, entrance: 0.8, lastStep: -1, hitBosses: new Set(),
    painter: 'theropod', size: OMEGA.size, flying: false,
    pal: {body: '#8f98a6', belly: '#c7cedb', accent: '#3fb0ff'},
    feat: {bigHead: true, glowEyes: true},
  };
  const p = samplePath(G.paths[pathI], len);          // materialise at the exit
  G.shake = Math.max(G.shake, 16); G.flashT = 0.6;
  addFx('shock', p.x, p.y, 130); addFx('boom', p.x, p.y, 90);
  for (let i = 0; i < 8; i++) addFx('spark', p.x + rand(-40, 40), p.y + rand(-40, 40), 8);
  SFX.roar(); SFX.boom();
  G.banner = {text: 'Ω OMEGA', sub: 'THE MACHINE AWAKENS', t: 2.6};
  saveRun();
  updateHUD();
}
function updateOmega(dt){
  const o = G.omega; if (!o) return;
  o.t += dt;
  if (o.entrance > 0){ o.entrance -= dt; return; }    // brief rear-up before it stomps off
  const path = G.paths[o.pathI];
  o.dist -= o.speed * dt;
  o.phase += dt * 5;
  const pp = samplePath(path, Math.max(0, o.dist));
  const moveAng = pp.ang + Math.PI;                   // it walks BACKWARD, toward the entrance
  const cosA = Math.cos(moveAng);
  if (Math.abs(cosA) > 0.15) o.dirT = cosA > 0 ? 1 : -1;
  o.turn += clamp(o.dirT - o.turn, -dt * 7, dt * 7);
  let pitchT = o.dirT > 0 ? moveAng : Math.PI - moveAng;
  while (pitchT > Math.PI) pitchT -= Math.PI * 2;
  while (pitchT < -Math.PI) pitchT += Math.PI * 2;
  o.pitch += clamp(pitchT - o.pitch, -dt * 3.5, dt * 3.5);
  const step = Math.floor(o.phase / Math.PI);
  if (step !== o.lastStep){ o.lastStep = step; G.shake = Math.max(G.shake, 2.6); addFx('step', pp.x, pp.y + 4, o.size * 0.4); }
  // combat: obliterate grounded dinos in its lane within reach
  const reach = o.size * 0.75;
  for (const d of G.dinos){
    if (d.dead || d.leaked || d.pathI !== o.pathI) continue;
    const p = dinoPos(d);
    if (hyp(pp.x, pp.y, p.x, p.y) > reach + d.size * 0.5) continue;
    if (d.boss){
      if (!o.hitBosses.has(d)){
        o.hitBosses.add(d);
        damage(d, d.maxHp * OMEGA.bossFrac, true);    // bosses only lose a slice, and survive
        o.hp -= OMEGA.bossCost;
        G.shake = Math.max(G.shake, 8);
        addFx('boom', p.x, p.y, 40); addFx('spark', p.x, p.y, 10); SFX.zap();
      }
    } else {
      damage(d, d.hp + 1, true);                       // one-shot
      o.hp -= (d.size >= 34 ? OMEGA.bigCost : 1);
      addFx('spark', p.x, p.y - d.size * 0.4, 6);
    }
  }
  if (o.hp <= 0){                                       // worn down by the horde → destroyed
    G.shake = Math.max(G.shake, 14); G.flashT = 0.4;
    addFx('boom', pp.x, pp.y, 110); addFx('shock', pp.x, pp.y, 130);
    for (let i = 0; i < 10; i++) addFx('spark', pp.x + rand(-50, 50), pp.y + rand(-50, 50), 8);
    SFX.boom(); SFX.bossDie();
    addText(pp.x, pp.y - o.size, 'Ω OMEGA DOWN', '#ff6b6b', 16);
    G.omega = null; updateHUD();
  } else if (o.dist <= 0){                              // reached the entrance → stomps off
    G.omega = null; updateHUD();
  }
}
function drawOmega(ctx){
  const o = G.omega; if (!o) return;
  const p = samplePath(G.paths[o.pathI], Math.max(0, o.dist));
  const rear = o.entrance > 0 ? -Math.min(0.25, (0.8 - o.entrance) * 0.7) : 0;
  const pulse = 0.6 + 0.4 * Math.sin(G.time * 6);
  // energy aura
  ctx.fillStyle = `rgba(80,175,255,${0.13 * pulse})`;
  ctx.beginPath(); ctx.arc(p.x, p.y - o.size * 0.5, o.size * 1.15, 0, Math.PI * 2); ctx.fill();
  drawDino(ctx, o, p.x, p.y, o.turn, o.phase, 1, o.pitch + rear);
  // glowing chest core (robotic accent)
  ctx.fillStyle = `rgba(120,210,255,${0.75 * pulse})`;
  ctx.beginPath(); ctx.arc(p.x, p.y - o.size * 0.62, o.size * 0.17, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(225,248,255,0.95)';
  ctx.beginPath(); ctx.arc(p.x, p.y - o.size * 0.62, o.size * 0.07, 0, Math.PI * 2); ctx.fill();
  // durability bar + label
  const w = o.size * 1.9, y0 = p.y - o.size * 1.75;
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(p.x - w/2, y0, w, 6);
  const g = ctx.createLinearGradient(p.x - w/2, 0, p.x + w/2, 0);
  g.addColorStop(0, '#3fb0ff'); g.addColorStop(1, '#a6ecff');
  ctx.fillStyle = g; ctx.fillRect(p.x - w/2, y0, w * clamp(o.hp / o.maxHp, 0, 1), 6);
  ctx.strokeStyle = 'rgba(180,230,255,0.6)'; ctx.lineWidth = 1; ctx.strokeRect(p.x - w/2, y0, w, 6);
  ctx.font = 'bold 10px Verdana, sans-serif'; ctx.textAlign = 'center';
  ctx.fillStyle = '#bfe6ff'; ctx.fillText('Ω OMEGA', p.x, y0 - 3);
}

/* ---------------- HUD / UI ---------------- */
function updateHUD(){
  $('#hCash').textContent = save.settings.unlimitedCash ? '$∞' : '$' + fmt(G.cash);
  $('#hDna').textContent = fmt(save.dna) + ' DNA';
  $('#hWave').textContent = `Wave ${G.wave}/${WAVES_PER_LEVEL}`;
  $('#hLives').textContent = '❤ ' + Math.max(0, Math.ceil(G.lives));
  $('#hLives').classList.toggle('low', G.lives <= G.maxLives * 0.25);
  $('#invBadge').classList.toggle('hidden', !save.settings.invincible);
  $('#btnSkip').classList.toggle('hidden', !save.settings.levelSkip);
  const sb = $('#streakBadge'), showStreak = G.state === 'playing' && G.streak > 1.001;
  sb.classList.toggle('hidden', !showStreak);
  if (showStreak){
    sb.textContent = `🔥 ×${G.streak.toFixed(1)}`;
    sb.classList.toggle('hot', G.streak >= STREAK_MAX - 0.001);
  }
  $('#btnWave').disabled = G.waveActive || G.over;
  $('#btnWave').textContent = G.waveActive ? '⚔ Wave in progress'
    : (G.autoTimer > 0 ? (G.wave === 0 ? `▶ First wave in ${Math.ceil(G.autoTimer)}…` : `▶ Next in ${Math.ceil(G.autoTimer)}…`)
    : '▶ Start Wave ' + (G.wave + 1));
  updateStartPrompt();
  $$('#speedBtns button').forEach(b => b.classList.toggle('on', +b.dataset.s === G.speed && !G.paused));
  $('#speedCycle').textContent = G.speed + '×';
  $('#speedCycle').classList.toggle('on', G.speed > 1 && !G.paused);
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
  updateOmegaCard();
  // keep the upgrade button in sync with cash while a tower is selected
  if (G.selected) renderTowerPanel();
}
/* onboarding banner: prompt to place a weapon before wave 1, then count it in */
function updateStartPrompt(){
  const el = $('#startPrompt');
  if (!el) return;
  const prep = G.state === 'playing' && G.wave === 0 && !G.waveActive && !G.over;
  el.classList.toggle('hidden', !prep);
  if (!prep) return;
  const counting = G.autoTimer > 0;
  el.classList.toggle('counting', counting);
  if (counting){
    el.querySelector('.sp-main').textContent = `⚔ First wave in ${Math.ceil(G.autoTimer)}…`;
    el.querySelector('.sp-sub').textContent = 'Build while you can — or press Start Wave to go now';
  } else {
    el.querySelector('.sp-main').textContent = '🦖 Place a weapon to begin';
    el.querySelector('.sp-sub').textContent = 'Pick one from the Armory, then tap the map';
  }
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
    // Drag a weapon onto the map (range preview follows) to drop it, or tap to
    // select then tap the map. A mostly-VERTICAL drag on a card just scrolls the
    // shop (touch-action: pan-y), so the panel always catches a scroll.
    card.addEventListener('pointerdown', e => {
      if (G.state !== 'playing') return;
      if (!towerUnlocked(key)){ SFX.error(); return; }
      // no preventDefault: let the browser scroll the shop on a vertical drag
      card._drag = {id: e.pointerId, sx: e.clientX, sy: e.clientY, moved: false, prev: G.placing};
    });
    card.addEventListener('pointermove', e => {
      const d = card._drag; if (!d || e.pointerId !== d.id) return;
      if (!d.moved){
        if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 10) return;
        d.moved = true;                    // began a place-drag (browser didn't scroll)
        try { card.setPointerCapture(e.pointerId); } catch(_){}
        G.placing = key; G.pendingTap = null; G.targeting = null; selectTower(null);
      }
      mouseFromPointer(e);                 // range preview tracks the finger/cursor
    });
    card.addEventListener('pointerup', e => {
      const d = card._drag; card._drag = null; if (!d) return;
      if (d.moved){                        // dragged onto the map → drop it there
        mouseFromPointer(e);
        if (G.mouse.on) placeTower(key, G.mouse.x, G.mouse.y);
        if (!e.shiftKey || G.cash < towerCost(key)) G.placing = null;
        G.mouse.on = false;
      } else {                             // plain tap → toggle selection
        G.placing = (d.prev === key) ? null : key;
        G.pendingTap = null; G.targeting = null; selectTower(null);
      }
      updateHUD();
    });
    card.addEventListener('pointercancel', () => {
      const d = card._drag; card._drag = null;
      if (d && d.moved) G.placing = d.prev; // a scroll interrupted a place-drag → undo it
      G.mouse.on = false; updateHUD();
    });
    el.appendChild(card);
  }
}
/* difficulty selection ----------------------------------------------------- */
let selDiff = 1;                                   // currently-selected difficulty
const unlockedCap = () => save.settings.levelSkip ? MAX_DIFFICULTY : diffUnlocked(save.bestDiff);
function setDiff(v, writeField){
  selDiff = clamp(Math.round(v) || 1, 1, unlockedCap());
  const inp = $('#diffInput');
  if (writeField && inp) inp.value = selDiff;
  const cap = unlockedCap();
  const info = $('#diffInfo');
  if (info) info.innerHTML =
    `Unlocked <b>1–${cap}</b>` +
    (cap < MAX_DIFFICULTY ? ` · beat Level ${cap} to open the next 10` : ' · maxed out') +
    (save.settings.levelSkip ? ' <span class="dim">(level-skip on)</span>' : '') +
    ` &nbsp;·&nbsp; Highest beaten: <b>${save.bestDiff || '—'}</b>`;
  $$('.selD').forEach(e => e.textContent = selDiff);
}
/* draw a small live preview of a zone (its biome colours + the actual path) */
function drawMiniMap(cv, lv){
  if (!cv) return;
  const c = cv.getContext('2d'); if (!c) return;
  const W = cv.width, H = cv.height, sx = W / 1280, sy = H / 720, t = lv.theme;
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, t.grass2 || '#3c5726'); g.addColorStop(1, t.grass || '#31491f');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  // deterministic canopy specks (stable across rebuilds)
  let seed = lv.name.length * 41 + 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  c.fillStyle = t.tree || '#243d18';
  for (let k = 0; k < 30; k++){ const rx = rnd() * W, ry = rnd() * H, r = 1.6 + rnd() * 3; c.globalAlpha = 0.45 + rnd() * 0.4; c.beginPath(); c.arc(rx, ry, r, 0, 7); c.fill(); }
  c.globalAlpha = 1;
  c.lineJoin = c.lineCap = 'round';
  for (const path of lv.paths){
    c.strokeStyle = t.pathEdge || '#5e4a2d'; c.lineWidth = 14 * sx;
    c.beginPath(); path.forEach((p, i) => i ? c.lineTo(p.x * sx, p.y * sy) : c.moveTo(p.x * sx, p.y * sy)); c.stroke();
    c.strokeStyle = t.path || '#8a6f47'; c.lineWidth = 8.5 * sx;
    c.beginPath(); path.forEach((p, i) => i ? c.lineTo(p.x * sx, p.y * sy) : c.moveTo(p.x * sx, p.y * sy)); c.stroke();
  }
  if (lv.night){ c.fillStyle = 'rgba(10,16,34,0.42)'; c.fillRect(0, 0, W, H); }
  const gl = c.createLinearGradient(0, 0, 0, H * 0.55);
  gl.addColorStop(0, 'rgba(255,255,255,0.10)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = gl; c.fillRect(0, 0, W, H * 0.55);
  const gv = c.createLinearGradient(0, H * 0.45, 0, H);
  gv.addColorStop(0, 'rgba(0,0,0,0)'); gv.addColorStop(1, 'rgba(0,0,0,0.42)');
  c.fillStyle = gv; c.fillRect(0, H * 0.45, W, H * 0.55);
}
/* seed the drifting fireflies/spores in the menu background (once) */
function buildMenuFx(){
  const host = $('#menuSpores');
  if (!host || host.childElementCount) return;
  let html = '';
  for (let i = 0; i < 26; i++){
    const dur = 10 + Math.random() * 16;
    html += `<span class="spore${Math.random() < 0.4 ? ' teal' : ''}" style="` +
      `left:${(Math.random() * 100).toFixed(1)}%;bottom:${(-8 + Math.random() * 42).toFixed(0)}%;` +
      `width:${(2 + Math.random() * 4).toFixed(1)}px;height:${(2 + Math.random() * 4).toFixed(1)}px;` +
      `animation-duration:${dur.toFixed(1)}s;animation-delay:${(-Math.random() * dur).toFixed(1)}s;` +
      `--drift:${(Math.random() * 80 - 40).toFixed(0)}px"></span>`;
  }
  host.innerHTML = html;
}
/* giant boss dinosaurs that slowly roam the menu's terrain, far behind the UI */
let menuDinos = [], menuSpawnT = 1.2, menuCv = null, menuCtx = null;
const MENU_BOSSES = ['trex', 'spinosaurus', 'indominus', 'indoraptor', 'giganotosaurus', 'drex'];
function spawnMenuDino(w, h){
  const def = DINOS[MENU_BOSSES[(Math.random() * MENU_BOSSES.length) | 0]];
  const scale = clamp(w / 1280, 0.55, 1.5);
  const size = rand(88, 138) * scale;         // bosses are BIG
  const dir = Math.random() < 0.5 ? 1 : -1;
  const speed = rand(26, 46) * scale;         // slow, majestic
  menuDinos.push({
    painter: def.painter, feat: def.feat, flying: false, size,
    // uniform misty palette (lighter than the near-black jungle) so each distinct
    // boss silhouette reads as a glowing fog-giant wherever the UI doesn't cover it
    pal: {body: '#4c6c5a', belly: '#638672', accent: '#3b5647'},
    x: dir > 0 ? -size * 2.4 : w + size * 2.4,
    y: h * rand(0.40, 0.49),                    // roam a horizon in the open hero backdrop
    // leg-cycle rate matched to actual ground speed (game's speed/size gait
    // relation, unclamped) so the giant's feet plant instead of treadmilling
    vx: speed * dir, dir, phase: rand(0, 6.28), stride: Math.max(0.55, (speed / size) * 2.6),
    alpha: rand(0.74, 0.86),
  });
}
function menuScene(dt){
  const m = $('#menu');
  if (!m || m.classList.contains('hidden')) return;
  const cv = menuCv || (menuCv = document.getElementById('menuDinos'));
  if (!cv) return;
  const ctx = menuCtx || (menuCtx = cv.getContext('2d'));
  if (!ctx) return;
  const w = cv.clientWidth, h = cv.clientHeight;
  if (!w || !h || !isFinite(w) || !isFinite(h)) return;
  // cap the backing buffer so it can never approach a browser's canvas-size limit
  const scale = Math.min(1.5, window.devicePixelRatio || 1, 1600 / w, 1600 / h);
  const bw = Math.max(1, Math.round(w * scale)), bh = Math.max(1, Math.round(h * scale));
  if (cv.width !== bw || cv.height !== bh){ cv.width = bw; cv.height = bh; }
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, w, h);
  menuSpawnT -= dt;
  if (menuDinos.length < 2 && menuSpawnT <= 0){ spawnMenuDino(w, h); menuSpawnT = rand(7, 15); }
  for (const d of menuDinos){
    d.x += d.vx * dt;
    d.phase += dt * d.stride;
    const yy = d.y + Math.sin(d.phase) * d.size * 0.015;
    // soft bioluminescent backlight so the giant reads as a lit silhouette on the dark jungle
    const cyy = yy - d.size * 0.55;
    const rg = ctx.createRadialGradient(d.x, cyy, 0, d.x, cyy, d.size * 2.3);
    rg.addColorStop(0, 'rgba(70,230,196,0.17)');
    rg.addColorStop(0.45, 'rgba(232,185,58,0.08)');
    rg.addColorStop(1, 'transparent');
    ctx.fillStyle = rg;
    ctx.fillRect(d.x - d.size * 2.4, cyy - d.size * 2.4, d.size * 4.8, d.size * 4.8);
    drawDino(ctx, d, d.x, yy, d.dir, d.phase, d.alpha, 0);
  }
  menuDinos = menuDinos.filter(d => d.x > -d.size * 3.2 && d.x < w + d.size * 3.2);
}
function buildMenu(){
  const got = ACHIEVEMENTS.filter(a => save.ach && save.ach[a.key]).length;
  $('#verChip').innerHTML = `v${VERSION} · 📜 what's new`;
  $('#menuDna').innerHTML = `🧬 <b>${fmt(save.dna)}</b> DNA`;
  const sb = $('#statBest'); if (sb) sb.innerHTML = save.bestDiff ? `⛰️ Reached <b>Lv ${save.bestDiff}</b>` : `🌱 New ranger`;
  const sa = $('#statAch'); if (sa) sa.innerHTML = `🏆 <b>${got}/${ACHIEVEMENTS.length}</b> trophies`;
  // pulse the Lab button whenever any weapon or base upgrade is affordable
  const canBuy = Object.keys(TOWERS).some(k => save.dna >= wlvCost(TOWERS[k], wlv(k)))
    || META.some(m => save.dna >= metaCost(m, mlvl(m.key)));
  $('#btnLab').classList.toggle('attention', canBuy);
  $('#btnLab').innerHTML = canBuy ? '🧬 Research Lab — upgrades ready!' : '🧬 Research Lab';
  if (!selDiff || selDiff < 1) selDiff = unlockedCap();
  setDiff(selDiff, true);
  const el = $('#levelCards');
  el.innerHTML = '';
  if (save.run){
    const r = save.run, lv = LEVELS[r.levelIdx];
    const card = document.createElement('div');
    card.className = 'levelCard resume';
    card.innerHTML =
      `<canvas class="lvThumb" width="416" height="192"></canvas>` +
      `<div class="lvBody">` +
      `<div class="lvNum">▶ Continue run</div>` +
      `<div class="lvName">${lv.name} · Lv ${r.difficulty || 1}</div>` +
      `<div class="lvSub">Wave ${r.wave}/100 · $${fmt(r.cash)} · ${r.towers.length} weapons</div>` +
      `<div class="lvBest">Click to pick up where you left off</div></div>`;
    drawMiniMap(card.querySelector('.lvThumb'), lv);
    card.onclick = () => startLevel(r.levelIdx, 'resume');
    el.appendChild(card);
  }
  LEVELS.forEach((lv, i) => {
    const mb = save.mapBest[i] || 0;
    const card = document.createElement('div');
    card.className = 'levelCard';
    card.innerHTML =
      `<canvas class="lvThumb" width="416" height="192"></canvas>` +
      `<div class="lvBody">` +
      `<div class="lvNum">📍 Zone ${i+1}</div>` +
      `<div class="lvName">${lv.name}</div>` +
      `<div class="lvSub">${lv.sub}</div>` +
      `<div class="lvBest">${mb > 0 ? '★ Best cleared here: Lv ' + mb : 'Not cleared yet'}</div>` +
      `<div class="lvPlay">▶ Deploy at Level <b class="selD">${selDiff}</b></div></div>`;
    drawMiniMap(card.querySelector('.lvThumb'), lv);
    card.onclick = () => {
      setDiff(selDiff, true);
      if (save.run && save.run.wave >= 1 &&
          !confirm(`You have a saved run (${LEVELS[save.run.levelIdx].name}, Lv ${save.run.difficulty || 1}, wave ${save.run.wave}). Starting a new run will discard it. Continue?`)) return;
      startLevel(i, 'fresh', selDiff);
    };
    el.appendChild(card);
  });
  const btn = $('#btnAch');
  if (btn) btn.textContent = `🏆 Achievements ${got}/${ACHIEVEMENTS.length}`;
}
function buildAchievements(){
  const list = $('#achList');
  if (!list) return;
  const got = ACHIEVEMENTS.filter(a => save.ach && save.ach[a.key]).length;
  const prog = $('#achProg');
  if (prog) prog.textContent = `${got} / ${ACHIEVEMENTS.length}`;
  // every achievement is always listed — name, description and locked/unlocked
  // status — so the player can see exactly what exists and what to target
  list.innerHTML = ACHIEVEMENTS.map(a => {
    const done = !!(save.ach && save.ach[a.key]);
    return `<div class="achRow${done ? ' got' : ''}">` +
             `<div class="achIco">${a.icon}</div>` +
             `<div class="achInfo"><b>${a.name}</b><br><small>${a.desc}</small>` +
               (a.dna ? ` <span class="achDna">🧬 +${fmt(a.dna)} DNA</span>` : '') + `</div>` +
             `<div class="achStat">${done ? '✓ Unlocked' : '🔒 Locked'}</div>` +
           `</div>`;
  }).join('');
}
function checkWeaponAch(){
  const keys = Object.keys(TOWERS);
  const maxL = Math.max(...keys.map(k => wlv(k)));
  if (maxL >= 10) unlockAch('wlv_10');
  if (maxL >= 25) unlockAch('wlv_25');
  if (maxL >= 50) unlockAch('wlv_50');
  if (keys.every(k => wlv(k) >= 5)) unlockAch('arsenal5');
}
const mulStr = m => m >= 100 ? '×' + fmt(m) : '×' + m.toFixed(2);
function refreshLabDna(){
  $('#menuDna').innerHTML = `🧬 <b>${fmt(save.dna)}</b> DNA`;
}
function labRow(el, ico, name, tier, desc, cost, nextLabel, onBuy){
  const afford = save.dna >= cost;
  const row = document.createElement('div');
  row.className = 'labRow';
  row.innerHTML =
    `<div class="labIco">${ico}</div>` +
    `<div class="labInfo"><b>${name}</b> <span class="tier">${tier}</span><br><small>${desc}</small></div>` +
    `<button class="labBuy" ${afford ? '' : 'disabled'}>${nextLabel} · ${fmt(cost)} DNA</button>`;
  row.querySelector('button').onclick = onBuy;
  el.appendChild(row);
}
/* a one-time unlock row: shows a buy button, or a locked-in "✓ Unlocked" once owned */
function labUnlockRow(el, ico, name, tier, desc, cost, unlocked, onBuy){
  const row = document.createElement('div');
  row.className = 'labRow' + (unlocked ? ' owned' : '');
  row.innerHTML =
    `<div class="labIco">${ico}</div>` +
    `<div class="labInfo"><b>${name}</b> <span class="tier">${tier}</span><br><small>${desc}</small></div>` +
    (unlocked
      ? `<button class="labBuy owned" disabled>✓ Unlocked</button>`
      : `<button class="labBuy" ${save.dna >= cost ? '' : 'disabled'}>Unlock · ${fmt(cost)} DNA</button>`);
  if (!unlocked) row.querySelector('button').onclick = onBuy;
  el.appendChild(row);
}
function buildLab(){
  $('#labDna').textContent = fmt(save.dna) + ' DNA';
  const el = $('#labList');
  el.innerHTML = '';
  // base upgrades (health + starting cash)
  for (const m of META){
    const L = mlvl(m.key), cost = metaCost(m, L);
    const now = m.per * L, next = m.per * (L + 1), unit = m.key === 'start_cash' ? '$' : '';
    labRow(el, m.icon, m.name, `Lv ${L}`,
      `Now +${unit}${now} → +${unit}${next} next level`,
      cost, `Lv ${L + 1}`,
      () => {
        const c = metaCost(m, mlvl(m.key));
        if (save.dna < c) return;
        save.dna -= c; save.wlv[m.key] = mlvl(m.key) + 1;
        persist(); SFX.upgrade(); buildLab(); refreshLabDna();
      });
  }
  // double sell value (one-time): 25% refund → 50%
  labUnlockRow(el, '💰', 'Double Sell Value', sellDoubled() ? '×2' : 'Locked',
    sellDoubled()
      ? 'Selling a weapon refunds 50% of what you paid (up from 25%).'
      : 'Doubles the refund on every weapon you sell — from 25% back up to 50%. Reposition freely.',
    SELL_DOUBLE_COST, sellDoubled(),
    () => {
      if (sellDoubled() || save.dna < SELL_DOUBLE_COST) return;
      save.dna -= SELL_DOUBLE_COST; save.wlv['sell_double'] = 1;
      persist(); SFX.upgrade(); buildLab(); refreshLabDna();
    });
  // weapon levels — each weapon gets a damage-level row + a one-time +10% range unlock
  for (const [key, def] of Object.entries(TOWERS)){
    const L = wlv(key), cost = wlvCost(def, L);
    labRow(el, def.icon, def.name, `Lv ${L}`,
      `Damage ${mulStr(wlvDmgMult(L))} now → ${mulStr(wlvDmgMult(L + 1))} next level`,
      cost, `Lv ${L + 1}`,
      () => {
        const c = wlvCost(def, wlv(key));
        if (save.dna < c) return;
        save.dna -= c; save.wlv[key] = wlv(key) + 1;
        persist(); SFX.upgrade();
        checkWeaponAch();   // may award a weapon-level trophy (and its DNA bonus)
        buildLab(); refreshLabDna();
      });
    const rUp = rangeUnlocked(key), rCost = rangeUnlockCost();
    labUnlockRow(el, '🎯', def.name + ' — Range', rUp ? '+10%' : 'Range',
      rUp
        ? `Range extended +10% (${Math.round(def.range)} → ${Math.round(def.range * RANGE_UP_MULT)}).`
        : `Permanently extend ${def.name}'s range by 10% (${Math.round(def.range)} → ${Math.round(def.range * RANGE_UP_MULT)}). Each range unlock raises the price of the rest by ${fmt(RANGE_UP_STEP)} DNA.`,
      rCost, rUp,
      () => {
        if (rangeUnlocked(key) || save.dna < rangeUnlockCost()) return;
        save.dna -= rangeUnlockCost(); save.wlv['range_' + key] = 1;
        persist(); SFX.upgrade(); buildLab(); refreshLabDna();
      });
  }
}
/* ---------------- tips / field manual ---------------- */
const TIPS = [
  '<b>Hotkeys:</b> 1–9 select weapons, <b>Space</b> starts a wave or pauses, <b>M</b> mutes, <b>Esc</b> cancels. Hold <b>Shift</b> while building to place several.',
  '<b>Upgrades:</b> click a placed weapon to upgrade it (2–3 levels max — each level is a big jump in damage and fire rate, and the hardware visibly grows). A weapon\'s range doesn\'t grow with upgrades (only the 💣 Mortar does), but every weapon has a one-time <b>+10% range</b> unlock in the Research Lab. Upgrades cost more than the weapon itself, and each level costs more than the last.',
  '<b>The armory grows with you:</b> heavier weapons unlock as you survive deeper waves — the shop card shows the unlock wave on locked gear.',
  '<b>Duplicates cost extra:</b> every additional copy of the same weapon is pricier than the last (mortars especially). Diversify your arsenal.',
'<b>✈️ Air Strike</b> (from wave 50): jets carpet-bomb the ENTIRE zone in a rolling cluster-bomb wave — it one-shot-kills every dinosaur on the field (even flyers) and strips 25% off any boss. Max two calls per run, and the second costs more. Save them for boss waves or a swarm that\'s about to break through.',
  '<b>🦾 Omega</b> (from wave 75, once per run): unleashes a colossal robotic T-Rex that materialises at the exit and stomps up your busiest lane, one-shotting every dinosaur it touches. Each kill wears its armor down, so a big horde can destroy it — and bosses only lose 30% and keep coming. A pricey show-stopper; save it for a wave that\'s about to overwhelm you.',
  '<b>Targeting:</b> the selected weapon\'s "Target" button cycles FIRST / LAST / STRONG / CLOSE. Snipers on STRONG melt tanks; slows on FIRST hold the line.',
  '<b>Flyers</b> (Pteranodons & friends) can only be hit by air-capable weapons — Flame Throwers and Mortars can\'t touch them.',
  '<b>Armor</b> (Ankylosaurus, Triceratops) shrugs off weak hits. 🎯 Snipers pierce armor completely.',
  '<b>☣️ Mason\'s Gas</b> lays down a lingering poison cloud that ignores armor and shreds packs of ground dinos — but flyers, bosses, and tall long-necks (like Brachiosaurus) rise above it and take no poison.',
  '<b>The Indominus Rex turns invisible.</b> A couple of seconds after it storms in, it vanishes completely — and while unseen it takes NO damage at all. Only a 📡 Sonic Emitter\'s pulse reveals AND exposes it, so plant one right on its path before wave 50 (it also returns on waves 80 and 90). No emitter, no kill.',
  '<b>💣 Mortars</b> have a minimum range: nothing too close can be hit. Place them behind your front line and cover their blind spot.',
  '<b>🚀 Missile Batteries</b> gain a rocket per upgrade level, and the whole salvo slams the same dinosaur — big concentrated splash damage.',
  '<b>Selling</b> refunds 25% of what you invested — or 50% with the <b>Double Sell Value</b> unlock in the Research Lab. Enough to reposition, not to farm.',
  '<b>Difficulty 1–1000:</b> pick a map and a level. Every kill drops DNA (much more at higher levels); spend it in the 🧬 Research Lab to level your weapons — with no cap. Beat the highest unlocked level (10, 20, 30…) to open the next block.',
  '<b>🔥 Clean-play streak:</b> clear waves without letting a single dinosaur leak and your DNA bonus multiplier climbs (up to ×2.5), boosting everything you earn. One leak knocks it back down — tidy, no-leak play pays off big over a run.',
  '<b>Finish strong:</b> clearing all 100 waves adds bonus DNA on top — a victory bonus, more for the base health you have left, and an extra flawless bonus if your base never took a single hit.',
  '<b>🏆 Achievements</b> each pay a one-time DNA bonus — chase the difficulty milestones (25, 50, 75, 100…), map clears, and weapon levels. Runs that use a developer cheat don\'t count.',
  '<b>Weapon levels vs. in-run upgrades:</b> Lab weapon levels are permanent and multiply damage forever; the click-to-upgrade on a placed tower is a small, run-only boost paid with cash. You need both to reach the top levels.',
  '<b>DNA is never lost.</b> It banks from kills even if the run fails, so a losing run still funds the weapon levels you need to come back stronger.',
  '<b>Your run auto-saves</b> between waves — close the tab and the map shows a "Continue run" card. Back up progress with Settings → Copy save code.',
  '<b>Practice mode:</b> Settings → 🛡 Invincibility lets you experiment with layouts, and 2× / 4× / 10× speed keeps long waves moving (10× is great once a wave is clearly won).',
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

let devUnlocked = false;   // has the dev-options password been entered this session?
function syncSettings(){
  // if a cheat is already active (e.g. resumed save), the dev panel is already
  // "unlocked" — show it rather than hiding an active cheat behind the password
  const anyCheat = save.settings.invincible || save.settings.unlimitedCash || save.settings.levelSkip;
  if (anyCheat) devUnlocked = true;
  $('#optDev').checked = devUnlocked;
  $('#devOptions').classList.toggle('hidden', !devUnlocked);
  $('#optInv').checked = save.settings.invincible;
  $('#optCash').checked = save.settings.unlimitedCash;
  $('#optSkip').checked = save.settings.levelSkip;
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
  let dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000)); // never negative — a backwards clock must not rewind fx/motion
  lastT = now;
  if (G.state !== 'playing'){ if (G.state === 'menu') try { menuScene(dt); } catch (e) {} return; }
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
  if (save.settings.unlimitedCash) G.cash = 1e9; // top up every tick so nothing is ever unaffordable
  // sparse ambient jungle vocalization while dinos are roaming the field
  if (G.waveActive && G.dinos.length){
    G.voxAmb = (G.voxAmb > 0 ? G.voxAmb : rand(4, 8)) - dt;
    if (G.voxAmb <= 0){ G.voxAmb = rand(5, 10); if (voxGate()) (Math.random() < 0.55 ? SFX.snarl : SFX.bellow)(); }
  }
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
  updateClouds(dt);
  updateOmega(dt);
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
}

function render(dt){
  G.time += dt;
  ctx.save();
  if (G.shake > 0) ctx.translate(rand(-G.shake, G.shake), rand(-G.shake, G.shake));
  // decay shake here (in render, which always runs) rather than in step —
  // step is skipped once the run is over, so a leftover shake used to freeze
  // on and rattle the victory/defeat screen forever
  G.shake = Math.max(0, G.shake - dt * 18);
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

  // poison gas clouds — bubbling toxic haze on the ground (dinos walk through)
  for (const c of G.clouds){
    const k = c.t / c.dur;
    const a = 0.42 * clamp(Math.min(c.t / 0.5, (c.dur - c.t) / 0.8), 0, 1); // fade in then out
    if (a <= 0) continue;
    for (let i = 0; i < 5; i++){
      const ang = c.seed + i * 2.2 + G.time * 0.6;
      const off = c.r * 0.32;
      const ox = Math.cos(ang) * off, oy = Math.sin(ang) * off * 0.7;
      const rr = c.r * (0.5 + 0.16 * Math.sin(G.time * 1.4 + i + c.seed));
      const g = ctx.createRadialGradient(c.x + ox, c.y + oy, 0, c.x + ox, c.y + oy, rr);
      g.addColorStop(0,   `rgba(168,224,74,${a * 0.85})`);
      g.addColorStop(0.55,`rgba(120,182,52,${a * 0.45})`);
      g.addColorStop(1,   `rgba(92,150,40,0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(c.x + ox, c.y + oy, rr, 0, Math.PI*2); ctx.fill();
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
    const hidden = d.cloaked && d.revealT <= 0;  // camouflaged & not currently revealed
    const alpha = hidden ? 0.08 : 1;
    // rearing back during the entrance roar
    const pitch = d.pitch - (d.entranceT > 0 ? Math.min(0.22, (2.2 - d.entranceT) * 0.6) : 0);
    drawDino(ctx, d, p.x, p.y, d.turn, d.phase, alpha, pitch);
    // while cloaked, draw nothing else — no health bar, boss aura, or status
    // tints that would betray its position (a Sonic Emitter must reveal it)
    if (hidden) return;
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
      case 'airburst': { // cluster-bomb fireball: white-hot core → orange ball → shock ring
        const rr = f.r * (0.55 + k * 0.7);
        const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, rr);
        g.addColorStop(0,   `rgba(255,255,225,${0.92*(1-k)})`);
        g.addColorStop(0.4, `rgba(255,170,55,${0.8*(1-k)})`);
        g.addColorStop(1,   `rgba(150,35,15,0)`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(f.x, f.y, rr, 0, Math.PI*2); ctx.fill();
        // expanding shock ring
        ctx.strokeStyle = `rgba(255,120,50,${0.55*(1-k)})`; ctx.lineWidth = 4 * (1 - k);
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.3 + k*1.15), 0, Math.PI*2); ctx.stroke();
        // white-hot flash in the first instant
        if (k < 0.35){
          ctx.fillStyle = `rgba(255,255,255,${0.9*(1 - k/0.35)})`;
          ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 0.4 * (1 - k), 0, Math.PI*2); ctx.fill();
        }
        break;
      }
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
      case 'gaspuff': { // little green toot out the nozzle
        const rr = f.r * (0.5 + k * 1.3);
        const px = f.x + Math.cos(f.ang) * k * 14, py = f.y + Math.sin(f.ang) * k * 14;
        const g = ctx.createRadialGradient(px, py, 0, px, py, rr);
        g.addColorStop(0, `rgba(180,230,90,${0.5*(1-k)})`);
        g.addColorStop(1, `rgba(120,180,50,0)`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(px, py, rr, 0, Math.PI*2); ctx.fill();
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

  // Omega stomps over everything — it's the star of the show
  drawOmega(ctx);

  // air strike: inbound reticle → F-22 flyby → falling cluster canisters
  for (const s of G.strikes){
    // pulsing mark on the target until the first canister lands
    if (s.t < s.jets[0].drop + 0.6){
      const pl = (Math.sin(G.time * 9) + 1) / 2;
      ctx.strokeStyle = `rgba(255,70,45,${0.5 + 0.4 * pl})`;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([10, 8]); ctx.lineDashOffset = -G.time * 60;
      ctx.beginPath(); ctx.arc(s.x, s.y, 150, 0, Math.PI*2); ctx.stroke();
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
    const rng = def.range * rangeUpMult(G.placing);   // base range + any lab range unlock
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

  // air-strike targeting reticle — the whole zone is the blast area, so we
  // outline the entire field and mark ground zero at the cursor
  if (G.targeting === 'strike' && G.mouse.on){
    const canCall = G.cash >= airCost();
    ctx.strokeStyle = canCall ? 'rgba(255,80,50,0.7)' : 'rgba(150,150,150,0.55)';
    ctx.lineWidth = 3; ctx.setLineDash([16, 10]); ctx.lineDashOffset = -G.time * 40;
    ctx.strokeRect(10, 10, W - 20, H - 20);
    ctx.setLineDash([]); ctx.lineDashOffset = 0;
    // epicenter crosshair + pulse ring at the cursor
    const pl = (Math.sin(G.time * 8) + 1) / 2;
    ctx.strokeStyle = canCall ? `rgba(255,90,55,${0.6 + 0.35*pl})` : 'rgba(150,150,150,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(G.mouse.x, G.mouse.y, 26 + pl * 8, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(G.mouse.x - 18, G.mouse.y); ctx.lineTo(G.mouse.x + 18, G.mouse.y);
    ctx.moveTo(G.mouse.x, G.mouse.y - 18); ctx.lineTo(G.mouse.x, G.mouse.y + 18); ctx.stroke();
    ctx.font = 'bold 13px Verdana, sans-serif'; ctx.textAlign = 'center';
    const msg = canCall ? '✈ CLICK TO CARPET THE ENTIRE ZONE' : 'NOT ENOUGH CASH';
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillText(msg, G.mouse.x + 1, G.mouse.y - 43);
    ctx.fillStyle = canCall ? '#ff9a7a' : '#c9c9c9';
    ctx.fillText(msg, G.mouse.x, G.mouse.y - 44);
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
    const a = clamp(Math.min(((G.banner.t0 || 3.4) - G.banner.t) * 4, G.banner.t * 1.8), 0, 1);
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
      if (c.t < 3) G.shake = Math.max(G.shake, 1.5); // settle the screen shake after ~3s
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
/* map a pointer anywhere on screen to canvas coords; G.mouse.on = over the map */
function mouseFromPointer(e){
  const r = cv.getBoundingClientRect();
  if (!r.width) return;
  G.mouse.x = clamp((e.clientX - r.left) * (W / r.width), 0, W);
  G.mouse.y = clamp((e.clientY - r.top) * (H / r.height), 0, H);
  G.mouse.on = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
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
  // select tower under cursor (tapping the selected one again closes the menu)
  let hit = null;
  for (const t of G.towers) if (hyp(p.x, p.y, t.x, t.y) < 24) hit = t;
  selectTower(hit === G.selected ? null : hit);
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
$('#btnSkip').onclick = () => { skipWave(); };
$('#btnPause').onclick = togglePause;
function toggleMute(){
  save.settings.mute = !save.settings.mute;
  persist();
  if ($('#optMute')) $('#optMute').checked = save.settings.mute;
  updateHUD();
}
$('#btnMute').onclick = toggleMute;
$$('#speedBtns button').forEach(b => b.onclick = () => { G.speed = +b.dataset.s; G.paused = false; updateHUD(); });
$('#speedCycle').onclick = () => { const seq = [1, 2, 4, 10]; G.speed = seq[(seq.indexOf(G.speed) + 1) % seq.length] || 1; G.paused = false; updateHUD(); };
$('#btnMenu').onclick = () => { if (!G.over) saveRun(); toMenu(); };
$('#up_main').onclick = () => upgrade();
$('#airCard').onclick = () => {
  if (!airUnlocked() || G.airUsed >= AIRSTRIKE.maxUses){ SFX.error(); return; }
  G.targeting = (G.targeting === 'strike') ? null : 'strike';
  G.placing = null; G.pendingTap = null;
  selectTower(null);
  updateHUD();
};
$('#omegaCard').onclick = () => { G.placing = null; G.pendingTap = null; G.targeting = null; selectTower(null); deployOmega(); };
$('#tpClose').onclick = () => selectTower(null);
$('#tpMute').onclick = () => {
  const t = G.selected; if (!t) return;
  if (!save.settings.mutedWeapons) save.settings.mutedWeapons = {};
  save.settings.mutedWeapons[t.key] = !weaponMuted(t.key);
  persist();
  renderTowerPanel(); positionTowerPop(t);
};
$('#tpSell').onclick = armOrSell;
$('#tpMode').onclick = () => {
  const modes = ['first', 'last', 'strong', 'close'];
  const t = G.selected; if (!t) return;
  t.mode = modes[(modes.indexOf(t.mode) + 1) % modes.length];
  renderTowerPanel(); positionTowerPop(t);
};
const openLab = () => { buildLab(); $('#lab').classList.remove('hidden'); };
// difficulty picker (main menu)
$$('#diffCtl button[data-d]').forEach(b => b.onclick = () => setDiff(selDiff + parseInt(b.dataset.d, 10), true));
$('#diffMax').onclick = () => setDiff(unlockedCap(), true);
$('#diffInput').oninput = () => setDiff(parseInt($('#diffInput').value, 10) || 1, false);
$('#diffInput').onchange = () => setDiff(parseInt($('#diffInput').value, 10) || 1, true);
$('#btnTips').onclick = () => { buildTips(); $('#tips').classList.remove('hidden'); };
$('#tipsClose').onclick = () => $('#tips').classList.add('hidden');
$('#btnAch').onclick = () => { buildAchievements(); $('#achievements').classList.remove('hidden'); };
$('#achClose').onclick = () => $('#achievements').classList.add('hidden');
$('#verChip').onclick = () => { buildChangelog(); $('#changelog').classList.remove('hidden'); };
$('#clogClose').onclick = () => $('#changelog').classList.add('hidden');
$('#btnLab').onclick = openLab;
$('#menuDna').onclick = openLab;
$('#vLab').onclick = openLab;
$('#goLab').onclick = openLab;
const openAch = () => { buildAchievements(); $('#achievements').classList.remove('hidden'); };
$('#vAch').onclick = openAch;
$('#goAch').onclick = openAch;
$('#labClose').onclick = () => { $('#lab').classList.add('hidden'); buildMenu(); };
$$('.modalX').forEach(b => b.onclick = () => {
  const m = b.closest('.modal');
  m.classList.add('hidden');
  if (m.id === 'lab') buildMenu();
});
$('#btnSettings').onclick = () => { syncSettings(); $('#settings').classList.remove('hidden'); };
$('#setClose').onclick = () => { $('#settings').classList.add('hidden'); };
$('#sceneToggle').onclick = () => {
  const m = $('#menu'), wasDay = m.getAttribute('data-scene') === 'day';
  m.setAttribute('data-scene', wasDay ? 'night' : 'day');
  $('#sceneToggle').textContent = wasDay ? '🌙' : '☀️';
};
/* Developer cheats live behind a single password gate: ticking "Developer
   options" asks for the password ONCE and, on success, reveals the individual
   cheats — which then toggle freely (no more per-option prompts). Unticking it
   hides them again and turns every cheat back off so nothing stays secretly on.
   Enabling any cheat mid-run still forfeits this run's achievements. */
function setCheat(key, on){
  save.settings[key] = on;
  if (on && G.state === 'playing') G.runCheated = true;
  persist();
  updateHUD();
}
$('#optDev').onchange = e => {
  if (e.target.checked){
    if (prompt('Enter the developer password to reveal developer options:') !== CHEAT_PASSWORD){
      e.target.checked = false; SFX.error(); return;
    }
    devUnlocked = true;
    $('#devOptions').classList.remove('hidden');
  } else {
    devUnlocked = false;
    save.settings.invincible = save.settings.unlimitedCash = save.settings.levelSkip = false;
    persist(); syncSettings(); updateHUD();
  }
};
$('#optInv').onchange  = e => setCheat('invincible', e.target.checked);
$('#optCash').onchange = e => setCheat('unlimitedCash', e.target.checked);
$('#optSkip').onchange = e => setCheat('levelSkip', e.target.checked);
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
    if (!s || typeof s.dna !== 'number') throw new Error('bad save');
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
$('#goRetry').onclick = () => startLevel(G.levelIdx, 'fresh', G.difficulty);
$('#vMenu').onclick = toMenu;
$('#vNext').onclick = () => {
  const next = G.difficulty + 1;   // climb: next difficulty on the same map
  if (next <= unlockedCap()){ selDiff = next; startLevel(G.levelIdx, 'fresh', next); }
  else toMenu();
};
window.addEventListener('beforeunload', () => { if (G.state === 'playing' && !G.over) saveRun(); });
window.addEventListener('resize', () => { if (G.selected) positionTowerPop(G.selected); });

/* error overlay for easier debugging */
window.onerror = (msg, src, line) => {
  const el = $('#errbox');
  el.classList.remove('hidden');
  el.textContent = 'Error: ' + msg + ' (' + (src || '').split('/').pop() + ':' + line + ')';
};

/* ---------------- boot ---------------- */
initAnalytics();
buildMenuFx();
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

if (new URLSearchParams(location.search).has('menudino')){ // seed roaming menu bosses on-screen for a visual check
  for (let i = 0; i < 3; i++){ spawnMenuDino(innerWidth || 1280, innerHeight || 860); menuDinos[i].x = (innerWidth || 1280) * (0.22 + i * 0.29); }
}
if (new URLSearchParams(location.search).has('lab')){ const lv = new URLSearchParams(location.search).get('lab'); if (lv === 'rich'){ save.dna = 50000; } else if (!isNaN(parseFloat(lv))){ save.dna = parseFloat(lv); } buildLab(); $('#lab').classList.remove('hidden'); }
if (new URLSearchParams(location.search).has('firstwave')){ // preview the onboarding banner
  save.run = null; startLevel(0, 'fresh', 1);
  if (new URLSearchParams(location.search).get('firstwave') === 'count'){
    placeTower('gatling', 420, 260, true);
    for (let s = 0; s < 1.2; s += 0.05) step(0.05); // tick the countdown down a bit
  }
  updateHUD(); G.paused = true;
}
if (new URLSearchParams(location.search).has('settings')){ syncSettings(); $('#settings').classList.remove('hidden'); }
if (new URLSearchParams(location.search).has('ach')){ if (new URLSearchParams(location.search).get('ach') === 'some'){ save.ach = {boss_first:1, wave50:1, secure_0:1, apex:1}; } buildAchievements(); $('#achievements').classList.remove('hidden'); }
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
  if (testParams.has('cheats')){ // preview cheat HUD without the password prompt
    save.settings.unlimitedCash = true; save.settings.levelSkip = true; save.settings.invincible = true;
  }
  if (testParams.has('diff')) save.bestDiff = Math.max(save.bestDiff, (parseInt(testParams.get('diff'), 10) || 1) - 1);
  startLevel(clamp(parseInt(testParams.get('level'), 10) || 0, 0, LEVELS.length - 1), 'fresh', parseInt(testParams.get('diff'), 10) || 1);
  G.cash = 5000;
  placeTower('gatling', 420, 260, true);
  placeTower('flamer', 550, 330, true);
  placeTower('missile', 800, 300, true);
  placeTower('mortar', 900, 490, true);
  placeTower('gas', 150, 210, true); // Mason's Gas, near the path start
  if (testParams.has('pop')){ // preview the tower popup menu over a placed weapon
    const idx = clamp(parseInt(testParams.get('pop'), 10) || 0, 0, G.towers.length - 1);
    const t = G.towers[idx];
    if (testParams.has('upg')) t.ulv = Math.min(TOWERS[t.key].maxUp, parseInt(testParams.get('upg'), 10) || 1);
    if (testParams.has('broke')) G.cash = 0;   // exercise the disabled upgrade look
    setTimeout(() => {
      selectTower(t);
      if (testParams.has('armsell')) armOrSell(); // exercise the sell-confirm look
      G.paused = true;
    }, 60);
  }
  if (testParams.has('ghost')){ // preview the range indicator that follows a placement drag
    G.placing = testParams.get('ghost') !== '1' ? testParams.get('ghost') : 'missile';
    G.mouse.x = 560; G.mouse.y = 300; G.mouse.on = true;
    G.paused = true;
  }
  if (testParams.has('econ')){ // measure DNA earned (per-wave + kills + clear) vs upgrade cost
    const rows = [];
    for (const D of [1, 5, 25, 100]){
      // cumulative DNA by wave W (streakRamp = clean no-leak run)
      const dnaBy = (w, ramp) => {
        let d = 0;
        for (let i = 1; i <= w; i++){
          const st = ramp ? Math.min(STREAK_MAX, 1 + STREAK_STEP * i) : 1;
          d += waveDna(i) * diffDnaMult(D) * st;
          for (const s of buildWave(i)) d += bountyOf(DINOS[s.key], i) * DNA_PER_BOUNTY * diffDnaMult(D) * (s.boss ? 12 : 1);
        }
        return d;
      };
      const upg = wlvCost(TOWERS.gatling, D);
      const w40 = dnaBy(40, false), w70 = dnaBy(70, false), sloppy = dnaBy(100, false);
      const clean = dnaBy(100, true) * (1 + VICTORY_PCT + HEALTH_PCT + FLAWLESS_PCT); // flawless full-health
      rows.push(`D${D} upg=${fmt(upg)}:  die40=${(w40/upg).toFixed(1)}u  die70=${(w70/upg).toFixed(1)}u  | FULL sloppy=${(sloppy/upg).toFixed(1)}u  clean+flawless=${(clean/upg).toFixed(1)}u`);
    }
    const el = $('#errbox'); el.classList.remove('hidden');
    el.style.whiteSpace = 'pre'; el.style.fontSize = '11px'; el.style.textAlign = 'left';
    el.textContent = 'ECON — DNA banked vs one gatling upgrade (u):\n' + rows.join('\n');
    G.paused = true;
  }
  if (testParams.has('omega')){ // stage Omega mid-rampage for a visual check
    G.wave = 80; G.cash = 20000;
    const kinds = ['velociraptor', 'gallimimus', 'carnotaurus', 'triceratops', 'compy'];
    for (let i = 0; i < 26; i++){ spawnDino(kinds[i % kinds.length], 0, false); const d = G.dinos[G.dinos.length - 1]; d.dist = 250 + i * 34; }
    spawnDino('trex', 0, true); const b = G.dinos[G.dinos.length - 1]; b.entranceT = 0; b.dist = 760; G.cinT = 0; G.banner = null;
    deployOmega();
    const t = parseFloat(testParams.get('omega')) || 2.5;
    for (let s = 0; s < t; s += 0.05) step(0.05);
    G.paused = true;
  }
  if (testParams.has('strike')){ // stage an air strike for visual checks
    G.cash = 99999; G.wave = 60;
    launchStrike(640, 430);
    G.wave = 0;
    for (let s = 0; s < (parseFloat(testParams.get('strike')) || 0.6); s += 0.05) step(0.05);
    G.paused = true; // freeze mid-flight so the frame can be inspected
  }
  if (testParams.has('dnatest')){ // cheated runs must bank no DNA (e.g. level-skip farming)
    const before = save.dna;
    save.settings.levelSkip = true;   // a cheat is now active
    for (let i = 0; i < 3; i++) skipWave();
    const el = $('#errbox'); el.classList.remove('hidden');
    el.textContent = `DNATEST dna ${before}→${save.dna} after skipping 3 waves with cheats on (want no change)`;
    G.paused = true;
  }
  if (testParams.has('misl')){ // regression: rockets must not orbit forever near a target
    G.wave = 30;
    placeTower('missile', 760, 300, true); // battery right beside the parked herd
    G.towers.forEach(t => { if (t.key === 'missile') t.ulv = TOWERS.missile.maxUp; });
    // tanky, near-stationary dinos parked on the path next to the batteries (~(700,300))
    for (let i = 0; i < 6; i++){ spawnDino('ankylosaurus', 0, false); const d = G.dinos[G.dinos.length-1]; d.hp = d.maxHp = 5e5; d.speed = 3; d.dist = 1120 + i*10; }
    let maxProjs = 0, maxAge = 0;
    for (let s = 0; s < 12; s += 0.05){ step(0.05); maxProjs = Math.max(maxProjs, G.projs.length); for (const p of G.projs) if (p.kind === 'missile') maxAge = Math.max(maxAge, p.life || 0); }
    const el = $('#errbox'); el.classList.remove('hidden');
    el.textContent = `MISL peak rockets in flight=${maxProjs} · oldest live rocket=${maxAge.toFixed(2)}s (must stay ≤2.5)`;
    G.paused = true;
  }
  if (testParams.has('strikekill')){ // functional check: carpet kills mobs, chips bosses 25%
    G.wave = 60;
    for (let i = 0; i < 12; i++) spawnDino('velociraptor', 0, false);
    spawnDino('trex', 0, true);
    const boss = G.dinos.find(d => d.boss);
    boss.entranceT = 0; G.cinT = 0; // skip the cinematic hold so it can be hit
    const mobBefore = G.dinos.filter(d => !d.boss).length;
    const bossBefore = boss.hp, bossMax = boss.maxHp;
    G.cash = 99999; launchStrike(640, 430);
    for (let s = 0; s < 6; s += 0.05) step(0.05);
    const mobAfter = G.dinos.filter(d => !d.boss && !d.dead).length;
    const frac = (bossBefore - boss.hp) / bossMax;
    const el = $('#errbox'); el.classList.remove('hidden');
    el.textContent = `STRIKEKILL mobs ${mobBefore}→${mobAfter} (want 0) · boss lost ${(frac*100).toFixed(1)}% (want 25.0) · bossDead=${boss.dead} · trex maxHp=${Math.round(bossMax)} (3× of ${Math.round(bossMax/BOSS_HP_MULT)})`;
    G.paused = true;
  }
  if (testParams.has('indo')){ // Indominus: cloaks after a moment, then invincible unless a Sonic Emitter reveals it
    G.wave = 50;
    spawnDino('indominus', 0, true);
    const boss = G.dinos.find(d => d.boss);
    boss.entranceT = 0; G.cinT = 0;                 // skip the cinematic hold
    for (let s = 0; s < 3; s += 0.05) step(0.05);   // let the 2s visibility window lapse
    const cloakedNow = boss.cloaked;
    // banner suppression: while an emitter is lighting it up it must NOT announce a vanish
    boss.vanishAnnounced = false; boss.revealT = 2; G.banner = null;
    for (let s = 0; s < 1; s += 0.05) step(0.05);
    const coveredNoBanner = boss.vanishAnnounced === false && !G.banner;
    // ...but the moment that cover lapses it vanishes, exactly once (banner fires)
    boss.revealT = 0; step(0.05);
    const lapseVanished = boss.vanishAnnounced === true && !!G.banner;
    const before = boss.hp;
    damage(boss, 5000, true);                        // hit while hidden with no emitter → no effect
    const invincible = boss.hp === before;
    const bp = dinoPos(boss);
    // push an emitter beside the path (canPlace would reject on-path spots) so its pulse covers the boss
    G.towers.push({key: 'sonic', x: bp.x, y: bp.y, ulv: 0, cd: 0, angle: 0, flash: 0, invested: 0, mode: 'first'});
    for (let s = 0; s < 1.5; s += 0.05) step(0.05);
    const hurtByEmitter = boss.hp < before;
    const el = $('#errbox'); el.classList.remove('hidden');
    el.textContent = `INDO cloaked=${cloakedNow} · covered→no-banner=${coveredNoBanner} · lapse→vanished-once=${lapseVanished} · invincible=${invincible} · emitter-hurt=${hurtByEmitter} (all want true)`;
    G.paused = true;
  }
  if (testParams.has('celeb')){ // verify the victory shake settles after ~3s (celebration runs in render())
    G.wave = WAVES_PER_LEVEL;
    G.stat = {dnaWaves: 100, dnaKills: 20, cashEarned: 1000, kills: 100, streakMax: 2.5};
    G.dnaRun = 120; G.lives = G.maxLives;
    victory();                              // sets G.celebration
    let maxAfter3 = 0;
    for (let s = 0; s < 5.6; s += 0.05){ render(0.05); if (s > 3.2) maxAfter3 = Math.max(maxAfter3, G.shake); }
    const el = $('#errbox'); el.classList.remove('hidden');
    el.textContent = `CELEB max shake after 3s=${maxAfter3.toFixed(3)} (want 0.000) · final shake=${G.shake.toFixed(3)}`;
    G.paused = true;   // startWave() below no-ops because victory() set G.over
  }
  if (testParams.has('devpanel')){ // preview the UNLOCKED developer-options panel
    devUnlocked = true;              // simulate a correct password entry
    syncSettings();
    $('#settings').classList.remove('hidden');
    G.paused = true;
  }
  if (testParams.has('upg')){ // preview upgraded-tower visuals
    const lv = clamp(parseInt(testParams.get('upg'), 10) || 3, 0, 3);
    G.towers.forEach(t => { t.ulv = Math.min(TOWERS[t.key].maxUp, lv); });
  }
  startWave();
  const sim = parseFloat(testParams.get('sim')) || 0;
  for (let s = 0; s < sim; s += 0.05) step(0.05);
  if (testParams.has('wave')){ G.wave = parseInt(testParams.get('wave'), 10) - 1; G.waveActive = false; startWave(); for (let s = 0; s < (sim || 6); s += 0.05) step(0.05); }
  if (testParams.has('win')){ // stage the wave-100 celebration + recap
    G.wave = WAVES_PER_LEVEL;
    // seed a realistic run tally so the recap has real numbers to show
    G.stat = {dnaWaves: 1840, dnaKills: 260, cashEarned: 41230, kills: 3287, streakMax: 2.5};
    G.dnaRun = G.stat.dnaWaves + G.stat.dnaKills;
    G.streak = 2.5; G.lives = testParams.has('flaw') ? G.maxLives : Math.round(G.maxLives * 0.72);
    G.flawless = testParams.has('flaw');
    G.celebration = null; // jump straight to the results modal for the screenshot
    victory();
    $('#victory').classList.remove('hidden');
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
