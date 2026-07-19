'use strict';
/* =========================================================
   DINO DEFENSE — engine, UI, and game logic
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

/* ---------------- persistent save ----------------
   NOTE: the game was renamed Isla Defense → Dino Defense, but the localStorage
   key and IndexedDB name below are DELIBERATELY left as "islaDefense" so existing
   players keep every bit of their progress across the rename. They're internal
   identifiers no player ever sees — do not "tidy" them to dino* or saves are lost. */
const SAVE_KEY = 'islaDefense.v1';
const START_DNA = 80;   // grant so a new player can buy their first upgrade right away
function defaultSave(){
  return {bestDiff:0, mapBest:{}, wlv:{}, dna:START_DNA, kills:0, run:null, ach:{},
          stickers:{}, stickerD:{}, cardSeen:false, wkills:{}, studio:[], granted:true,
          settings:{invincible:false, unlimitedCash:false, levelSkip:false, allStickers:false, mute:false,
                    auto:true, music:true, wavePreview:true, killCallouts:true, mutedWeapons:{}}};
}
/* per-weapon sound mute (toggled from the weapon's popup menu) */
const weaponMuted = key => !!(save.settings.mutedWeapons && save.settings.mutedWeapons[key]);
/* weapon mastery: career kills per weapon earn bronze / silver / gold laurels
   (drawn on the weapon's pad in draw.js, shown in its popup menu) */
const MASTERY_TIERS = [250, 1500, 6000];
const masteryTier = key => {
  const k = (save.wkills && save.wkills[key]) || 0;
  return k >= MASTERY_TIERS[2] ? 3 : k >= MASTERY_TIERS[1] ? 2 : k >= MASTERY_TIERS[0] ? 1 : 0;
};
function loadSave(){
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!s) return defaultSave();
    const d = defaultSave();
    return {bestDiff: s.bestDiff || 0, mapBest: s.mapBest || {}, wlv: s.wlv || {},
            dna: s.dna || 0, kills: s.kills || 0, run: s.run || null, ach: s.ach || {},
            stickers: s.stickers || {}, stickerD: s.stickerD || {}, cardSeen: !!s.cardSeen,
            wkills: s.wkills || {}, studio: s.studio || [],
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
  if (o.lp){ // lowpass — rounds off harsh harmonics (strings, harp, pads)
    const fl = ac.createBiquadFilter();
    fl.type = 'lowpass'; fl.frequency.value = o.lp; fl.Q.value = 0.5;
    head.connect(fl); head = fl;
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
   An original theme in the grand 90s-adventure-film style: a slow 3/4
   hymn in B-flat major — a noble horn melody over harp arpeggios,
   swelling string pads, low strings, and soft timpani, with a cymbal
   rise lifting into a soaring second phrase. 16 bars, ~42s per loop.
   Scheduled a bar at a time so toggling music off stops it quickly. */
const MUS = {
  bpm: 69,
  barDur: 60 / 69 * 3, // 3/4 time — the stately waltz feel does a lot of the work
  // [bassFreq, chordTones low→high] per bar:
  // Bb F/A Gm Eb | Bb F Bb F || Eb Bb/D Cm F | Gm Eb F Bb
  bars: [
    [116.54, [233.08, 293.66, 349.23, 466.16]],
    [110.00, [174.61, 220.00, 261.63, 349.23]],
    [98.00,  [196.00, 233.08, 293.66, 392.00]],
    [77.78,  [155.56, 196.00, 233.08, 311.13]],
    [116.54, [233.08, 293.66, 349.23, 466.16]],
    [87.31,  [174.61, 220.00, 261.63, 349.23]],
    [116.54, [233.08, 293.66, 349.23, 466.16]],
    [87.31,  [174.61, 220.00, 261.63, 349.23]],
    [77.78,  [155.56, 196.00, 233.08, 311.13]],
    [73.42,  [233.08, 293.66, 349.23, 466.16]],
    [130.81, [196.00, 261.63, 311.13, 392.00]],
    [87.31,  [174.61, 220.00, 261.63, 349.23]],
    [98.00,  [196.00, 233.08, 293.66, 392.00]],
    [77.78,  [155.56, 196.00, 233.08, 311.13]],
    [87.31,  [174.61, 220.00, 261.63, 349.23]],
    [116.54, [233.08, 293.66, 349.23, 466.16]],
  ],
  // rising scale run that carries bar 7 up into the soaring B section
  lift: [174.61, 196.00, 220.00, 233.08, 261.63, 293.66],
  melody: [ // [bar, beat, freq, lengthInBeats] — bar 7 rests for the lift
    [0, 0, 349.23, 1],  [0, 1, 466.16, 2],
    [1, 0, 440.00, 2],  [1, 2, 392.00, 1],
    [2, 0, 349.23, 3],
    [3, 0, 392.00, 1],  [3, 1, 440.00, 1],  [3, 2, 466.16, 1],
    [4, 0, 523.25, 2],  [4, 2, 466.16, 1],
    [5, 0, 440.00, 2],  [5, 2, 392.00, 1],
    [6, 0, 349.23, 3],
    [8, 0, 466.16, 1],  [8, 1, 622.25, 2],
    [9, 0, 587.33, 2],  [9, 2, 523.25, 1],
    [10, 0, 466.16, 2], [10, 2, 392.00, 1],
    [11, 0, 440.00, 3],
    [12, 0, 466.16, 1], [12, 1, 523.25, 1], [12, 2, 587.33, 1],
    [13, 0, 622.25, 2], [13, 2, 587.33, 1],
    [14, 0, 523.25, 2], [14, 2, 440.00, 1],
    [15, 0, 466.16, 3],
  ],
};
let musicTimer = null, musicNextBar = 0, musicBarIdx = 0;
/* French-horn-ish lead: two detuned saws through a lowpass, with a slow
   vibrato that blooms after the attack. The soft onset + long release
   keep the phrases legato instead of beepy. */
function hornTone(f, dur, delay, peak){
  const ac = audio(); if (!ac) return;
  const t0 = ac.currentTime + delay;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + 0.08);
  g.gain.setValueAtTime(peak, Math.max(t0 + 0.09, t0 + dur - 0.12));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.35);
  const fl = ac.createBiquadFilter();
  fl.type = 'lowpass'; fl.frequency.value = 1100; fl.Q.value = 0.4;
  fl.connect(g);
  const vib = ac.createOscillator(); vib.frequency.value = 4.7;
  const vg = ac.createGain();
  vg.gain.setValueAtTime(0, t0);
  vg.gain.linearRampToValueAtTime(f * 0.005, t0 + 0.4);
  vib.connect(vg);
  for (const det of [-4, 4]){
    const o = ac.createOscillator();
    o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
    vg.connect(o.frequency);
    o.connect(fl);
    o.start(t0); o.stop(t0 + dur + 0.5);
  }
  vib.start(t0); vib.stop(t0 + dur + 0.5);
  routeOut(g, 0.6, musicGain);
}
/* flute-ish descant: a pure triangle with airy vibrato, lighter and
   quicker-speaking than the horn — carries high countermelodies. */
function fluteTone(f, dur, delay, peak){
  const ac = audio(); if (!ac) return;
  const t0 = ac.currentTime + delay;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + 0.05);
  g.gain.setValueAtTime(peak, Math.max(t0 + 0.06, t0 + dur - 0.1));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.25);
  const fl = ac.createBiquadFilter();
  fl.type = 'lowpass'; fl.frequency.value = 2400; fl.Q.value = 0.3;
  const o = ac.createOscillator();
  o.type = 'triangle'; o.frequency.value = f;
  const vib = ac.createOscillator(); vib.frequency.value = 5.2;
  const vg = ac.createGain();
  vg.gain.setValueAtTime(0, t0);
  vg.gain.linearRampToValueAtTime(f * 0.006, t0 + 0.45);
  vib.connect(vg); vg.connect(o.frequency);
  o.connect(fl); fl.connect(g);
  o.start(t0); o.stop(t0 + dur + 0.3);
  vib.start(t0); vib.stop(t0 + dur + 0.3);
  routeOut(g, 0.65, musicGain);
}
function scheduleBar(bar, t0){
  const beat = MUS.barDur / 3;
  const at = t => Math.max(0, t0 + t * beat - AC.currentTime);
  const [bass, ch] = MUS.bars[bar];
  // low strings on the root + a slow-swelling string-pad triad
  sfxTone({type: 'triangle', f0: bass, dur: MUS.barDur * 1.04, peak: 0.05, a: 0.3, lp: 700, wet: 0.35, bus: musicGain, delay: at(0)});
  for (let i = 0; i < 3; i++)
    sfxTone({type: 'sawtooth', f0: ch[i], dur: MUS.barDur * 1.04, peak: 0.013, a: 1.1, lp: 850, wet: 0.5, bus: musicGain, delay: at(0)});
  // harp arpeggio in eighths (bar 7: the rising run instead)
  const run = bar === 7 ? MUS.lift : [0, 1, 2, 3, 2, 1].map(i => ch[i]);
  run.forEach((f, i) =>
    sfxTone({type: 'triangle', f0: f, dur: 0.55, peak: i % 2 ? 0.018 : 0.026, a: 0.003, lp: 3200, wet: 0.5, bus: musicGain, delay: at(i * 0.5)}));
  // soft timpani on each 4-bar phrase downbeat + a cymbal swell into bar 8
  if (bar % 4 === 0)
    sfxTone({type: 'sine', f0: 58.27, f1: 44, dur: 0.6, peak: 0.09, wet: 0.4, bus: musicGain, delay: at(0)});
  if (bar === 7)
    sfxNoise({dur: 2.4, peak: 0.006, a: 2.1, type: 'highpass', f0: 5500, wet: 0.55, bus: musicGain, delay: at(0)});
  // horn melody (+ a distant glockenspiel doubling once the theme soars)
  for (const [mb, b, f, len] of MUS.melody){
    if (mb !== bar) continue;
    hornTone(f, len * beat, at(b), 0.05);
    if (bar >= 8)
      sfxTone({type: 'sine', f0: f * 2, dur: 0.9, peak: 0.01, a: 0.003, wet: 0.6, bus: musicGain, delay: at(b)});
  }
}
/* ---------------- MIDI score (assets/theme.mid) ----------------
   The theme ships as a Standard MIDI File so the music can be composed
   in any notation app (MuseScore, GarageBand, …), dropped into assets/,
   and performed live through the synth voices above. Parsed here into a
   flat note list (tempo map, running status, program changes). The
   procedural loop above stays as the fallback whenever the file can't
   load (file:// play, offline first-run, bad export).
   ?midi=<name> loads assets/<name> instead — for local A/B listening. */
let MIDI_THEME = null, midiIdx = 0, midiBase = 0;
function parseMidi(buf){
  const d = new DataView(buf);
  let p = 0;
  const u8 = () => d.getUint8(p++);
  const u16 = () => { const v = d.getUint16(p); p += 2; return v; };
  const u32 = () => { const v = d.getUint32(p); p += 4; return v; };
  const varlen = () => { let v = 0, b; do { b = u8(); v = (v << 7) | (b & 0x7f); } while (b & 0x80); return v; };
  const tag = () => String.fromCharCode(u8(), u8(), u8(), u8());
  if (tag() !== 'MThd') throw new Error('not a midi file');
  const hlen = u32(); u16(); // format (1 assumed; 0 parses fine too)
  const ntrk = u16(), div = u16();
  p += hlen - 6;
  if (div & 0x8000) throw new Error('smpte timing unsupported');
  const tempos = []; // [tick, µs per quarter note], across all tracks
  const raw = [];    // completed notes in ticks
  for (let t = 0; t < ntrk; t++){
    if (tag() !== 'MTrk') throw new Error('bad track header');
    const end = u32() + p;
    let tick = 0, status = 0;
    const prog = new Array(16).fill(0);
    const open = {}; // chn*128+pitch -> stack of pending note-ons
    while (p < end){
      tick += varlen();
      if (d.getUint8(p) & 0x80) status = u8(); // else: running status
      if (status === 0xff){
        const type = u8(), len = varlen();
        if (type === 0x51) tempos.push([tick, (d.getUint8(p) << 16) | (d.getUint8(p + 1) << 8) | d.getUint8(p + 2)]);
        p += len;
      } else if (status >= 0xf0){ p += varlen(); } // sysex
      else {
        const hi = status & 0xf0, chn = status & 15, d1 = u8();
        if (hi === 0xc0){ prog[chn] = d1; continue; }
        if (hi === 0xd0) continue; // channel pressure: one data byte
        const d2 = u8(), key = chn * 128 + d1;
        if (hi === 0x90 && d2 > 0)
          (open[key] = open[key] || []).push({t0: tick, vel: d2, prog: prog[chn]});
        else if (hi === 0x80 || hi === 0x90){
          const o = open[key] && open[key].shift();
          if (o) raw.push({t0: o.t0, t1: tick, p: d1, vel: o.vel, chn, prog: o.prog});
        }
      }
    }
    p = end;
  }
  tempos.sort((a, b) => a[0] - b[0]);
  const toSec = tick => { // walk the tempo map (default 120 bpm)
    let sec = 0, last = 0, uspq = 500000;
    for (const [tt, us] of tempos){
      if (tt >= tick) break;
      sec += (tt - last) / div * uspq / 1e6;
      last = tt; uspq = us;
    }
    return sec + (tick - last) / div * uspq / 1e6;
  };
  const notes = raw
    .map(n => ({t: toSec(n.t0), dur: Math.max(0.08, toSec(n.t1) - toSec(n.t0)),
                p: n.p, vel: n.vel, chn: n.chn, prog: n.prog}))
    .sort((a, b) => a.t - b.t);
  if (!notes.length) throw new Error('no notes');
  const dur = notes.reduce((m, n) => Math.max(m, n.t + n.dur), 0) + 1.6; // breath before the loop repeats
  return {dur, notes};
}
/* Perform one parsed note on the closest-matching synth voice.
   Routing is by General MIDI program, with a duration heuristic for
   anything unrecognised. Velocity scales each voice's mix level. */
function playMidiNote(n, delay){
  const f = 440 * Math.pow(2, (n.p - 69) / 12);
  const v = n.vel / 127;
  if (n.chn === 9){ // GM percussion: kicks & toms → timpani, rest → soft brush
    if ([35, 36, 41, 43, 45, 47].includes(n.p))
      sfxTone({type: 'sine', f0: 30 + n.p, f1: 42, dur: 0.5, peak: 0.1 * v, wet: 0.4, bus: musicGain, delay});
    else
      sfxNoise({dur: 0.08, peak: 0.016 * v, type: 'highpass', f0: 5000, wet: 0.4, bus: musicGain, delay});
    return;
  }
  const g = n.prog;
  if (g >= 72 && g <= 79) // pipes & flutes → airy descant voice
    fluteTone(f, Math.max(0.25, n.dur), delay, 0.045 * v);
  else if ((g >= 56 && g <= 71) || (g >= 80 && g <= 87)) // brass, winds, leads → horn
    hornTone(f, Math.max(0.3, n.dur), delay, 0.05 * v);
  else if ((g >= 32 && g <= 39) || (g <= 7 && f < 116)) // basses + piano low end
    sfxTone({type: 'triangle', f0: f, dur: n.dur * 1.02, peak: 0.055 * v, a: 0.05, lp: 600, wet: 0.3, bus: musicGain, delay});
  else if (g === 47) // GM orchestral timpani
    sfxTone({type: 'sine', f0: f, f1: f * 0.75, dur: 0.6, peak: 0.1 * v, wet: 0.4, bus: musicGain, delay});
  else if (((g >= 40 && g <= 45) || (g >= 48 && g <= 54) || g === 89 || g === 91) && n.dur > 0.45) // strings, choir, pads
    sfxTone({type: 'sawtooth', f0: f, dur: n.dur * 1.05, peak: 0.014 * v, a: Math.min(0.9, n.dur * 0.35), lp: 850, wet: 0.5, bus: musicGain, delay});
  else if (n.dur > 0.8 && f < 700) // unknown but sustained → mellow horn
    hornTone(f, n.dur, delay, 0.035 * v);
  else // piano, harp, guitar, mallets, anything short → pluck
    sfxTone({type: 'triangle', f0: f, dur: Math.min(0.9, Math.max(0.3, n.dur * 1.2)), peak: 0.03 * v, a: 0.003, lp: 3200, wet: 0.5, bus: musicGain, delay});
}
(function loadMidiTheme(){
  let name = 'theme.mid';
  try { name = new URLSearchParams(location.search).get('midi') || name; } catch(e){}
  fetch('assets/' + name)
    .then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
    .then(b => {
      MIDI_THEME = parseMidi(b);
      if (musicTimer){ stopMusic(); ensureMusic(); } // switch over if the fallback already started
    })
    .catch(() => {}); // procedural loop stays in charge
})();
function ensureMusic(){
  if (!save.settings.music || save.settings.mute){ stopMusic(); return; }
  const ac = audio();
  if (!ac || ac.state !== 'running') return; // waits for the first user gesture
  if (musicTimer) return;
  musicGain.gain.cancelScheduledValues(ac.currentTime);
  musicGain.gain.setValueAtTime(0.8, ac.currentTime);
  if (MIDI_THEME){ // perform the score, a lookahead window at a time
    midiIdx = 0; midiBase = ac.currentTime + 0.2;
    musicTimer = setInterval(() => {
      if (!AC || AC.state !== 'running') return;
      const horizon = AC.currentTime + 0.9;
      while (true){
        if (midiIdx >= MIDI_THEME.notes.length){ midiBase += MIDI_THEME.dur; midiIdx = 0; }
        const n = MIDI_THEME.notes[midiIdx];
        const t = midiBase + n.t;
        if (t >= horizon) break;
        if (t > AC.currentTime - 0.03) playMidiNote(n, Math.max(0, t - AC.currentTime));
        midiIdx++;
      }
    }, 200);
    return;
  }
  musicNextBar = ac.currentTime + 0.15;
  musicBarIdx = 0;
  musicTimer = setInterval(() => {
    if (!AC || AC.state !== 'running') return;
    while (musicNextBar < AC.currentTime + 0.6){
      scheduleBar(musicBarIdx % MUS.bars.length, musicNextBar);
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
  punt(){ // mortar kill gag: rising zip as the dino rockets off the screen
    if (!sfxGate()) return;
    sfxTone({type: 'sine', f0: 480, f1: 1650, dur: 0.42, peak: 0.055, wet: 0.3});
  },
  whistleIn(){ // …and the falling whistle as it comes back down
    if (!sfxGate()) return;
    sfxTone({type: 'sine', f0: 1500, f1: 520, dur: 0.5, peak: 0.05, wet: 0.35});
  },
  deflate(){ // gatling kill gag: air sputtering out of a punctured dino
    if (!sfxGate()) return;
    sfxNoise({dur: 0.5, peak: 0.05, type: 'bandpass', f0: 2400, f1: 900, Q: 2, wet: 0.15});
    sfxTone({type: 'square', f0: 300, f1: 90, dur: 0.5, peak: 0.02, tremF: 22, tremD: 0.8, wet: 0.1});
  },
  sizzle(){ // flamer kill gag: flash-fry crackle
    if (!sfxGate()) return;
    sfxNoise({dur: 0.6, peak: 0.05, type: 'highpass', f0: 3000, wet: 0.3});
    sfxNoise({dur: 0.35, peak: 0.04, type: 'bandpass', f0: 1200, f1: 500, Q: 1, wet: 0.25});
  },
  koBoing(){ // sniper kill gag: rubbery launch off the feet
    if (!sfxGate()) return;
    sfxTone({type: 'sine', f0: 160, f1: 520, dur: 0.28, peak: 0.06, wet: 0.2, tremF: 30, tremD: 0.4});
  },
  shatter(){ // cryo kill gag: the ice block bursts into shards
    if (!sfxGate()) return;
    sfxNoise({dur: 0.28, peak: 0.09, type: 'highpass', f0: 4200, wet: 0.35});
    sfxTone({type: 'triangle', f0: 2200, f1: 900, dur: 0.18, peak: 0.045, wet: 0.3});
    sfxTone({type: 'triangle', f0: 3100, f1: 1400, dur: 0.14, peak: 0.035, wet: 0.3, delay: 0.05});
  },
  notePop(){ // sonic kill gag: the dino resolves into a little arpeggio
    if (!sfxGate()) return;
    sfxTone({type: 'triangle', f0: 660, dur: 0.12, peak: 0.045, wet: 0.3});
    sfxTone({type: 'triangle', f0: 990, dur: 0.14, peak: 0.04, wet: 0.35, delay: 0.09});
    sfxTone({type: 'triangle', f0: 1320, dur: 0.18, peak: 0.035, wet: 0.4, delay: 0.19});
  },
  whoo(){ // gas kill gag: a little ghost floats free
    if (!sfxGate()) return;
    sfxTone({type: 'sine', f0: 520, f1: 880, dur: 0.5, peak: 0.035, wet: 0.5, a: 0.15});
    sfxTone({type: 'sine', f0: 780, f1: 1180, dur: 0.45, peak: 0.02, wet: 0.5, a: 0.18, delay: 0.12});
  },
  heartbeat(){ // last stand: two low lub-dubs under the slow-motion (always plays)
    for (const dl of [0, 0.8]){
      sfxTone({type: 'sine', f0: 66, f1: 46, dur: 0.16, peak: 0.24, wet: 0.15, delay: dl});
      sfxTone({type: 'sine', f0: 58, f1: 42, dur: 0.14, peak: 0.18, wet: 0.15, delay: dl + 0.16});
    }
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
  pteraWail(distant){ // the abduction: a huge piercing pterosaur scream.
    // The distant version (heard before it's seen) is quiet and drowned in reverb.
    const q = distant ? 0.3 : 1;
    sfxTone({type: 'sawtooth', f0: 1650, f1: 460, dur: 0.85, peak: 0.15 * q, dist: true, wet: distant ? 0.85 : 0.5, a: 0.03});
    sfxTone({type: 'sawtooth', f0: 2400, f1: 700, dur: 0.7,  peak: 0.06 * q, wet: 0.6, a: 0.02, delay: 0.06});
    sfxNoise({dur: 0.7, peak: 0.07 * q, type: 'bandpass', f0: 3000, f1: 1100, Q: 2, wet: 0.6, a: 0.03});
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
  tourists: [],             // fleeing visitors — pure theatre ahead of wave 1
  snatch: null,             // the pteranodon abduction set piece (also theatre)
  zapQ: [], links: [],      // pending tesla chain hops + residual dino-to-dino arcs
  spawnQ: [], spawnT: 0,
  speed: 1, paused: false,
  placing: null, selected: null,
  targeting: null, strikes: [], clouds: [], airUsed: 0,
  omega: null, omegaUsed: 0,
  celebration: null, fw: [],
  mouse: {x: 0, y: 0, on: false, tx: 0, ty: 0, off: false},
  cam: {x: 0, y: 0, zoom: 1},   // world camera (pan/zoom on touch; identity on desktop)
  gesture: null,                // in-progress touch gesture on the map
  autoTimer: -1,
  shake: 0, thunderT: 0, banner: null,
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
/* The wave the player is actually playing or shopping for. During prep G.wave is
   the last cleared wave, so the upcoming wave is G.wave+1; once a wave is live
   G.wave already points at it. (Using G.wave+1 unconditionally unlocked gear a
   wave early — e.g. a wave-6 weapon appeared during the active wave 5.) */
const activeOrNextWave = () => G.waveActive ? G.wave : G.wave + 1;
const towerUnlocked = key => activeOrNextWave() >= (TOWERS[key].unlock || 1);
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
    // On the Proving Grounds ranges are square-denominated instead (mortar
    // grows from 4 squares to 5 across its upgrades).
    range: (G.level && G.level.maze ? mazeRange(t.key, u)
      : def.range * (t.key === 'mortar' ? Math.pow(UPG.mult.range, u) : 1)) * rangeUpMult(t.key),
    splash: def.splash ? def.splash * (1 + (t.key === 'mortar' ? 0.35 : 0.15) * u) : 0,
  };
}

/* ---------------- wave generation ---------------- */
function poolFor(wave){
  const hasWater = (G.level.waterPaths || []).length > 0;
  const out = [];
  for (const [key, d] of Object.entries(DINOS)){
    if (d.boss || wave < d.minWave) continue;
    if (d.water && !hasWater) continue;      // aquatic dinos only where there's water
    let w = d.weight;
    if (d.flying) w *= G.level.flyerBias;
    // fade out trivial dinos late
    if (wave > d.minWave + 45) w *= 0.35;
    out.push({key, w});
  }
  return out;
}
/* water dinos swim the water channel(s); everything else takes the land route */
function pathForKey(key){
  const wp = G.level.waterPaths || [];
  const wantWater = !!DINOS[key].water;
  const opts = G.paths.map((_, i) => i).filter(i => wantWater === wp.includes(i));
  const arr = opts.length ? opts : G.paths.map((_, i) => i);
  return arr[Math.floor(Math.random() * arr.length)];
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
    q.push({at: t, key, pathI: pathForKey(key), boss: false});
    t += gap * rand(0.8, 1.2) * (DINOS[key].size < 12 ? 0.55 : 1);
  }
  // maps can override boss waves (e.g. the Mosasaurus rules the Lagoon)
  const bosses = (G.level.bosses && G.level.bosses[wave]) || BOSS_WAVES[wave];
  if (bosses){
    t += 2.2;
    bosses.forEach((bk, i) => { q.push({at: t + i*3.2, key: bk, pathI: pathForKey(bk), boss: true}); });
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
  if (G.level.maze && !d.flying){
    // open-world map: every ground dino enters at the SAME centre-left point
    // (the open entry square nearest mid-field) and marches the one shortest
    // route the flow field currently allows — a single-file column
    d.mx = -24; d.my = mazeEntryY(); d.mang = 0;
    d.dist = d.mx;                       // progress proxy for FIRST/LAST targeting
  }
  G.dinos.push(d);
  if (isBoss){
    // cinematic entrance: stalk in past the gate, stop, and roar
    // (the D-Rex takes its time — longer letterbox, second roar mid-entrance)
    d.dist = 100 + rand(0, 50);
    if (d.mx !== undefined){
      // stalk in a short way ALONG the current route — a fixed mid-field spawn
      // could land inside a wall built near the entrance, and the pop-out
      // then threw the boss to the far side of it
      let px = 90 + rand(0, 50), py = d.my, remain = 110 + rand(0, 40);
      const pts = mazeRoutePts();
      if (pts) for (let i = 1; i < pts.length && remain > 0; i++){
        const sx = pts[i].x - pts[i - 1].x, sy = pts[i].y - pts[i - 1].y;
        const seg = Math.hypot(sx, sy);
        if (seg >= remain){ px = pts[i - 1].x + sx * remain / seg; py = pts[i - 1].y + sy * remain / seg; break; }
        remain -= seg; px = pts[i].x; py = pts[i].y;
      }
      d.mx = px; d.my = py; d.dist = d.mx;
    }
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
    const p = dinoPos(d);
    const dd = hyp(t.x, t.y, p.x, p.y);
    if (dd > st.range + d.size * 0.4) continue;
    if (def.minRange && dd < def.minRange) continue; // mortars can't hit close targets
    let v;
    switch (t.mode){
      case 'strong': v = d.hp; break;
      case 'last':   v = -d.dist; break;
      case 'close':  v = -hyp(t.x, t.y, p.x, p.y); break;
      case 'air':    v = (d.flying ? 1e9 : 0) + d.dist + (d.boss ? 1e6 : 0); break; // flyers first, then furthest
      default:       v = d.dist + (d.boss ? 1e6 : 0); // first (bosses prioritized)
    }
    if (v > bestV){ bestV = v; best = d; }
  }
  return best;
}
function dinoPos(d){
  // open-world (maze) maps: ground dinos free-roam via the flow field and
  // carry their own position; flyers still ride the straight virtual path
  if (G.level && G.level.maze && !d.flying && d.mx !== undefined){
    return {x: d.mx, y: d.my, ang: d.mang || 0};
  }
  return samplePath(G.paths[d.pathI], d.dist);
}

/* ---------------- open-world flow field (maze maps) ----------------
   The field is a 32px grid. Cells overlapped by a weapon pad are walls.
   A BFS from the centre-right EXIT band labels every reachable cell with its
   next step toward the exit; ground dinos steer cell-to-cell along it, so
   your weapons physically shape their route. canPlace() rejects any weapon
   that would disconnect the centre-left entry from the exit entirely. */
const MAZE_CS = 64, MAZE_BAND = 130;   // square size + entry/exit half-height
// maze weapons snap to square CENTRES and fill exactly ONE square (64×64), so
// walls sit flush square-to-square and against the map edges
const mazeSnap = (x, y) => ({
  x: clamp(Math.floor(x / MAZE_CS) * MAZE_CS + MAZE_CS / 2, MAZE_CS / 2, Math.ceil(W / MAZE_CS) * MAZE_CS - MAZE_CS / 2),
  y: clamp(Math.floor(y / MAZE_CS) * MAZE_CS + MAZE_CS / 2, MAZE_CS / 2, Math.floor(H / MAZE_CS) * MAZE_CS - MAZE_CS / 2),
});
// Proving Grounds ranges are measured in SQUARES: the ring reaches N full
// squares out in every direction ((N + 0.5) × 64px from the weapon's centre)
const MAZE_RANGE_SQ = {gatling: 1, flamer: 1, gas: 1, cryo: 2, tesla: 2, sonic: 2, sniper: 3, missile: 3, mortar: 4};
const mazeRange = (key, u) =>
  ((MAZE_RANGE_SQ[key] || 2) + 0.5 + (key === 'mortar' ? (u || 0) / TOWERS.mortar.maxUp : 0)) * MAZE_CS;
function mazeRebuild(extra){
  // every fully-on-screen square is ordinary walkable ground, INCLUDING the
  // outer rows/cols — closing off the edge is done the honest way, by placing
  // a weapon flush against it (rows = floor: no phantom half-row off-screen)
  const cs = MAZE_CS, cols = Math.ceil(W / cs), rows = Math.floor(H / cs);
  const blocked = new Uint8Array(cols * rows);
  const mark = (tx, ty) => {
    // a snapped weapon occupies exactly ONE 64px square — walls are
    // square-perfect, exactly what the placement grid shows
    for (let ri = Math.max(0, ((ty - 32) / cs) | 0); ri <= Math.min(rows - 1, ((ty + 32) / cs) | 0); ri++)
      for (let ci = Math.max(0, ((tx - 32) / cs) | 0); ci <= Math.min(cols - 1, ((tx + 32) / cs) | 0); ci++){
        if (Math.abs(ci * cs + cs / 2 - tx) < 32 && Math.abs(ri * cs + cs / 2 - ty) < 32) blocked[ri * cols + ci] = 1;
      }
  };
  for (const t of G.towers) mark(t.x, t.y);
  if (extra) mark(extra.x, extra.y);
  const dist = new Int32Array(cols * rows).fill(-1);
  const next = new Int32Array(cols * rows).fill(-1);
  const q = [];
  for (let ri = 0; ri < rows; ri++){          // seed: the exit band on the right edge
    if (Math.abs(ri * cs + cs / 2 - H / 2) <= MAZE_BAND && !blocked[ri * cols + cols - 1]){
      const id = ri * cols + cols - 1;
      dist[id] = 0; q.push(id);
    }
  }
  for (let qi = 0; qi < q.length; qi++){
    const id = q[qi], ci = id % cols, ri = (id / cols) | 0;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]){
      const nc = ci + dc, nr = ri + dr;
      if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
      const nid = nr * cols + nc;
      if (blocked[nid] || dist[nid] >= 0) continue;
      dist[nid] = dist[id] + 1; next[nid] = id; q.push(nid);
    }
  }
  return {cs, cols, rows, blocked, dist, next};
}
const mazeEntryOpen = f => {                  // is the centre-left entry still connected?
  for (let ri = 0; ri < f.rows; ri++){
    if (Math.abs(ri * f.cs + f.cs / 2 - H / 2) <= MAZE_BAND && f.dist[ri * f.cols] >= 0) return true;
  }
  return false;
};
function mazeEntryY(){                        // centre of the open entry cell nearest mid-field
  const F = G.flow; if (!F) return H / 2;
  let best = 1e9, y = H / 2;
  for (let ri = 0; ri < F.rows; ri++){
    const cy = ri * F.cs + F.cs / 2;
    if (Math.abs(cy - H / 2) > MAZE_BAND || F.dist[ri * F.cols] < 0) continue;
    if (Math.abs(cy - H / 2) < best){ best = Math.abs(cy - H / 2); y = cy; }
  }
  return y;
}
/* the one route the column is currently marching: entry cell → exit, traced
   through the flow field (drawn as a faint dashed guide on maze maps) */
function mazeRoutePts(){
  const F = G.flow; if (!F) return null;
  let id = -1, best = 1e9;
  for (let ri = 0; ri < F.rows; ri++){        // entry cell nearest the centre-left mouth
    const cy = ri * F.cs + F.cs / 2;
    if (Math.abs(cy - H / 2) > MAZE_BAND) continue;
    const cid = ri * F.cols;
    if (F.dist[cid] >= 0 && Math.abs(cy - H / 2) < best){ best = Math.abs(cy - H / 2); id = cid; }
  }
  if (id < 0) return null;
  const pts = [{x: -20, y: ((id / F.cols) | 0) * F.cs + F.cs / 2}];
  let guard = F.cols * F.rows;
  while (id >= 0 && guard--){
    pts.push({x: (id % F.cols) * F.cs + F.cs / 2, y: ((id / F.cols) | 0) * F.cs + F.cs / 2});
    if (F.dist[id] === 0) break;
    id = F.next[id];
  }
  pts.push({x: W + 20, y: pts[pts.length - 1].y});
  return pts;
}
function mazeSteer(x, y){                     // world-space point to walk toward
  const F = G.flow;
  if (x < 6) return {x: 40, y};               // step onto the grid first
  if (!F) return {x: x + 80, y};
  const ci = clamp((x / F.cs) | 0, 0, F.cols - 1), ri = clamp((y / F.cs) | 0, 0, F.rows - 1);
  const id = ri * F.cols + ci;
  if (F.dist[id] < 0){
    // clipped into a wall cell (turns are rate-limited, so corners get cut):
    // back out to the NEAREST walkable cell — never the one nearest the exit,
    // that had dinos grinding forward into the wall trying to reach the far side
    let best = -1, bd = 1e9;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++){
      const nc = ci + dc, nr = ri + dr;
      if (nc < 0 || nc >= F.cols || nr < 0 || nr >= F.rows) continue;
      const nid = nr * F.cols + nc;
      if (F.dist[nid] < 0) continue;
      const dd = Math.hypot(nc * F.cs + F.cs / 2 - x, nr * F.cs + F.cs / 2 - y) + F.dist[nid] * 0.01;
      if (dd < bd){ bd = dd; best = nid; }
    }
    if (best < 0) return {x: x + 80, y: y + (H / 2 - y) * 0.2};           // truly sealed (canPlace forbids this)
    return {x: (best % F.cols) * F.cs + F.cs / 2, y: ((best / F.cols) | 0) * F.cs + F.cs / 2};
  }
  if (ci === F.cols - 1 && F.dist[id] === 0) return {x: x + 80, y};       // in the exit band — break out
  const n = F.next[id];
  if (n < 0) return {x: x + 80, y};                                       // on an exit seed cell — straight out
  return {x: (n % F.cols) * F.cs + F.cs / 2, y: ((n / F.cols) | 0) * F.cs + F.cs / 2};
}

// Every boss leaves the battle in its own way. These are intentionally normal
// world effects rather than a cutscene: towers, dinosaurs and the next wave can
// all keep moving while the defeated boss finishes its exit.
const BOSS_DEATHS = {
  blue:           {dur:2.9, impact:.92, label:'ALPHA DOWN',              color:'#75c6ef'},
  trex:           {dur:3.7, impact:1.08,label:'THE TYRANT FALLS',        color:'#e6c47f'},
  spinosaurus:    {dur:3.8, impact:1.14,label:'SAILBREAKER',             color:'#e79a5c'},
  indominus:      {dur:4.0, impact:1.46,label:'CAMOUFLAGE BROKEN',       color:'#dffaff'},
  indoraptor:     {dur:3.2, impact:1.06,label:'NIGHTMARE ENDED',         color:'#d4af5e'},
  giganotosaurus: {dur:4.2, impact:1.76,label:'APEX SHATTERED',          color:'#ef776e'},
  drex:           {dur:4.5, impact:1.58,label:'ABOMINATION ERADICATED',  color:'#ff5a42'},
  whiteptera:     {dur:3.7, impact:1.55,label:'SKY TYRANT GROUNDED',     color:'#f7f2df'},
  mosasaurus:     {dur:3.9, impact:1.34,label:'THE LAGOON FALLS SILENT', color:'#70d9ef'},
};
const bossDeathSpec = key => BOSS_DEATHS[key] || {dur:3, impact:.7, label:'BOSS DEFEATED', color:'#ffd24a'};

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
    if (src && TOWERS[src.key]){
      // sticker book (weapon × species) + weapon-mastery career tallies —
      // banked on every kill, persisted with the next wave-end save
      if (!save.stickers) save.stickers = {};
      const sk = src.key + ':' + d.key;
      save.stickers[sk] = (save.stickers[sk] || 0) + 1;
      if (save.stickers[sk] === 1){                 // first unlock: stamp the date
        if (!save.stickerD) save.stickerD = {};
        save.stickerD[sk] = new Date().toLocaleDateString(undefined, {year: 'numeric', month: 'short', day: 'numeric'});
      }
      if (!save.wkills) save.wkills = {};
      save.wkills[src.key] = (save.wkills[src.key] || 0) + 1;
      // multi-kill combo: several kills by the SAME weapon within a beat
      if (save.settings.killCallouts){
        const c = G.combo;
        if (c && c.src === src && G.time - c.t0 < 0.6){
          c.n++; c.t0 = G.time; c.x = (c.x + p.x) / 2; c.y = (c.y + p.y) / 2;
        } else {
          G.combo = {src, n: 1, t0: G.time, x: p.x, y: p.y, txt: null};
        }
        const cc = G.combo;
        if (cc.n >= 3){
          const label = '💥 ' + (cc.n === 3 ? 'TRIPLE!' : cc.n === 4 ? 'MEGA!' : cc.n === 5 ? 'ULTRA!'
                                : cc.n === 6 ? 'RAMPAGE!' : '×' + cc.n + ' RAMPAGE!');
          const size = Math.min(30, 19 + cc.n * 1.6);
          if (cc.txt && G.texts.includes(cc.txt)){        // grow the popup in place
            cc.txt.txt = label; cc.txt.size = size; cc.txt.t = 0;
          } else {
            addText(cc.x, cc.y - 30, label, '#ffd24a', size);
            const lt = G.texts[G.texts.length - 1];
            if (lt && lt.txt === label) cc.txt = lt;
          }
        }
      }
    }
    if (d.boss){
      const death = bossDeathSpec(d.key);
      G.corpses.push({pal: d.pal, feat: d.feat, painter: d.painter, size: d.size,
                      key: d.key, flying: d.flying, boss: true, pathI: d.pathI,
                      x: p.x, y: p.y, dir: Math.cos(p.ang) >= 0 ? 1 : -1,
                      phase: d.phase, t: 0, dur: death.dur, impact: death.impact,
                      seed: Math.random() * 999, thudded: false});
      G.shake = Math.max(G.shake, 10);
      SFX.bossDie();
      addFx('ring', p.x, p.y, 24);
      addFx('blood', p.x, p.y + 3, d.size * 0.7);
      for (let i = 0; i < 5; i++) addFx('spark', p.x + rand(-d.size, d.size), p.y - rand(0, d.size), 6);
      addText(p.x, p.y - d.size * 1.65, death.label, death.color, d.key === 'drex' ? 28 : 23, 2.5);
      unlockAch('boss_first');
      if (d.key === 'drex') unlockAch('apex');
    } else {
      /* every weapon signs its kills — each key maps to its own death gag:
         🚀 gibs: splat-cloud + cartwheeling pieces  💣 punt: launched sky-high
         🔫 deflate: riddled, then pops like a balloon  🔥 ash: statue crumbles
         🎯 ko: backflip, X-eyes, circling stars  ❄️ iceblock: freeze + shatter
         📡 notes: shaken apart into music  ☣️ ghost: a little spirit rises */
      const GAG = {missile: ['gibs', 1.6], mortar: ['punt', 2.6], gatling: ['deflate', 1.4],
                   flamer: ['ash', 1.9], sniper: ['ko', 2.1], cryo: ['iceblock', 1.8],
                   sonic: ['notes', 1.5], gas: ['ghost', 2.2]};
      const gag = src ? GAG[src.key] : null;
      if (src && src.key === 'tesla'){
        // ⚡ death by Tesla: no gore — the skeleton freezes mid-zap, then
        // crumbles into a smoking pile of bones with a little static wisp
        G.fx.push({kind: 'bones', x: p.x, y: p.y, r: d.size, fly: d.flying ? 1 : 0,
                   seed: Math.random() * 9, t: 0, dur: 1.5});
      } else if (gag && G.fx.length < 340){
        G.fx.push({kind: gag[0], x: p.x, y: p.y, r: d.size, fly: d.flying ? 1 : 0,
                   body: d.pal.body, belly: d.pal.belly,
                   dir: p.x >= src.x ? 1 : -1,   // ko: knocked away from the shooter
                   seed: Math.random() * 9, t: 0, dur: gag[1]});
        if (gag[0] === 'gibs') addFx('blood', p.x, p.y + 2, d.size * 0.6);
        if (!weaponMuted(src.key)){
          if (gag[0] === 'punt') SFX.punt();
          else if (gag[0] === 'deflate') SFX.deflate();
          else if (gag[0] === 'ash') SFX.sizzle();
          else if (gag[0] === 'ko') SFX.koBoing();
          // iceblock, notes, and ghost play their sound from the animation
          // itself (at the shatter / pop / ghost-rise beat), not at the kill
        }
      } else {
        addFx('puff', p.x, p.y, d.size);
        addFx('blood', p.x, p.y + 2, d.size * 0.45);
      }
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
    d.burnSrc = t;   // so a burn-tick kill still credits the flamer's kill gag
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
  t.cdMax = t.cd;            // lets the tesla coil pace its charge-pulse visual
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
      G.bolts.push({x1:t.x, y1:t.y, x2:tp.x, y2:tp.y, t:0.1, w:2.2,
                    color: 'rgba(190,230,255,0.95)', glow: 'rgba(110,190,255,0.28)'});
      addFx('spark', tp.x, tp.y - (target.size || 10) * 0.4, 6);   // round slams home
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
      const maxedT = (t.ulv || 0) >= (def.maxUp || 2);   // maxed coils arc VIOLET
      // pick the WHOLE chain now (damage rules unchanged), then let the
      // lightning visibly RACE dino → dino: each hop lands a tiny beat after
      // the previous one via the zap queue instead of all in one frame
      let cur = target;
      const hitset = new Set(), hops = [];
      for (let i = 0; i <= def.chain; i++){
        if (!cur) break;
        const cp = dinoPos(cur);
        hops.push(cur);
        hitset.add(cur);
        let next = null, bd = def.chainRange;
        for (const d of G.dinos){
          if (hitset.has(d) || !targetable(d, def)) continue;
          const p = dinoPos(d);
          const dd = hyp(cp.x, cp.y, p.x, p.y);
          if (dd < bd){ bd = dd; next = d; }
        }
        cur = next;
      }
      hops.forEach((d, i) => G.zapQ.push({delay: i * 0.055, dino: d, from: i ? hops[i - 1] : null,
                                          tower: t, st, def, maxedT}));
      if (maxedT){                                        // thunder: the island dims for a heartbeat
        G.thunderT = 0.3;
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
             dur: kind === 'sonic' ? 0.5 : kind === 'boom' ? 0.45 : kind === 'airburst' ? 0.55 : kind === 'frost' ? 0.5 : kind === 'flame' ? 0.22 : kind === 'gaspuff' ? 0.55 : kind === 'ring' ? 0.8 : kind === 'dust' ? 0.9 : kind === 'step' ? 0.45 : kind === 'shock' ? 0.9 : kind === 'birds' ? 1.4 : kind === 'zap' ? 0.26 : 0.3});
}
function addText(x, y, txt, color, size, dur){
  if (G.texts.length > 40) return;
  G.texts.push({x, y, txt, color, size: size || 15, t: 0, dur: dur || 1.4});
}

/* tiny cartoon dino silhouette shared by the kill gags — torso + tail +
   head (+ optional belly patch), drawn around (0,0), facing +x */
function gagBody(s, body, belly){
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.ellipse(0, 0, s * 0.5, s * 0.3, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-s * 0.45, -s * 0.1); ctx.lineTo(-s * 0.85, 0); ctx.lineTo(-s * 0.45, s * 0.12); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(s * 0.55, -s * 0.12, s * 0.18, 0, Math.PI*2); ctx.fill();
  if (belly){
    ctx.fillStyle = belly;
    ctx.beginPath(); ctx.ellipse(0, s * 0.12, s * 0.34, s * 0.16, 0, 0, Math.PI*2); ctx.fill();
  }
}

// one jagged lightning polyline, rolled once (bolts re-roll per frame; scars keep this shape)
function jagPts(x1, y1, x2, y2){
  const n = 7, pts = [[x1, y1]];
  for (let i = 1; i < n; i++){
    const k = i / n;
    pts.push([x1 + (x2 - x1) * k + rand(-8, 8), y1 + (y2 - y1) * k + rand(-8, 8)]);
  }
  pts.push([x2, y2]);
  return pts;
}

/* Tesla chain hops queued by fireTower: each hop lands a beat after the last,
   so the strike visibly leaps down the line. Damage targets were locked at
   fire time; only the SPECTACLE is staggered. */
function runZapQ(dt){
  for (const h of G.zapQ){
    h.delay -= dt;
    if (h.delay > 0) continue;
    h.done = true;
    const d = h.dino;
    const cp = dinoPos(d);
    const from = h.from ? dinoPos(h.from) : {x: h.tower.x, y: h.tower.y};
    G.bolts.push({x1: from.x, y1: from.y, x2: cp.x, y2: cp.y, t: 0.16, w: 3.2, jag: true,
                  flash: 1,                              // first frame renders WHITE-hot
                  color: h.maxedT ? 'rgba(215,160,255,0.95)' : 'rgba(120,230,255,0.95)',
                  glow:  h.maxedT ? 'rgba(150,70,255,0.32)'  : 'rgba(60,160,255,0.28)'});
    // the arc leaves an ionized scar hanging in the air + a glow on the ground
    if (G.fx.length < 340){
      G.fx.push({kind: 'zapscar', pts: jagPts(from.x, from.y, cp.x, cp.y),
                 x: cp.x, y: cp.y, maxed: h.maxedT ? 1 : 0, seed: Math.random() * 9, t: 0, dur: 0.45});
      G.fx.push({kind: 'zapglow', x: cp.x, y: cp.y + 4, r: 15, maxed: h.maxedT ? 1 : 0,
                 seed: Math.random() * 9, t: 0, dur: 0.5});
      // white-hot welder sparks burst off the strike point and bounce on the dirt
      for (let i = 0; i < 6; i++){
        G.fx.push({kind: 'wspark', x: cp.x, y: cp.y - 4, vx: rand(-75, 75), vy: rand(-130, -30),
                   gy: cp.y + rand(2, 8), seed: Math.random() * 9, t: 0, dur: rand(0.35, 0.6)});
      }
    }
    addFx('zap', cp.x, cp.y, h.maxedT ? 16 : 11);        // electric burst at every chained dino
    d.zapT = 0.35;                                        // cartoon skeleton-strobe while frying
    d.charT = 1;                                          // …then a smoking, sooty hangover
    if (!d.dead && !d.leaked) applyHit(d, h.tower, h.st, h.def);
    if (h.from) G.links.push({a: h.from, b: d, t: 0.45, maxed: h.maxedT});
    // teasing forks: the lightning reaches for dinos the chain DIDN'T take
    // and fizzles just short of them
    let teased = 0;
    for (const d2 of G.dinos){
      if (teased >= 2) break;
      if (d2 === d || d2.dead || d2.leaked || d2.zapT > 0 || !targetable(d2, h.def)) continue;
      const p2 = dinoPos(d2);
      if (hyp(cp.x, cp.y, p2.x, p2.y) < h.def.chainRange * 1.1){
        const rc = rand(0.5, 0.7);                       // stops 50–70% of the way there
        G.bolts.push({x1: cp.x, y1: cp.y, x2: cp.x + (p2.x - cp.x) * rc, y2: cp.y + (p2.y - cp.y) * rc,
                      t: 0.09, w: 1.5, jag: true,
                      color: h.maxedT ? 'rgba(215,160,255,0.6)' : 'rgba(120,230,255,0.6)'});
        teased++;
      }
    }
  }
  G.zapQ = G.zapQ.filter(h => !h.done);
  for (const l of G.links) l.t -= dt;
  G.links = G.links.filter(l => l.t > 0);
}

/* ---------------- dino update ---------------- */
function updateDinos(dt){
  for (const d of G.dinos){
    if (d.dead || d.leaked) continue;
    // statuses
    if (d.slowT > 0){ d.slowT -= dt; if (d.slowT <= 0) d.slowF = 1; }
    if (d.burnT > 0){ d.burnT -= dt; damage(d, d.burnDps * dt, true, d.burnSrc); if (d.dead) continue; }
    if (d.revealT > 0) d.revealT -= dt;
    if (d.zapT > 0) d.zapT -= dt;   // electrocution skeleton-flash timer
    else if (d.charT > 0) d.charT -= dt;   // post-zap smoking/sooty hangover
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
    // move — open-world ground dinos steer the flow field around your
    // weapon-walls; everything else follows its path
    const slow = d.slowT > 0 ? d.slowF : 1;
    let pp, atEnd;
    if (G.level.maze && !d.flying && d.mx !== undefined){
      const tgt = mazeSteer(d.mx, d.my);
      // walk the route polyline DIRECTLY — no turning-circle drift. A fast
      // boss's steering arc is wider than a one-square corridor, so steering
      // by angle overshot corners and jammed against the boxes; the body
      // angle below is purely visual and eases toward the travel direction
      const tdx = tgt.x - d.mx, tdy = tgt.y - d.my;
      const tdl = Math.hypot(tdx, tdy) || 1;
      const stp = d.speed * slow * dt;
      const omx = d.mx, omy = d.my;         // pre-move position — known good
      d.mx += tdx / tdl * stp;
      d.my += tdy / tdl * stp;
      // weapons are physically solid GRID BOXES (2×2 squares + a 4px skin):
      // eject a clipping dino out the face it came in through — never across —
      // so even a fast boss can't ratchet through a flush wall. Two passes so
      // neighbouring boxes settle.
      for (let pass = 0; pass < 2; pass++) for (const t of G.towers){
        const dx = d.mx - t.x, dy = d.my - t.y;
        if (Math.abs(dx) >= 36 || Math.abs(dy) >= 36) continue;
        const ex = omx - t.x, ey = omy - t.y;
        if (Math.abs(ex) >= Math.abs(ey) && Math.abs(ex) >= 36) d.mx = t.x + Math.sign(ex) * 36;
        else if (Math.abs(ey) >= 36) d.my = t.y + Math.sign(ey) * 36;
        else if (Math.abs(ex) >= 36) d.mx = t.x + Math.sign(ex) * 36;
        else if (Math.abs(dx) > Math.abs(dy)) d.mx = t.x + (dx < 0 ? -36 : 36);  // started inside — pop out the short way
        else d.my = t.y + (dy < 0 ? -36 : 36);
      }
      d.my = clamp(d.my, 10, H - 12);     // the outer rows are walkable now — just stay on-screen
      const ddx = d.mx - omx, ddy = d.my - omy;
      if (ddx * ddx + ddy * ddy > 0.01){  // ease the visible heading toward actual travel
        let da = Math.atan2(ddy, ddx) - (d.mang || 0);
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        d.mang = (d.mang || 0) + clamp(da, -dt * 10, dt * 10);
      }
      d.dist = d.mx;                      // progress proxy for targeting modes
      d.phase += dt * d.stride * slow;
      pp = {x: d.mx, y: d.my, ang: d.mang};
      atEnd = d.mx >= W - 14;             // broke out the right side
    } else {
      d.dist += d.speed * slow * dt;
      d.phase += dt * (d.flying ? 6 : d.stride) * slow;
      pp = samplePath(G.paths[d.pathI], d.dist);
      atEnd = d.dist >= G.paths[d.pathI].len;
    }
    // facing & body pitch follow the travel direction (smoothed)
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
    if (atEnd){
      d.leaked = true;
      G.waveLeaked = true; // a dino got through — breaks the clean-wave streak
      if (!save.settings.invincible){
        G.lives -= d.dmgToBase * (d.boss ? 1 : 1);
        G.flawless = false; // base took a hit — no longer a flawless run
        G.shake = Math.max(G.shake, 4);
        G.hurtT = 0.6;
        // a dino just cost real health — drop out of fast-forward so the
        // player can react, instead of staying sped up through more leaks
        if (G.speed > 1){ G.speed = 1; updateHUD(); }
      }
      SFX.leak();
      if (G.lives <= 0 && !G.over){ G.lives = 0; defeat(); }
    }
  }
  G.dinos = G.dinos.filter(d => !d.dead && !d.leaked);
}

/* ---------------- the tourist evacuation ----------------
   The moment wave 1 is counted in, the park's last visitors sprint the
   path to the exit gate and off the map. Pure theatre: they can't be
   targeted or hurt and always make it out — but every escape features
   the same doomed-vacation ensemble, each panicking in their own way. */
const TOURIST_YELLS = ['AAAAH!', 'RUN!!', 'NOPE NOPE NOPE!', 'WORST. TOUR. EVER!', 'TAXI!!!'];
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
    tall: kid ? rand(0.85, 0.95) : rand(0.94, 1.08),
    build: kid ? rand(0.9, 1) : rand(0.85, 1.25),
    lean: rand(0.1, 0.2), phase: rand(0, 6.3), lookT: 0,
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
function spawnTourists(){
  if (G.tourists.length || G.wave > 0) return;
  const wp = G.level.waterPaths || [];
  const pathI = Math.max(0, G.paths.findIndex((p, i) => !wp.includes(i)));
  const {skins, shirts, bottoms, hairs, hats} = TOURIST_LOOKS;
  const pick = a => a[(Math.random() * a.length) | 0];
  const cast = [ // fastest up front, stragglers at the back
    {arms: 'pump', hairStyle: 'pony', hat: 'visor', bottomType: 'shorts', speed: 150, size: 13, tall: 1.04, build: 0.88, shoeC: '#efe9dc', skyYell: 'I HAVE A 10K SATURDAYYY!'},   // the jogger — white trainers, obviously
    {arms: 'flail', hairStyle: 'pig', kid: true, balloon: true, bottomType: 'shorts', speed: 134, size: 9.5, tall: 0.9, build: 0.95, shoeC: '#c4433b', yell: 'MOMMYYY!'},          // little red sneakers
    {arms: 'hathold', hairStyle: 'short', hat: 'cap', bottomType: 'pants', speed: 128, size: 13.5, tall: 1, build: 1, shoeC: '#2e2e34', hatLoss: true, skyYell: 'ONE STAR!! ONE STARRR!!'},
    {arms: 'camera', hairStyle: 'bob', glasses: true, bottomType: 'skirt', speed: 124, size: 13, tall: 0.98, build: 0.92, shoeC: '#7a4a2a', camera: true, yell: 'STILL ROLLING!!', skyYell: 'WHAT AN ANGLE!! AAAAH!'},
    {arms: 'clutch', hairStyle: 'curls', pack: 'backpack', bottomType: 'shorts', speed: 120, size: 13.5, tall: 1.02, build: 1.02, shoeC: '#3d5f9e', skyYell: 'TAKE THE BACKPACK INSTEADDD!'},
    {arms: 'flail', hairStyle: 'long', hat: 'sun', bottomType: 'skirt', speed: 117, size: 13.2, tall: 1.02, build: 0.9, shoeC: '#efe9dc', skyYell: 'THIS WAS A 5-STAR RESORTTT!'},
    {arms: 'pump', hairStyle: 'bun', hat: 'safari', camera: true, pack: 'fanny', bottomType: 'shorts', speed: 113, size: 14, tall: 1, build: 1.08, shoeC: '#7a4a2a', skyYell: 'HONEY START THE JEEEEEP!'}, // sensible hiking boots
    {arms: 'flail', hairStyle: 'bald', glasses: true, floral: true, belly: true, bottomType: 'shorts', speed: 107, size: 15, tall: 0.95, build: 1.25, shoeC: '#8a6a3f', yell: 'WAIT FOR MEEEE!', skyYell: 'I SHOULD\'VE BOOKED THE BEACHHH!'}, // socks and sandals energy
  ];
  G.tourists = cast.map((c, i) => Object.assign({
    pathI, dist: -14 - i * 32 - rand(0, 14), speed: 0,
    phase: rand(0, 6.3), stride: (c.kid ? 15.5 : 12.5) + rand(-1, 1),
    turn: 1, dirT: 1, pitch: 0, px: -200, py: -200,
    lean: rand(0.1, 0.2),
    skin: pick(skins), shirt: c.floral ? '#e8574f' : pick(shirts),
    bottom: pick(bottoms), hairC: pick(hairs), hatC: pick(hats),
    packC: pick(shirts), balloonC: '#e33b3b',
    lookEvery: rand(1.4, 3), lookT: -rand(0, 2),
    yell: pick(TOURIST_YELLS), yellAt: Math.random() < 0.75 ? rand(0.18, 0.72) : -1,
    hatAt: c.hatLoss ? rand(0.35, 0.6) : -1, lastStep: 0,
  }, c, {speed: c.speed + rand(-4, 4)}));
  // fate marks one adult for the pteranodon (never the kid — we're not monsters)
  const adults = G.tourists.filter(u => !u.kid);
  adults[(Math.random() * adults.length) | 0].snatchAt = rand(0.3, 0.48);
  const p0 = samplePath(G.paths[pathI], 8);
  addText(p0.x + 34, p0.y - 38, '😱 The last visitors flee!', '#ffd9a8', 14, 2.4);
}
function updateTourists(dt){
  if (!G.tourists.length) return;
  for (const u of G.tourists){
    const path = G.paths[u.pathI];
    // uneven, panicked pace — everyone surges and falters out of sync
    u.dist += u.speed * (1 + 0.1 * Math.sin(G.time * 2.1 + u.phase * 5)) * dt;
    u.phase += dt * u.stride;
    if (u.dist < 0){ u.px = -200; u.py = -200; continue; } // still streaming out of the gate
    if (u.shock){ // rooted to the spot, spun around, staring straight up at it
      u.shockT += dt;
      u.phase += dt * 2.5;                                 // trembling half-steps
      const bdir = G.snatch ? G.snatch.dir : 1;
      u.turn += clamp(-bdir - u.turn, -dt * 9, dt * 9);    // whips round to face the thing
      u.pitch += clamp(0 - u.pitch, -dt * 4, dt * 4);
      u.lookT = 0;
      continue;
    }
    u.lookT -= dt;                                         // terrified glances backward
    if (u.lookT < -u.lookEvery) u.lookT = 0.42;
    let pp;
    if (u.dist <= path.len) pp = samplePath(path, u.dist);
    else { // keep sprinting straight on, off the map edge
      const sg = path.segs[path.segs.length - 1];
      pp = {x: sg.b.x + Math.cos(sg.ang) * (u.dist - path.len),
            y: sg.b.y + Math.sin(sg.ang) * (u.dist - path.len), ang: sg.ang};
    }
    // face and pitch onto the travel direction, like the dinosaurs
    const cosA = Math.cos(pp.ang);
    if (Math.abs(cosA) > 0.15) u.dirT = cosA > 0 ? 1 : -1;
    u.turn += clamp(u.dirT - u.turn, -dt * 9, dt * 9);
    let pitchT = u.dirT > 0 ? pp.ang : Math.PI - pp.ang;
    while (pitchT > Math.PI) pitchT -= Math.PI * 2;
    while (pitchT < -Math.PI) pitchT += Math.PI * 2;
    u.pitch += clamp(pitchT - u.pitch, -dt * 4, dt * 4);
    u.px = pp.x; u.py = pp.y;
    // one-shot gags on the way through
    const frac = u.dist / path.len;
    if (u.snatchAt > 0 && frac >= u.snatchAt && !G.snatch) beginSnatch(u);
    if (u.yellAt >= 0 && frac >= u.yellAt){ u.yellAt = -1; addText(pp.x, pp.y - 34, u.yell, '#ffe2ae', 13, 2.4); }
    if (u.hatAt >= 0 && frac >= u.hatAt){
      u.hatAt = -1; u.hatLost = true; u.arms = 'flail'; // both hands free to panic properly
      if (G.fx.length < 340) G.fx.push({kind: 'losthat', x: pp.x, y: pp.y - u.size * 1.5, t: 0, dur: 1.6, r: u.size, color: u.hatC, seed: rand(0, 6)});
      addText(pp.x, pp.y - 34, 'MY HAT!!', '#ffe2ae', 13, 2.4);
    }
    // the heaviest runner kicks up little dust scuffs
    if (u.build >= 1.2){
      const stepNow = Math.floor(u.phase / Math.PI);
      if (stepNow !== u.lastStep){ u.lastStep = stepNow; addFx('step', pp.x - 6, pp.y + 1, 5); }
    }
  }
  G.tourists = G.tourists.filter(u => u.dist < G.paths[u.pathI].len + 110);
}

/* ---------------- the abduction ----------------
   Mid-evacuation, a huge pteranodon takes one of the visitors. Pure
   set-piece drama with a comedy chaser: an unseen shape sweeps the
   field (omen), dives, snatches its mark clean off the path, and
   powers up and away while they air-run, kick and heckle from the
   talons. Costs no lives, counts as nothing — the victim is merely
   redistributed. Phases: omen → dive → grab → carry. */
function beginSnatch(u){
  u.snatchAt = -1;
  G.snatch = {phase: 'omen', t: 0, u, dir: u.dirT >= 0 ? 1 : -1, size: 46,
              ph: rand(0, 6), spread: 1, talon: 0, x: 0, y: -300, gy: u.py, yellQ: []};
  SFX.pteraWail(true);            // heard long before it's seen
  addFx('birds', u.px - 190, u.py - 40, 10);
  addFx('birds', u.px + 210, u.py - 70, 10);
}
function updateSnatch(dt){
  const s = G.snatch;
  if (!s) return;
  s.t += dt;
  s.ph += dt * (s.phase === 'dive' ? 3 : 11); // stiff-winged dive, laboured climb
  const v = s.u;
  if (s.phase === 'omen'){
    if (s.t >= 1.5){
      s.phase = 'dive'; s.t = 0;
      s.sx = v.px - s.dir * 640; s.sy = v.py - 430;   // plummets in from high behind
      s.gy = v.py;
      SFX.pteraWail(false);
      G.shake = Math.max(G.shake, 2);
    }
    return;
  }
  if (s.phase === 'dive'){
    const k = Math.min(1, s.t / 1.05), e = k * k * (3 - 2 * k);
    // home on the running victim; the arc sags, bottoms out, and meets them
    s.x = s.sx + (v.px - s.sx) * e;
    s.y = s.sy + (v.py - v.size * 1.9 - s.sy) * e + Math.sin(e * Math.PI) * 70;
    s.gy = v.py;
    s.spread = k < 0.65 ? 0.2 : (k - 0.65) / 0.35;    // wings tucked, then flared to brake
    s.talon = clamp((k - 0.5) / 0.4, 0, 1);
    if (k > 0.5 && !v.shock){ // the victim hears wingbeats... turns... and freezes
      v.shock = true; v.shockT = 0; v.arms = 'clutch';
      sfxTone({type: 'triangle', f0: 480, f1: 1050, dur: 0.2, peak: 0.05, wet: 0.35}); // a sharp little gasp
    }
    if (k >= 1){
      s.phase = 'grab'; s.t = 0;
      v.shock = false;                                // airborne now — back to screaming
      G.tourists = G.tourists.filter(t2 => t2 !== v); // off the ground, into the talons
      v.lean = 0; v.arms = 'flail';
      if (v.hat && !v.hatLost){                       // the hat stays behind, obviously
        v.hatLost = true;
        G.fx.push({kind: 'losthat', x: v.px, y: v.py - v.size * 1.5, t: 0, dur: 1.6, r: v.size, color: v.hatC, seed: rand(0, 6)});
      }
      addFx('dust', v.px, v.py + 2, 18);
      G.shake = Math.max(G.shake, 5);
      G.thunderT = Math.max(G.thunderT, 0.22);        // the island blinks dark for a beat
      sfxNoise({dur: 0.4, peak: 0.12, type: 'lowpass', f0: 900, f1: 180, wet: 0.3}); // wing thump
      addText(v.px, v.py - 52, v.skyYell || 'PUT ME DOWNNN!!', '#ffe2ae', 14, 2.4);
      // the survivors: a burst of speed, horrified glances, and a eulogy
      for (const t2 of G.tourists){ t2.speed *= 1.18; t2.lookT = 0.6; }
      const rest = G.tourists.filter(t2 => t2.dist > -1);
      if (rest.length){
        const a = rest[(Math.random() * rest.length) | 0];
        s.yellQ.push({in: 0.8, u: a, txt: "IT'S GOT DAVE!!"});
        const others = rest.filter(t2 => t2 !== a);
        if (others.length) s.yellQ.push({in: 1.7, u: others[(Math.random() * others.length) | 0], txt: 'WHO IS DAVE??'});
      }
    }
  } else if (s.phase === 'grab'){
    s.spread = 1; s.talon = 1;
    if (s.t >= 0.3){ s.phase = 'carry'; s.t = 0; s.vx = s.dir * 70; s.vy = -40; }
  } else if (s.phase === 'carry'){
    s.vx += s.dir * 130 * dt;
    s.vy -= 150 * dt;
    s.x += s.vx * dt; s.y += s.vy * dt;
    if (!s.shoe && s.t > 0.55){ // the punchline rains down
      s.shoe = true;
      G.fx.push({kind: 'shoe', x: s.x + s.dir * 6, y: s.y + s.size * 0.9, gy: s.gy + 8, t: 0, dur: 3.4, seed: rand(0, 6)});
    }
    if (!s.hotel && s.t > 1.3){
      s.hotel = true;
      addText(clamp(s.x, 130, W - 130), Math.max(60, s.y + s.size), 'I CAN SEE OUR HOTEL FROM HEREEE!', '#ffe2ae', 13, 2.4);
    }
    if (s.y < -90 || s.x < -170 || s.x > W + 170){ G.snatch = null; return; }
  }
  // victim theatrics while airborne: cartoon air-running, head whipping around
  if (s.phase === 'grab' || s.phase === 'carry'){
    v.phase += dt * 26;
    v.lookT = Math.sin(s.t * 4.5) > 0 ? 0.3 : 0;
  }
  // deferred survivor one-liners
  for (const q of s.yellQ){
    if (q.done) continue;
    q.in -= dt;
    if (q.in <= 0){ q.done = true; if (G.tourists.includes(q.u)) addText(q.u.px, q.u.py - 36, q.txt, '#ffe2ae', 13, 2.4); }
  }
}
/* drawn above the flyers — this is the show */
function drawSnatch(ctx){
  const s = G.snatch;
  if (!s) return;
  if (s.phase === 'omen'){ // a vast shadow sweeps the field; the shape stays unseen
    const k = s.t / 1.5, v = s.u;
    const sx = v.px - s.dir * (1 - k * 2) * 680, sy = v.py - 46 + Math.sin(k * 9) * 26;
    const g = ctx.createRadialGradient(sx, sy, 10, sx, sy, 210);
    g.addColorStop(0, 'rgba(8,10,6,0.34)'); g.addColorStop(1, 'rgba(8,10,6,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(sx, sy, 215, 66, 0, 0, Math.PI * 2); ctx.fill();
    return;
  }
  // ground shadow shrinks and fades with altitude
  const alt = clamp((s.gy - s.y) / 540, 0, 1);
  ctx.fillStyle = `rgba(0,0,0,${0.3 * (1 - alt * 0.75)})`;
  ctx.beginPath();
  ctx.ellipse(s.x, s.gy + 2, s.size * (1.15 - alt * 0.65), s.size * 0.26 * (1.15 - alt * 0.65), 0, 0, Math.PI * 2);
  ctx.fill();
  // the cargo, dangling from the talons (drawn first so wings overlap)
  if (s.phase !== 'dive'){
    const v = s.u;
    const vy = s.y + s.size * 0.72 + 1.27 * v.tall * v.size + Math.sin(s.t * 6) * 2;
    drawTourist(ctx, v, s.x + s.dir * 2, vy, s.dir, v.phase, 1, 0, true);
  }
  drawSnatcher(ctx, s);
}

/* ---------------- wave flow ---------------- */
/* rush bonus: calling the next wave early (manually) pays out the seconds you
   didn't wait — the countdown starts the moment the previous wave clears */
const RUSH_WINDOW = 10;
const rushBonus = () => Math.max(0, Math.round(G.rushT * (4 + G.wave * 0.6)));
/* compact composition summary of a built wave, for the HUD ticker */
function waveSummary(q){
  if (!q) return null;
  const s = {ground: 0, fly: 0, water: 0, bosses: []};
  for (const e of q){
    const def = DINOS[e.key];
    if (e.boss) s.bosses.push(def.name);
    else if (def.flying) s.fly++;
    else if (def.water) s.water++;
    else s.ground++;
  }
  return s;
}
function startWave(){
  if (G.waveActive || G.over) return;
  // manual wave-1 start (button/Space) skips the countdown — the visitors
  // still get their head start (no-op if the countdown already sent them)
  if (G.wave === 0) spawnTourists();
  G.wave++;
  if (cheatsActive()) G.runCheated = true; // latch: cheating any wave forfeits this run's trophies
  G.waveLeaked = false; // fresh clean-wave chance for the streak
  G.waveActive = true;
  G.autoTimer = -1;
  G.rushT = 0;
  G.spawnQ = G.pendingWave || buildWave(G.wave);
  G.waveTotal = G.spawnQ.length;
  G.pendingWave = G.wave < WAVES_PER_LEVEL ? buildWave(G.wave + 1) : null;
  G.nextPreview = waveSummary(G.pendingWave);
  // Dino Studio: each named design possesses ONE matching spawn this wave
  for (const ds of (save.studio || [])){
    if (!ds.name || !DINOS[ds.sp]) continue;
    const slot = G.spawnQ.find(e => e.key === ds.sp && !e.boss && !e.custom);
    if (slot) slot.custom = ds;
  }
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
  addText(W/2, 120, `Wave ${G.wave} cleared!  +$${bonus}${dnaGain >= 1 ? '  +' + fmt(dnaGain) + ' DNA' : ''}${streakTag}`, '#9fe870', 15, 2.9); // lingers 1.5s longer than the default
  G.flashT = 0.45;
  SFX.fanfare();
  if (G.wave >= WAVES_PER_LEVEL){ victory(); return; }
  saveRun();
  if (save.settings.auto) G.autoTimer = 3;
  G.rushT = RUSH_WINDOW;   // the early-call bonus clock starts ticking
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
  G.tourists = []; G.snatch = null;
  G.zapQ = []; G.links = []; G.thunderT = 0;
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
  G.pendingWave = G.wave < WAVES_PER_LEVEL ? buildWave(G.wave + 1) : null;
  G.nextPreview = waveSummary(G.pendingWave);
  G.rushT = 0; G.combo = null; G.slowmoT = 0; G.slowmoCd = 0;
  G.flow = G.level.maze ? mazeRebuild() : null;   // open-world routing grid
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
  resetCam();
  $('#zoomBar').classList.toggle('hidden', !IS_COARSE);   // zoom pill on touch devices only
  G.pendingWave = G.wave < WAVES_PER_LEVEL ? buildWave(G.wave + 1) : null;
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

function victory(){
  G.over = true;
  $('#zoomBar').classList.add('hidden');
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
  $('#zoomBar').classList.add('hidden');
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
  $('#zoomBar').classList.add('hidden');
  $('#gameover').classList.add('hidden');
  $('#victory').classList.add('hidden');
  // stage overlays must not bleed through onto the home screen
  $('#startPrompt').classList.add('hidden');
  $('#towerPop').classList.add('hidden');
  $('#menu').classList.remove('hidden');
  buildMenu();
}

/* ---------------- towers: place / select / upgrade ---------------- */
function canPlace(x, y){
  if (G.level && G.level.maze){
    // open-world map: weapons live ON the grid — each fills one square,
    // flush against neighbours or the map edge is fine, overlapping
    // another weapon is not, and sealing the field shut is never allowed.
    const s = mazeSnap(x, y);
    for (const t of G.towers) if (Math.abs(s.x - t.x) < 64 && Math.abs(s.y - t.y) < 64) return false;
    for (const d of G.dinos){
      if (d.dead || d.leaked || d.flying || d.mx === undefined) continue;
      if (Math.abs(s.x - d.mx) < 60 && Math.abs(s.y - d.my) < 60) return false; // never wall a live dino in
    }
    return mazeEntryOpen(mazeRebuild({x: s.x, y: s.y}));
  }
  if (x < 20 || x > W - 20 || y < 20 || y > H - 20) return false;
  if (distToAnyPath(x, y) < 42) return false;
  for (const t of G.towers) if (hyp(x, y, t.x, t.y) < 38) return false;
  return true;
}
function placeTower(key, x, y, force){
  if (!force && !towerUnlocked(key)){ SFX.error(); return; }
  const cost = force ? TOWERS[key].cost : towerCost(key);
  if (G.cash < cost || !canPlace(x, y)) { SFX.error(); return; }
  if (G.level.maze){ const s = mazeSnap(x, y); x = s.x; y = s.y; }   // weapons sit exactly on their grid squares
  G.cash -= cost;
  G.towers.push({key, x, y, ulv: 0, cd: 0, angle: rand(0, 6.28), flash: 0, invested: cost, mode: 'first'});
  if (G.level.maze) G.flow = mazeRebuild();   // the walls just changed — reroute everyone
  SFX.build();
  addFx('ring', x, y, 10);
  if (!force) track('weapon_built', {weapon: key});
  // onboarding: the moment the very first weapon is down, count wave 1 in —
  // and the park's last visitors make a break for the exit
  if (G.wave === 0 && !G.waveActive && !G.over && G.towers.length === 1 && !(G.autoTimer > 0)){
    G.autoTimer = FIRST_WAVE_DELAY;
    spawnTourists();
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
  const sx = cr.width / W, sy = cr.height / H;        // display px per canvas-buffer px
  const bx = (t.x - G.cam.x) * G.cam.zoom;            // tower centre -> buffer px (through camera)
  const by = (t.y - G.cam.y) * G.cam.zoom;
  const cx = (cr.left - sr.left) + bx * sx;           // ...then -> stage-relative display px
  const cy = (cr.top  - sr.top)  + by * sy;
  const towerR = 22 * G.cam.zoom * sx;
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
  const mTier = masteryTier(t.key), mKills = (save.wkills && save.wkills[t.key]) || 0;
  const mNext = MASTERY_TIERS.find(v => mKills < v);
  $('#tpStats').innerHTML =
    (t.key === 'gas'
      ? `POISON <b>${st.dmg.toFixed(0)}</b>/s · CLOUD every <b>${(1/st.rof).toFixed(1)}s</b> · RNG <b>${Math.round(st.range)}</b>`
      : `DMG <b>${st.dmg.toFixed(0)}</b> · ROF <b>${st.rof.toFixed(2)}/s</b> · RNG <b>${Math.round(st.range)}</b>`) +
    (t.key === 'missile' ? ` · <b>${1 + t.ulv}</b> rocket${t.ulv ? 's' : ''}/salvo` : '') +
    (st.splash ? ` · SPLASH <b>${Math.round(st.splash)}</b>` : '') +
    (def.air ? '' : ' · <span class="warn">cannot hit flyers</span>') +
    ` · <span class="mast" title="Weapon mastery: career kills across all runs earn bronze, silver, and gold laurels${mNext ? ' — next at ' + fmt(mNext) : ''}">` +
    '★'.repeat(mTier) + '☆'.repeat(3 - mTier) + ` ${fmt(mKills)} kills</span>`;
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
  const MODE_LABEL = {first: 'FIRST', last: 'LAST', strong: 'STRONGEST', close: 'CLOSEST', air: 'FLYERS FIRST'};
  $('#tpMode').textContent = '🎯 ' + (MODE_LABEL[t.mode] || t.mode.toUpperCase());
  $('#tpMode').title = 'Targeting priority (tap to cycle): FIRST = furthest along the path · LAST = newest arrival · STRONGEST = most health · CLOSEST = nearest to this weapon' + (TOWERS[t.key].air ? ' · FLYERS FIRST = airborne dinos before anything else' : '');
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
  if (G.level.maze) G.flow = mazeRebuild();   // a wall came down — reroute
  // sold the last weapon before wave 1 started → cancel the auto-start countdown
  if (G.wave === 0 && !G.waveActive && !G.over && G.towers.length === 0) G.autoTimer = -1;
  selectTower(null);
  SFX.coin(); saveRun(); updateHUD();
}

/* ---------------- air strike ---------------- */
const airUnlocked = () => activeOrNextWave() >= AIRSTRIKE.unlock;
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
const gasImmune = d => d.flying || d.boss || d.painter === 'sauropod' || d.painter === 'aquatic'; // swimmers dive under the cloud
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
const omegaUnlocked = () => activeOrNextWave() >= OMEGA.unlock;
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
    painter: 'omega', size: OMEGA.size, flying: false,   // dedicated robot-rex painter
    pal: {body: '#9aa3b2', belly: '#c7cedb', accent: '#3fb0ff'},
    feat: {},
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
  // combat: obliterate GROUNDED dinos in its lane within reach (flyers soar
  // safely over the machine — it can't touch them)
  const reach = o.size * 0.75;
  for (const d of G.dinos){
    if (d.dead || d.leaked || d.flying || d.pathI !== o.pathI) continue;
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
  const rush = !G.waveActive && !G.over && G.wave > 0 && G.rushT > 0 ? rushBonus() : 0;
  const compact = window.innerWidth < 700;   // phones: terse labels so the HUD rows never re-wrap
  const rushTag = rush > 0 ? (compact ? ` ⏩+$${rush}` : ` · ⏩ +$${rush}`) : '';
  $('#btnWave').textContent =
    G.waveActive ? (compact ? `⚔ Wave ${G.wave}` : '⚔ Wave in progress')
    : G.autoTimer > 0 ? (G.wave === 0
        ? `▶ First wave in ${Math.ceil(G.autoTimer)}…`
        : (compact ? `▶ ${Math.ceil(G.autoTimer)}s` : `▶ Next in ${Math.ceil(G.autoTimer)}…`) + rushTag)
    : (compact ? `▶ Wave ${G.wave + 1}` : `▶ Start Wave ${G.wave + 1}`) + rushTag;
  // incoming-wave ticker: what the next wave brings, and an anti-air warning
  const tick = $('#waveTicker');
  if (tick){
    const pv = G.nextPreview;
    const show = save.settings.wavePreview && !G.over && pv && G.wave < WAVES_PER_LEVEL;
    tick.classList.toggle('hidden', !show);
    if (show){
      const bits = [];
      if (pv.ground) bits.push(pv.ground + '🦖');
      if (pv.fly)    bits.push(pv.fly + '🦅');
      if (pv.water)  bits.push(pv.water + '🌊');
      for (const b of pv.bosses) bits.push('💀' + b.split(' ')[0].toUpperCase());
      const noAir = pv.fly > 0 && !G.towers.some(t => TOWERS[t.key].air);
      const html = 'Next: ' + bits.join(' ') + (noAir ? ' <b class="tickWarn">⚠ no anti-air!</b>' : '');
      if (tick.dataset.h !== html){ tick.dataset.h = html; tick.innerHTML = html; }
      tick.classList.toggle('alert', noAir || pv.bosses.length > 0);
    }
  }
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
  if (lv.maze){
    // open-world: no road — a dashed hint of the stampede across the field
    c.strokeStyle = 'rgba(232,185,58,0.55)'; c.lineWidth = 4 * sx; c.setLineDash([9 * sx, 8 * sx]);
    c.beginPath(); c.moveTo(10 * sx, H / 2); c.lineTo(W - 10 * sx, H / 2); c.stroke();
    c.setLineDash([]);
    c.fillStyle = 'rgba(232,185,58,0.8)';                      // exit arrowhead
    c.beginPath(); c.moveTo(W - 6 * sx, H / 2); c.lineTo(W - 22 * sx, H / 2 - 9 * sy); c.lineTo(W - 22 * sx, H / 2 + 9 * sy); c.closePath(); c.fill();
  } else {
    lv.paths.forEach((path, pi) => {
      const isW = (lv.waterPaths || []).includes(pi);
      c.strokeStyle = isW ? '#1c3a4a' : (t.pathEdge || '#5e4a2d'); c.lineWidth = 14 * sx;
      c.beginPath(); path.forEach((p, i) => i ? c.lineTo(p.x * sx, p.y * sy) : c.moveTo(p.x * sx, p.y * sy)); c.stroke();
      c.strokeStyle = isW ? (t.water || '#2e5d74') : (t.path || '#8a6f47'); c.lineWidth = 8.5 * sx;
      c.beginPath(); path.forEach((p, i) => i ? c.lineTo(p.x * sx, p.y * sy) : c.moveTo(p.x * sx, p.y * sy)); c.stroke();
    });
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
/* giant boss dinosaurs that roam the menu's terrain, far behind the UI —
   sometimes chasing hapless tourists (and sometimes catching them) */
let menuDinos = [], menuTourists = [], menuPuffs = [], menuSpawnT = 1.2, menuCv = null, menuCtx = null;
const MENU_BOSSES = ['trex', 'spinosaurus', 'indominus', 'indoraptor', 'giganotosaurus', 'drex'];
function spawnMenuDino(w, h, forcedKey){
  const key = MENU_BOSSES.includes(forcedKey) ? forcedKey : MENU_BOSSES[(Math.random() * MENU_BOSSES.length) | 0];
  const def = DINOS[key];
  const scale = clamp(w / 1280, 0.55, 1.5);
  const size = rand(88, 138) * scale * (key === 'drex' ? 1.14 : 1); // the finale brute dominates the horizon
  const dir = Math.random() < 0.5 ? 1 : -1;
  const speed = rand(48, 78) * scale * (key === 'drex' ? 0.72 : 1); // Distortus lumbers under its own mass
  const d = {
    painter: def.painter, feat: def.feat, flying: false, size,
    // uniform misty palette (lighter than the near-black jungle) so each distinct
    // boss silhouette reads as a glowing fog-giant wherever the UI doesn't cover it
    pal: def.painter === 'trex'
      ? {body: '#615e49', belly: '#80795b', accent: '#30362b'}
      : def.painter === 'mutant'
      ? {body: '#776344', belly: '#967653', accent: '#40352a'}
      // Preserve each film boss's signature markings in the fog. Muting the
      // supplied palette keeps them atmospheric without turning them generic.
      : {body: shade(def.pal.body, -0.10), belly: shade(def.pal.belly, -0.24), accent: def.pal.accent},
    x: dir > 0 ? -size * 2.4 : w + size * 2.4,
    y: h * rand(0.40, 0.49),                    // roam a horizon in the open hero backdrop
    // leg-cycle rate matched to actual ground speed (game's speed/size gait
    // relation, unclamped) so the giant's feet plant instead of treadmilling
    vx: speed * dir, dir, phase: rand(0, 6.28), stride: Math.max(0.55, (speed / size) * 2.6),
    alpha: rand(0.74, 0.86),
  };
  menuDinos.push(d);
  // most giants are chasing dinner: tourists sprint ahead, arms flailing.
  // FATES: ~15% will TRIP and be eaten sitting in terror, ~22% are simply too
  // slow and get run down (≈37% never make it) — the rest outrun the beast.
  if (Math.random() < 0.75){
    const n = 1 + (Math.random() * 2 | 0);
    // at most one celebrity cameo per pack: Nedry legs it, Hammond never quite makes it
    // (Hammond gets the bigger share — he's the crowd favourite)
    const guest = Math.random() < 0.4 ? (Math.random() < 0.58 ? 'hammond' : 'nedry') : null;
    const guestIdx = guest ? (Math.random() * n | 0) : -1;
    for (let i = 0; i < n; i++){
      const kind = i === guestIdx ? guest : null;
      let fate = Math.random();
      fate = fate < 0.15 ? 'trip' : fate < 0.37 ? 'doomed' : 'safe';
      if (kind === 'hammond') fate = 'doomed';                 // he is always caught
      if (kind === 'nedry' && fate === 'trip') fate = 'doomed'; // can't trip clutching the can
      const baseSize = d.size * 0.42;
      // full-fidelity look — same craft as the in-game evacuation cast
      // (the doomed never roll a kid: nobody wants to watch that)
      const look = kind === 'nedry'   ? nedryLook(baseSize * 0.58)
                 : kind === 'hammond' ? hammondLook(baseSize * 0.58)
                 : randomTouristLook(baseSize * 0.58, fate !== 'safe');
      // Hammond dodders along; everyone else keeps their fate-based pace.
      // He's still far slower than the sprinting dino (always caught), but quick
      // enough that the chase — and his one-liner — plays out for a good while.
      const spd = kind === 'hammond' ? rand(0.66, 0.76)
                : fate === 'doomed' ? rand(0.84, 0.93)
                : fate === 'trip' ? rand(0.96, 1.05) : rand(1.05, 1.28);
      // victims get a bigger head start so the chase plays out ON screen.
      // Hammond starts well on-screen (min ahead is bounded below by the off-screen
      // cull at x<-80); being slow, the dino closing from behind still runs him
      // down in view — the extra head start just lets more of him emerge first.
      const ahead = kind === 'hammond' ? 3.1 + i * 0.4
                  : (fate === 'safe' ? 2.2 : 4.2) + i * 1.2 + Math.random() * 0.8;
      menuTourists.push({
        x: d.x + dir * d.size * ahead,
        y: d.y + rand(-8, 6),
        vx: speed * spd * dir,
        dir, size: baseSize, phase: rand(0, 6.28),
        fate, doomed: fate === 'doomed', tripT: fate === 'trip' ? rand(2.5, 5) : 0,
        look, shirt: look.shirt, hero: kind,
        alpha: 0.85, prey: d,
      });
    }
  }
}
/* where the giant's mouth is, given its current bend (pitch about the hip) */
const MENU_MOUTHS = {
  blue:{x:1.02,y:-0.39}, spino:{x:1.25,y:-0.40}, indominus:{x:1.10,y:-0.44},
  indoraptor:{x:1.02,y:-0.39}, giga:{x:1.13,y:-0.44}
};
function menuMouthOffset(d){
  // Dedicated painters can extend beyond the generic theropod muzzle.
  const filmMouth = MENU_MOUTHS[d.painter];
  const ux = d.painter === 'trex' ? 1.26 : d.painter === 'mutant' ? 1.14 : filmMouth ? filmMouth.x : 0.8;
  const dy = d.painter === 'trex' ? -0.48 : d.painter === 'mutant' ? -0.20
           : filmMouth ? filmMouth.y : -0.42; // hip-relative before the shared body offset
  return {x:ux,y:dy};
}
function menuMouthPos(d, pitch){
  const mouth=menuMouthOffset(d),ux=mouth.x,dy=mouth.y;
  const c = Math.cos(pitch || 0), s = Math.sin(pitch || 0);
  return {x: d.x + d.dir * (ux * c - dy * s) * d.size,
          y: d.y + (ux * s + dy * c - 0.6) * d.size};
}
function menuBitePitch(d){
  const mouth=menuMouthOffset(d),r=Math.hypot(mouth.x,mouth.y)||1;
  // Solve the hip rotation for a mouth height near the tourist's torso.
  // Different neck and muzzle lengths therefore bend down by different amounts.
  return clamp(Math.asin(clamp(.48/r,-1,1))-Math.atan2(mouth.y,mouth.x),.52,1.02);
}
function menuMouthReach(d){
  const filmMouth = MENU_MOUTHS[d.painter];
  return d.size * (d.painter === 'mutant' ? 1.12 : d.painter === 'trex' ? 1.22 : filmMouth ? filmMouth.x : 0.9);
}
/* the caught tourist, clamped sideways in the jaws, legs kicking */
function drawMenuVictim(ctx, tr, m, dir){
  const s = tr.size * 0.9, lk = tr.look || {};
  const skin = lk.skin || '#e8c49a';
  const legCol = lk.bottomType === 'pants' ? lk.bottom : skin;
  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.scale(dir, 1);
  ctx.rotate(1.2 + Math.sin(G.time * 16) * 0.1);       // wriggling in the grip
  ctx.lineCap = 'round';
  ctx.strokeStyle = tr.shirt; ctx.lineWidth = s * 0.2; // torso
  ctx.beginPath(); ctx.moveTo(-s * 0.1, 0); ctx.lineTo(s * 0.25, 0); ctx.stroke();
  ctx.strokeStyle = legCol; ctx.lineWidth = s * 0.1;
  for (const off of [0, Math.PI]){                     // kicking legs
    const k = Math.sin(G.time * 22 + off) * 0.7;
    ctx.beginPath(); ctx.moveTo(-s * 0.1, 0);
    ctx.lineTo(-s * 0.35, -s * 0.2 * k); ctx.stroke();
  }
  ctx.strokeStyle = skin; ctx.lineWidth = s * 0.08;
  for (const off of [0.6, Math.PI + 0.9]){             // arms flailing wildly
    const a = Math.sin(G.time * 19 + off) * 0.9;
    ctx.beginPath(); ctx.moveTo(s * 0.22, 0);
    ctx.lineTo(s * 0.22 + Math.cos(a) * s * 0.3, -Math.abs(Math.sin(a)) * s * 0.28 - s * 0.06);
    ctx.stroke();
  }
  ctx.fillStyle = skin;                                // head (their hat is long gone)
  ctx.beginPath(); ctx.arc(s * 0.36, 0, s * 0.12, 0, Math.PI * 2); ctx.fill();
  if (lk.hairC && lk.hairStyle !== 'bald'){
    ctx.fillStyle = lk.hairC;
    ctx.beginPath(); ctx.arc(s * 0.37, -s * 0.02, s * 0.115, Math.PI * 0.9, Math.PI * 2.05); ctx.fill();
  }
  ctx.fillStyle = 'rgba(150,25,18,0.8)';               // it's not going well
  ctx.beginPath(); ctx.arc(s * 0.05, s * 0.04, s * 0.09, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function drawMenuTourist(ctx, tr){
  const lk = tr.look;
  if (tr.tripped){
    // down on their backside facing the thing, saucer-eyed, scrabbling
    // backward — the full-fidelity sitting-terror pose
    drawTouristSitting(ctx, lk, tr.x, tr.y, -tr.dir, G.time, tr.alpha);
    return;
  }
  // sprinting for their lives — nervous glances back at the thing behind
  lk.lookT = tr.fate !== 'safe' && Math.sin(G.time * 2.4 + lk.phase * 3) > 0.45 ? 0.3 : 0;
  drawTourist(ctx, lk, tr.x, tr.y, tr.dir, tr.phase, tr.alpha, 0);
}
/* comic speech bubble floating over a cameo's head (menu canvas space) */
const MENU_LINES = {nedry: "Ah, Ah, Ah!\nYou didn't say the magic word!", hammond: "We spared no expense!"};
function drawMenuBubble(ctx, tr, w){
  const text = MENU_LINES[tr.hero];
  if (!text) return;
  const hs = (tr.look && tr.look.size) || tr.size * 0.58;
  const fs = clamp(Math.round(hs * 0.52), 11, 14);
  ctx.save();
  ctx.font = `600 ${fs}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textBaseline = 'top';
  const maxW = 150, lines = [];
  for (const para of text.split('\n')){          // wrap, honoring explicit breaks
    let line = '';
    for (const word of para.split(' ')){
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxW && line){ lines.push(line); line = word; }
      else line = test;
    }
    lines.push(line);
  }
  const lh = fs * 1.25, padX = 9, padY = 6;
  let tw = 0;
  for (const l of lines) tw = Math.max(tw, ctx.measureText(l).width);
  const bw = tw + padX * 2, bh = lines.length * lh + padY * 2;
  const bob = Math.sin(G.time * 3 + tr.phase) * 1.8;
  const tipX = tr.x, tipY = tr.y - hs * 1.9 + bob;           // just above the head
  const bx = clamp(tipX - bw / 2, 4, w - bw - 4), by = tipY - 9 - bh;
  const tailX = clamp(tipX, bx + 14, bx + bw - 14);
  ctx.globalAlpha = tr.alpha;
  // bubble body + downward tail, with a soft shadow so it reads on the dark menu
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
  ctx.fillStyle = '#f7f4ec';
  const r = 7;
  ctx.beginPath();
  ctx.moveTo(bx + r, by);
  ctx.arcTo(bx + bw, by, bx + bw, by + bh, r);
  ctx.arcTo(bx + bw, by + bh, bx, by + bh, r);
  ctx.lineTo(tailX + 7, by + bh);
  ctx.lineTo(tailX, by + bh + 9);
  ctx.lineTo(tailX - 7, by + bh);
  ctx.arcTo(bx, by + bh, bx, by, r);
  ctx.arcTo(bx, by, bx + bw, by, r);
  ctx.closePath();
  ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.fillStyle = '#20242c';
  ctx.textAlign = 'center';
  for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], bx + bw / 2, by + padY + i * lh);
  ctx.restore();
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
  // Cap the backing buffer so it can never approach a browser's canvas-size limit.
  const scale = Math.min(1.5, window.devicePixelRatio || 1, 1600 / w, 1600 / h);
  const bw = Math.max(1, Math.round(w * scale)), bh = Math.max(1, Math.round(h * scale));
  if (cv.width !== bw || cv.height !== bh){ cv.width = bw; cv.height = bh; }
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, w, h);
  menuSpawnT -= dt;
  if (menuDinos.length < 2 && menuSpawnT <= 0){ spawnMenuDino(w, h); menuSpawnT = rand(7, 15); }
  // dinos: hungry sprint bursts, movement, and the eat-sequence timeline
  for (const d of menuDinos){
    if (!d.eat){
      d._sprint = false;
      for (const tr of menuTourists){                    // catchable prey ahead → burst of speed
        if (tr.prey === d && (tr.doomed || tr.tripped) && !tr.caught && !tr.dead){
          const gap = (tr.x - (d.x + d.dir * menuMouthReach(d))) * d.dir;
          if (gap > 0 && gap < d.size * 7){ d._sprint = true; break; }
        }
      }
      const sp = d._sprint ? 1.6 : 1;
      d.x += d.vx * sp * dt;
      d.phase += dt * d.stride * sp;
      d.eatPitch = 0;
    } else {
      // the meal: bend down → CHOMP → raise, victim thrashing in the jaws for
      // a good long while → toss the head back → gulp it down
      const e = d.eat; e.t += dt;
      const bitePitch=menuBitePitch(d);
      d.eatPitch = e.t < 0.45 ? (e.t / 0.45) * bitePitch
                 : e.t < 0.8  ? bitePitch
                 : e.t < 1.1  ? bitePitch - ((e.t - 0.8) / 0.3) * (bitePitch-.15)
                 : e.t < 2.1  ? 0.15 + Math.sin(e.t * 9) * 0.05
                 : e.t < 2.45 ? 0.15 - ((e.t - 2.1) / 0.35) * 0.5
                 : e.t < 2.95 ? -0.35 + ((e.t - 2.45) / 0.5) * 0.35 : 0;
      // Close only the horizontal gap. The tourist stays planted while the
      // dinosaur brings its mouth down to make contact.
      if (!e.bit && e.tr){
        const mouth = menuMouthPos(d, d.eatPitch), k = clamp(e.t / 0.40, 0, 1);
        e.tr.x += (mouth.x - e.tr.x) * k * 0.28;
      }
      if (!e.bit && e.t >= 0.48){                        // the bite lands — blood
        e.bit = true;
        if (e.tr) e.tr.dead = true;
        const m = menuMouthPos(d, d.eatPitch);
        for (let i = 0; i < 10; i++){
          menuPuffs.push({x: m.x + rand(-6, 6), y: m.y + rand(-6, 6),
                          vx: rand(-35, 35), vy: rand(-60, 5),
                          t: 0, dur: rand(0.4, 0.8), r: rand(2, 5)});
        }
      }
      if (e.t >= 2.95) d.eat = null;                     // burp. carry on.
    }
  }
  // tourists sprint for their lives — drawn under the dinos so a catch overlaps
  for (const tr of menuTourists){
    const d = tr.prey, chaseable = d && menuDinos.includes(d);
    if (!tr.caught && !tr.dead){
      if (tr.tripped){
        // scrabbling backward away from it in little shoves — not nearly fast enough
        tr.x += tr.dir * (10 + Math.max(0, Math.sin(G.time * 7)) * 26) * dt;
        tr.look.shockT += dt;                            // the eyes keep quivering
      } else {
        tr.x += tr.vx * dt;
        tr.phase += dt * (tr.hero === 'hammond' ? 5 : 11); // frantic little legs (Hammond dodders)
        if (tr.fate === 'trip' && chaseable){            // ...until the fateful stumble
          tr.tripT -= dt;
          if (tr.tripT <= 0){
            tr.tripped = true; tr.vx = 0;
            tr.look.shock = true; tr.look.shockT = 0;    // saucer eyes pop as they realise
            for (let i = 0; i < 4; i++){                 // dust kicked up by the fall
              menuPuffs.push({x: tr.x + rand(-7, 7), y: tr.y - rand(0, 5),
                              vx: rand(-18, 18), vy: rand(-20, -4),
                              t: 0, dur: rand(0.3, 0.55), r: rand(2, 4), c: '154,143,118'});
            }
          }
        }
      }
      if (chaseable && (tr.doomed || tr.tripped) && !d.eat){
        const reach = d.x + d.dir * menuMouthReach(d);   // where the lunge lands
        if ((reach - tr.x) * d.dir >= 0){                // caught
          tr.caught = true;
          d.eat = {t: 0, tr};
        }
      }
    } else if (tr.caught && !tr.dead){
      tr.phase += dt * 16;                               // flailing on the spot
    }
    if (!tr.dead) drawMenuTourist(ctx, tr);
  }
  menuTourists = menuTourists.filter(tr => !tr.dead && tr.x > -80 && tr.x < w + 80);
  for (const d of menuDinos){
    const yy = d.y + Math.sin(d.phase) * d.size * 0.015;
    drawDino(ctx, d, d.x, yy, d.dir, d.phase, d.alpha, d.eatPitch || 0);
    if (d.eat && d.eat.bit){
      const e = d.eat;
      if (e.t < 2.45 && e.tr){                           // victim in the jaws, thrashing
        const m = menuMouthPos(d, d.eatPitch);
        drawMenuVictim(ctx, e.tr, m, d.dir);
        if (Math.random() < 0.25){                       // dripping
          menuPuffs.push({x: m.x + rand(-4, 4), y: m.y + 4, vx: rand(-8, 8), vy: rand(10, 40),
                          t: 0, dur: rand(0.35, 0.6), r: rand(1.5, 3)});
        }
      } else if (e.t >= 2.45){                           // the gulp — a lump slides down the neck
        const k = clamp((e.t - 2.45) / 0.5, 0, 1);
        const ux = 0.42 - 0.4 * k, uy = -0.92 + 0.34 * k;
        // Derive the stretched-skin highlight from this dinosaur's live menu
        // palette. Dedicated/recolored bosses therefore carry their own color
        // through the entire eating sequence instead of reverting to the old
        // generic fog-theropod green.
        ctx.save();
        ctx.globalAlpha = 0.86 * d.alpha;
        ctx.fillStyle = shade(d.pal.body, 0.16);
        ctx.beginPath();
        ctx.ellipse(d.x + d.dir * ux * d.size, d.y + uy * d.size, d.size * 0.12, d.size * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }
  // short-lived sprays: red where a tourist used to be, dust where one fell
  menuPuffs = menuPuffs.filter(pf => (pf.t += dt) < pf.dur);
  for (const pf of menuPuffs){
    pf.x += pf.vx * dt; pf.y += pf.vy * dt; pf.vy += 80 * dt;
    const k = pf.t / pf.dur;
    ctx.fillStyle = `rgba(${pf.c || '150,25,18'},${0.8 * (1 - k)})`;
    ctx.beginPath(); ctx.arc(pf.x, pf.y, pf.r * (1 - k * 0.4), 0, Math.PI * 2); ctx.fill();
  }
  // celebrity one-liners float on top of everything, while they're still running
  for (const tr of menuTourists){
    if (tr.hero && !tr.caught && !tr.dead) drawMenuBubble(ctx, tr, w);
  }
  menuDinos = menuDinos.filter(d => d.x > -d.size * 3.2 && d.x < w + d.size * 3.2);
}
function buildMenu(){
  const got = ACHIEVEMENTS.filter(a => save.ach && save.ach[a.key]).length;
  $('#verChip').innerHTML = `v${VERSION} · 📜 what's new`;
  $('#menuDna').innerHTML = `🧬 <b>${fmt(save.dna)}</b> DNA`;
  const sb = $('#statBest'); if (sb) sb.innerHTML = save.bestDiff ? `⛰️ Reached <b>Lv ${save.bestDiff}</b>` : `🌱 New ranger`;
  const sa = $('#statAch'); if (sa) sa.innerHTML = `🏆 <b>${got}/${ACHIEVEMENTS.length}</b> trophies`;
  // pulse the Lab tile whenever any weapon or base upgrade is affordable
  const canBuy = Object.keys(TOWERS).some(k => save.dna >= wlvCost(TOWERS[k], wlv(k)))
    || META.some(m => save.dna >= metaCost(m, mlvl(m.key)));
  $('#btnLab').classList.toggle('attention', canBuy);
  const fl = $('#fSubLab'); if (fl) fl.textContent = canBuy ? '⬆ upgrades ready!' : fmt(save.dna) + ' DNA banked';
  // live tallies on the feature-dock tiles
  let sGot = 0, sTot = 0;
  for (const wk of Object.keys(TOWERS)) for (const dk of Object.keys(DINOS)){
    if (!stickerPossible(wk, dk)) continue;
    sTot++;
    if (save.stickers && save.stickers[wk + ':' + dk]) sGot++;
  }
  const fs2 = $('#fSubStick'); if (fs2) fs2.textContent = `${sGot}/${sTot} collected`;
  const nSt = (save.studio || []).length;
  const fd = $('#fSubStudio'); if (fd) fd.textContent = nSt ? `${nSt} original${nSt > 1 ? 's' : ''} roaming` : 'design your own dino';
  const fa = $('#fSubAch'); if (fa) fa.textContent = `${got}/${ACHIEVEMENTS.length} trophies`;
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
/* ---------------- sticker book ----------------
   One sticker per weapon × species: earned by landing the FINAL blow on that
   species with that weapon. Combos that can't happen (ground-only weapons vs
   flyers, gas vs the gas-immune) are struck from the page and the total. */
function stickerPossible(wk, dk){
  const w = TOWERS[wk], d = DINOS[dk];
  if (d.flying && !w.air) return false;
  if (wk === 'gas' && (d.boss || d.flying || d.painter === 'sauropod' || d.painter === 'aquatic')) return false;
  return true;
}
function buildStickers(){
  const table = $('#stickTable');
  if (!table) return;
  const wkeys = Object.keys(TOWERS);
  let got = 0, total = 0;
  let html = '<tr><th></th>' + wkeys.map(k =>
    `<th title="${TOWERS[k].name}">${TOWERS[k].icon}</th>`).join('') + '</tr>';
  const bossOnly = new URLSearchParams(location.search).get('stickers') === 'bosses';
  for (const [dk, def] of Object.entries(DINOS)){
    if (bossOnly && !def.boss) continue;
    html += `<tr><td class="spName"><span class="sw" style="background:${def.pal.body}"></span>${def.name}${def.boss ? ' 💀' : ''}</td>`;
    for (const wk of wkeys){
      if (!stickerPossible(wk, dk)){ html += '<td class="cell na" title="Not possible">—</td>'; continue; }
      total++;
      const n = (save.stickers && save.stickers[wk + ':' + dk]) || 0;
      if (n) got++;
      const shown = n > 0 || save.settings.allStickers;   // dev preview: view-only
      html += `<td class="cell${shown ? ' got' : ''}${!n && shown ? ' dev' : ''}" data-w="${wk}" data-d="${dk}" title="${def.name} × ${TOWERS[wk].name}${n ? ' — ' + fmt(n) + ' final blow' + (n > 1 ? 's' : '') + ' — tap for the card!' : shown ? ' — DEV preview' : ' — not yet!'}">${shown ? `<span class="stk">${TOWERS[wk].icon}</span>` : ''}</td>`;
    }
    html += '</tr>';
  }
  table.innerHTML = html;
  // first-time coach: earned stickers bounce until the player opens a card
  table.classList.toggle('hintPulse', got > 0 && !save.cardSeen);
  const prog = $('#stickProg');
  if (prog) prog.textContent = `${got} / ${total}` + (save.settings.allStickers ? ' — 🔧 DEV preview: all shown' : '');
}

/* ---------------- sticker trading card ----------------
   Tapping an earned sticker opens an animated foil card: the species drawn
   LARGE by its own in-game painter, strutting in place under a rotating
   sunburst, with confetti, twinkles, and a gliding holo-foil sweep — plus
   the earning weapon, tally, and first-unlock date below. */
let cardD = null, cardMeta = null, cardT0 = 0, cardRAF = 0;
const cardTint = (h, a) => `rgba(${parseInt(h.slice(1, 3), 16)},${parseInt(h.slice(3, 5), 16)},${parseInt(h.slice(5, 7), 16)},${a})`;
function cardRR(c, x, y, w, h, r){   // rounded-rect path (roundRect needs iOS 16+)
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
function openStickerCard(wk, dk){
  const def = DINOS[dk], wdef = TOWERS[wk];
  if (!def || !wdef) return;
  const sk = wk + ':' + dk;
  cardMeta = {wdef, def, seed: (wk + dk).length * 3.7,
              n: (save.stickers && save.stickers[sk]) || 0,
              date: (save.stickerD && save.stickerD[sk]) || null};
  cardD = {key: dk, def, boss: !!def.boss, painter: def.painter, pal: def.pal, feat: def.feat,
           flying: !!def.flying,
           size: def.painter === 'sauropod' ? 50 : def.flying ? 48 : def.painter === 'mutant' ? 76 : def.boss ? 68 : 62,
           phase: 0, seedE: 0.5};
  $('#cardInfo').innerHTML =
    `<h3>${def.name}</h3>` +
    (def.epithet ? `<div class="cEpithet">${def.epithet}</div>` : '') +
    (cardMeta.n > 0
      ? `<div class="cLine">${wdef.icon} Taken down by <b>${wdef.name}</b> · <b>${fmt(cardMeta.n)}</b> final blow${cardMeta.n === 1 ? '' : 's'}</div>` +
        `<div class="cDate">📅 Unlocked ${cardMeta.date || 'long, long ago 🦴'}</div>`
      : `<div class="cLine">${wdef.icon} <b>${wdef.name}</b> hasn't finished one yet</div>` +
        `<div class="cDate">🔧 Developer preview — not earned</div>`);
  $('#stickCard').classList.remove('hidden');
  if (!save.cardSeen){ save.cardSeen = true; persist(); }   // coach bounce retires
  $('#stickTable').classList.remove('hintPulse');
  cardT0 = performance.now();
  SFX.coin();
  if (!cardRAF) cardLoop();
}
function cardLoop(){
  if ($('#stickCard').classList.contains('hidden') || !cardD){ cardRAF = 0; return; }
  drawStickerCard((performance.now() - cardT0) / 1000);
  cardRAF = requestAnimationFrame(cardLoop);
}
function drawStickerCard(t){
  const cvC = $('#cardCv'), c = cvC.getContext('2d');
  const CW = 360, CH = 400;                        // logical card canvas size
  c.setTransform(cvC.width / CW, 0, 0, cvC.height / CH, 0, 0);
  const wcol = cardMeta.wdef.color;
  const pr = n => { const v = Math.sin(cardMeta.seed * 37.7 + n * 91.3) * 43758.5; return v - Math.floor(v); };
  const cx = CW / 2, gy = CH - 86;
  // deep backdrop, breathing toward the weapon's color
  const bg = c.createLinearGradient(0, 0, 0, CH);
  bg.addColorStop(0, '#0c1009'); bg.addColorStop(0.55, '#141b0e'); bg.addColorStop(1, '#0b0f08');
  c.fillStyle = bg; c.fillRect(0, 0, CW, CH);
  c.globalAlpha = 0.15 + 0.05 * Math.sin(t * 1.7);
  const bg2 = c.createRadialGradient(cx, gy - 60, 0, cx, gy - 60, 240);
  bg2.addColorStop(0, wcol); bg2.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = bg2; c.fillRect(0, 0, CW, CH);
  c.globalAlpha = 1;
  // rotating sunburst behind the star of the show
  c.save();
  c.translate(cx, gy - 55); c.rotate(t * 0.22);
  for (let i = 0; i < 12; i++){
    c.rotate(Math.PI / 6);
    const rg = c.createLinearGradient(0, 0, 230, 0);
    rg.addColorStop(0, i % 2 ? 'rgba(232,185,58,0.10)' : cardTint(wcol, 0.09));
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = rg;
    c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 230, -0.11, 0.11); c.closePath(); c.fill();
  }
  c.restore();
  // podium
  c.fillStyle = 'rgba(0,0,0,0.4)';
  c.beginPath(); c.ellipse(cx, gy + 6, 120, 22, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = cardTint(wcol, 0.55); c.lineWidth = 1.5;
  c.beginPath(); c.ellipse(cx, gy + 6, 120, 22, 0, 0, Math.PI * 2); c.stroke();
  if (cardD.boss){                                 // bosses smolder on their podium
    c.strokeStyle = `rgba(255,80,60,${0.3 + 0.2 * Math.sin(t * 3)})`; c.lineWidth = 2.5;
    c.beginPath(); c.ellipse(cx, gy + 6, 131 + Math.sin(t * 3) * 5, 26, 0, 0, Math.PI * 2); c.stroke();
    for (let i = 0; i < 5; i++){
      const cyc = (t * 0.4 + i * 0.2) % 1;
      c.fillStyle = `rgba(255,${120 + i * 20},30,${0.5 * (1 - cyc)})`;
      c.beginPath(); c.arc(cx + Math.sin(i * 2.1 + t) * 70, gy - 20 - cyc * 120, 1.6 + (1 - cyc) * 1.4, 0, Math.PI * 2); c.fill();
    }
  }
  // the dinosaur itself, strutting in place
  cardD.phase = t * 3.2;
  // The rex's long counterweight extends much farther behind its hips than its
  // skull reaches forward, so nudge it right to center the whole silhouette.
  const cardX = cx + (cardD.painter === 'trex' ? 18 : cardD.painter === 'mutant' ? 16 : 0);
  drawDino(c, cardD, cardX, gy, 1, cardD.phase, 1, 0);
  // unlock confetti burst (the first moments only)
  if (t < 1.5){
    const cols = ['#ffd24a', '#8fd14f', '#7ec8ff', '#ff6b6b', '#d6a3ff'];
    for (let i = 0; i < 26; i++){
      const a = pr(i) * Math.PI * 2, sp = 70 + pr(i + 30) * 160;
      c.save();
      c.translate(cx + Math.cos(a) * sp * t, gy - 70 + Math.sin(a) * sp * t * 0.7 + 90 * t * t);
      c.rotate(t * (4 + pr(i + 60) * 6));
      c.globalAlpha = Math.max(0, 1 - t / 1.4);
      c.fillStyle = cols[i % cols.length];
      c.fillRect(-2.4, -1.5, 4.8, 3);
      c.restore();
    }
    c.globalAlpha = 1;
  }
  // twinkling star field
  for (let i = 0; i < 9; i++){
    const tw = 0.5 + 0.5 * Math.sin(t * (2 + pr(i + 9) * 3) + i * 2.2);
    const sx = 24 + pr(i) * (CW - 48), sy = 22 + pr(i + 20) * (CH - 130);
    const sr = 2 + pr(i + 40) * 3;
    c.strokeStyle = `rgba(255,235,170,${0.65 * tw})`; c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(sx - sr, sy); c.lineTo(sx + sr, sy);
    c.moveTo(sx, sy - sr); c.lineTo(sx, sy + sr);
    c.stroke();
  }
  // holo-foil sweep: two glossy bands gliding across the face
  const sweep = ((t * 0.5) % 2.2) - 0.6;
  for (const [off, wdt, al] of [[0, 70, 0.10], [0.16, 22, 0.14]]){
    const sx = (sweep + off) * (CW + CH);
    const fg = c.createLinearGradient(sx - wdt, 0, sx + wdt, 0);
    fg.addColorStop(0, 'rgba(255,255,255,0)');
    fg.addColorStop(0.5, `rgba(255,255,255,${al})`);
    fg.addColorStop(1, 'rgba(255,255,255,0)');
    c.save(); c.rotate(-0.35);
    c.fillStyle = fg;
    c.fillRect(-CH, -60, CW + CH * 2, CH + 160);
    c.restore();
  }
  // gilded double frame + spinning corner gems
  c.strokeStyle = 'rgba(232,185,58,0.9)'; c.lineWidth = 2;
  cardRR(c, 6, 6, CW - 12, CH - 12, 10); c.stroke();
  c.strokeStyle = cardTint(wcol, 0.8); c.lineWidth = 1.2;
  cardRR(c, 11, 11, CW - 22, CH - 22, 7); c.stroke();
  c.fillStyle = '#ffd24a';
  for (const [dx2, dy2] of [[18, 18], [CW - 18, 18], [18, CH - 18], [CW - 18, CH - 18]]){
    c.save(); c.translate(dx2, dy2); c.rotate(Math.PI / 4 + t * 0.8);
    c.fillRect(-3, -3, 6, 6); c.restore();
  }
}

/* ---------------- Dino Studio ----------------
   Up to three player-designed dinosaurs (species + name + colors). Each named
   design possesses one matching spawn per wave and parades its name overhead. */
function buildStudio(){
  const el = $('#studioList');
  if (!el) return;
  el.innerHTML = '';
  if (!save.studio) save.studio = [];
  if (!save.studio.length){
    el.innerHTML = '<div class="sub">No designs yet — tap “New dino” and make it yours.</div>';
  }
  save.studio.forEach((d, i) => {
    const row = document.createElement('div');
    row.className = 'studioRow';
    const opts = Object.entries(DINOS).filter(([, def]) => !def.boss)
      .map(([k, def]) => `<option value="${k}"${d.sp === k ? ' selected' : ''}>${def.name}${def.flying ? ' 🦅' : def.water ? ' 🌊' : ''}</option>`).join('');
    row.innerHTML =
      `<input class="stName" maxlength="14" placeholder="Name your dino…" value="${(d.name || '').replace(/"/g, '&quot;')}">` +
      `<select class="stSp">${opts}</select>` +
      `<label class="stCol">Body <input type="color" class="stBody" value="${d.body}"></label>` +
      `<label class="stCol">Belly <input type="color" class="stBelly" value="${d.belly}"></label>` +
      `<button class="stDel" title="Delete this design">🗑</button>`;
    row.querySelector('.stName').oninput  = e => { d.name = e.target.value.trim(); persist(); };
    row.querySelector('.stSp').onchange   = e => { d.sp = e.target.value; persist(); };
    row.querySelector('.stBody').oninput  = e => { d.body = e.target.value; persist(); };
    row.querySelector('.stBelly').oninput = e => { d.belly = e.target.value; persist(); };
    row.querySelector('.stDel').onclick   = () => { save.studio.splice(i, 1); persist(); buildStudio(); };
    el.appendChild(row);
  });
  $('#studioAdd').disabled = save.studio.length >= 3;
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
  '<b>🦅 The White Pteranodon</b> rides in on waves 40 and 80 — a giant bone-white terror that ONLY air-capable weapons (Gatling, Sniper, Cryo, Tesla, Sonic, Missiles) can hurt. Mortars, flame and gas are useless against it, and even Omega can\'t reach it. Check your air coverage before wave 40.',
  '<b>🧱 The Proving Grounds has no road</b> — dinosaurs pour in at the centre-left and freely roam for the centre-right exit. Your weapons ARE the walls: build a zig-zag maze so they trudge past your guns again and again. You can never seal the field completely — and flyers just soar straight over the top, so keep anti-air everywhere.',
  '<b>🌊 Mosasaur Lagoon</b> has two lanes: a jungle road AND a river. Aquatic dinosaurs (Ichthyosaurus, Plesiosaurus, Kronosaurus — and the MOSASAURUS) swim the channel; they never burn, and they dive under gas clouds. Cover both lanes or the water will eat you alive.',
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
  $('#optStickAll').checked = save.settings.allStickers;
  $('#optMute').checked = save.settings.mute;
  $('#optAuto').checked = save.settings.auto;
  $('#optMusic').checked = save.settings.music;
  $('#optPreview').checked = save.settings.wavePreview;
  $('#optCallouts').checked = save.settings.killCallouts;
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
  // last stand: with the base nearly dead and a dino closing on the gate,
  // time itself flinches — a heartbeat of slow motion so the moment lands
  if (G.slowmoT > 0){ G.slowmoT -= dt; dt *= 0.35; }
  else if (G.slowmoCd > 0) G.slowmoCd -= dt;
  if (G.slowmoT <= 0 && G.slowmoCd <= 0 && !G.over && !save.settings.invincible &&
      G.lives > 0 && G.lives <= Math.max(3, G.maxLives * 0.08)){
    for (const d of G.dinos){
      if (d.dead || d.leaked) continue;
      const nearEnd = d.mx !== undefined ? d.mx > W - 150 : d.dist > G.paths[d.pathI].len - 140;
      if (nearEnd){
        G.slowmoT = 1.3; G.slowmoCd = 7;         // at most once every few seconds
        G.hurtT = Math.max(G.hurtT, 0.5);
        SFX.heartbeat();
        break;
      }
    }
  }
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
      if (s.custom){                       // a Dino Studio original takes the field
        const d = G.dinos[G.dinos.length - 1];
        d.pal = {body: s.custom.body, belly: s.custom.belly, accent: d.pal.accent};
        d.custom = s.custom.name;
      }
    }
    if (!G.spawnQ.length && G.dinos.length === 0) endWave();
  }
  if (!G.waveActive && G.rushT > 0) G.rushT -= dt;   // the rush bonus melts away
  if (G.autoTimer > 0){
    G.autoTimer -= dt;
    if (G.autoTimer <= 0) startWave();
  }
  for (const t of G.towers) fireTower(t, dt);
  runZapQ(dt);
  updateDinos(dt);
  updateTourists(dt);
  updateSnatch(dt);
  updateProjs(dt);
  updateStrikes(dt);
  updateClouds(dt);
  updateOmega(dt);
  // Boss finales run beside normal combat. Only their one decisive impact is
  // stateful; all of the flourishes in drawBossDeath are deterministic art.
  for (const c of G.corpses){
    c.t += dt;
    if (!c.thudded && c.t >= c.impact){
      c.thudded = true;
      if (c.key === 'drex' || c.key === 'mosasaurus') SFX.boom();
      else if (c.key === 'spinosaurus' || c.key === 'indominus') SFX.shatter();
      else SFX.thud();
      G.shake = Math.max(G.shake, c.key === 'drex' ? 14 : c.key === 'giganotosaurus' || c.key === 'trex' ? 10 : 7);
      if (c.key === 'mosasaurus'){
        addFx('ring', c.x, c.y, c.size * 1.5);
        addFx('ring', c.x + c.dir * c.size * .8, c.y, c.size);
      } else if (c.key === 'drex'){
        addFx('shock', c.x, c.y, c.size * 2.2);
        addFx('boom', c.x, c.y - c.size * .3, c.size * 1.2);
        for (let i = 0; i < 9; i++) addFx('spark', c.x + rand(-c.size, c.size), c.y - rand(0, c.size), 8);
      } else {
        addFx('dust', c.x + c.dir * c.size * .65, c.y, c.size * 1.15);
        addFx('dust', c.x + c.dir * c.size * 1.25, c.y + 4, c.size * .8);
        if (c.key === 'spinosaurus' || c.key === 'indominus')
          for (let i = 0; i < 5; i++) addFx('spark', c.x + rand(-c.size, c.size), c.y - rand(0, c.size * 1.3), 7);
      }
    }
  }
  G.corpses = G.corpses.filter(c => c.t < c.dur);
  for (const f of G.fx) f.t += dt;
  G.fx = G.fx.filter(f => f.t < f.dur);
  for (const f of G.decals) f.t += dt;
  G.decals = G.decals.filter(f => f.t < f.dur);
  for (const b of G.bolts) b.t -= dt;
  G.bolts = G.bolts.filter(b => b.t > 0);
  for (const tx of G.texts) tx.t += dt;
  G.texts = G.texts.filter(tx => tx.t < (tx.dur || 1.4));
  if (G.banner){ G.banner.t -= dt; if (G.banner.t <= 0) G.banner = null; }
}

function bossDeathRand(c, i){
  const n = Math.sin(c.seed * 12.9898 + i * 78.233) * 43758.5453;
  return n - Math.floor(n);
}
function bossDeathPaint(gc, c, o){
  o = o || {};
  const alpha = o.alpha === undefined ? 1 : o.alpha;
  if (alpha <= 0) return;
  gc.save();
  gc.globalAlpha = alpha;
  gc.translate(o.x === undefined ? c.x : o.x, o.y === undefined ? c.y : o.y);
  if (c.dir < 0) gc.scale(-1, 1);
  gc.rotate(o.rot || 0);
  gc.scale(c.size * (o.sx === undefined ? 1 : o.sx), c.size * (o.sy === undefined ? 1 : o.sy));
  const hadHideSail = Object.prototype.hasOwnProperty.call(c, 'hideSail'), oldHideSail = c.hideSail;
  c.hideSail = !!o.hideSail;
  PAINTERS[c.painter](gc, c, o.phase === undefined ? c.phase : o.phase);
  if (hadHideSail) c.hideSail = oldHideSail; else delete c.hideSail;
  gc.restore();
}
function bossDeathShadow(gc, c, x, rx, alpha){
  gc.save(); gc.globalAlpha = alpha; gc.fillStyle = '#050403';
  gc.beginPath(); gc.ellipse(x, c.y + 3, rx, c.size * .22, 0, 0, Math.PI * 2); gc.fill(); gc.restore();
}
function bossDeathCracks(gc, c, grow, alpha){
  gc.save(); gc.globalAlpha = alpha; gc.strokeStyle = '#241915'; gc.lineWidth = Math.max(2, c.size * .045); gc.lineCap = 'round';
  for (let i = 0; i < 7; i++){
    const a = -.15 + i * Math.PI / 6, len = c.size * grow * (.65 + bossDeathRand(c, i) * .9);
    const x0 = c.x + c.dir * c.size * .55, y0 = c.y + 2, x1 = x0 + Math.cos(a) * len, y1 = y0 + Math.sin(a) * len * .3;
    gc.beginPath(); gc.moveTo(x0, y0); gc.lineTo(x0 + (x1 - x0) * .55, y0 + (y1 - y0) * .55);
    gc.lineTo(x1, y1); gc.lineTo(x1 + Math.cos(a + .8) * len * .18, y1 + Math.sin(a + .8) * len * .08); gc.stroke();
  }
  gc.restore();
}
function drawBossDeath(gc, c){
  const t = c.t, s = c.size, dir = c.dir;
  const fade = clamp((c.dur - t) / .72, 0, 1);

  if (c.key !== 'mosasaurus' && c.key !== 'drex'){
    const sx = c.key === 'whiteptera' ? c.x + dir * s * 1.15 : c.x + dir * s * .45;
    bossDeathShadow(gc, c, sx, s * (c.key === 'blue' || c.key === 'indoraptor' ? 1.15 : 1.5), .3 * fade);
  }

  if (c.key === 'blue'){
    const k = clamp(t / c.impact, 0, 1), e = 1 - Math.pow(1 - k, 3);
    const x = c.x + dir * s * .92 * e, y = c.y - Math.sin(k * Math.PI) * s * .72;
    const rot = k * (Math.PI * 2 + 1.18);
    if (k < 1) for (let i = 3; i >= 1; i--){
      const q = clamp(k - i * .07, 0, 1), qe = 1 - Math.pow(1 - q, 3);
      bossDeathPaint(gc, c, {x:c.x + dir*s*.92*qe, y:c.y - Math.sin(q*Math.PI)*s*.72,
        rot:q*(Math.PI*2+1.18), alpha:.11*fade*(4-i), phase:c.phase+q*7});
    }
    if (t > c.impact){
      const q = clamp((t - c.impact) / 1.1, 0, 1);
      gc.save(); gc.globalAlpha = (1-q) * .65 * fade; gc.strokeStyle = '#21353d'; gc.lineWidth = 2;
      for (let i=0;i<4;i++){gc.beginPath();gc.moveTo(x-dir*s*(.45+i*.3)*q,c.y+3+i*2);gc.lineTo(x-dir*s*(1.45+i*.25),c.y+3+i*2);gc.stroke();} gc.restore();
    }
    bossDeathPaint(gc, c, {x,y,rot,alpha:fade,phase:c.phase+t*8});
    return;
  }

  if (c.key === 'trex'){
    const rear = t < .38 ? Math.sin(t / .38 * Math.PI) : 0;
    const k = clamp((t - .32) / (c.impact - .32), 0, 1), e = k*k*(3-2*k);
    const x = c.x + dir*s*.42*e, rot = -rear*.24 + e*1.48;
    if (t > c.impact) bossDeathCracks(gc,c,clamp((t-c.impact)/.42,0,1),.72*fade);
    bossDeathPaint(gc, c, {x,y:c.y-rear*s*.08,rot,alpha:fade,phase:c.phase+t*.55});
    return;
  }

  if (c.key === 'spinosaurus'){
    const tear = clamp((t - .28) / 1.28, 0, 1);
    if (tear > 0) for (let i=0;i<10;i++){
      const r=bossDeathRand(c,i), a=(-1.65+i*.34)+(r-.5)*.35, d=s*tear*(.55+r*.85);
      const x=c.x+dir*(s*(-.26+i*.085)+Math.cos(a)*d), y=c.y-s*(1.16+Math.sin(i/9*Math.PI)*.47)+Math.sin(a)*d*.8+s*tear*tear*.75;
      gc.save();gc.translate(x,y);gc.rotate(a+tear*5*(r-.5));gc.globalAlpha=(1-tear*.7)*fade;gc.fillStyle=i%2?c.pal.accent:'#d6a060';
      gc.beginPath();gc.moveTo(-s*.09,0);gc.lineTo(s*.08,-s*(.16+r*.16));gc.lineTo(s*.11,s*.06);gc.closePath();gc.fill();gc.restore();
    }
    const shiver = t < .5 ? Math.sin(t*54)*(1-t/.5) : 0;
    const k=clamp((t-.46)/(c.impact-.46),0,1),e=1-Math.pow(1-k,3);
    bossDeathPaint(gc,c,{x:c.x+dir*s*.48*e,y:c.y,rot:shiver*.035+e*1.4,alpha:fade,
      phase:c.phase+shiver*.7,hideSail:t>.34});
    return;
  }

  if (c.key === 'indominus'){
    const glitch=clamp(1-t/1.18,0,1), k=clamp((t-.86)/(c.impact-.86),0,1),e=k*k*(3-2*k);
    if (glitch>0){
      bossDeathPaint(gc,c,{x:c.x-dir*s*.18,y:c.y-s*.05,rot:e*1.42,alpha:.13*glitch*fade,sx:1.03,sy:.97,phase:c.phase+t*6});
      bossDeathPaint(gc,c,{x:c.x+dir*s*.16,y:c.y+s*.04,rot:e*1.42,alpha:.17*glitch*fade,sx:.98,sy:1.04,phase:c.phase-t*5});
      gc.save();gc.globalAlpha=.55*glitch*fade;for(let i=0;i<7;i++){const r=bossDeathRand(c,i+20),yy=c.y-s*(.15+r*1.05);gc.fillStyle=i%2?'#b9ffff':'#e6d7ff';gc.fillRect(c.x-dir*s*(.7+r*.7),yy,dir*s*(.35+r*.65),2+r*3);}gc.restore();
    }
    const flicker=glitch>0&&Math.floor(t*18)%4===0?.28:1;
    bossDeathPaint(gc,c,{x:c.x+dir*s*.45*e,y:c.y,rot:e*1.42,alpha:fade*flicker,phase:c.phase+t*1.8});
    return;
  }

  if (c.key === 'indoraptor'){
    const k=clamp(t/c.impact,0,1),x=c.x+dir*s*.98*k,y=c.y-Math.sin(k*Math.PI)*s*1.18,rot=-k*(Math.PI*2+1.32);
    if (k<1){gc.save();gc.strokeStyle='#c9a955';gc.lineWidth=3;gc.globalAlpha=.55*(1-k)*fade;for(let i=0;i<5;i++){const q=clamp(k-i*.06,0,1);gc.beginPath();gc.moveTo(c.x+dir*s*(q*.98-.55),c.y-Math.sin(q*Math.PI)*s*1.18-s*(i-.7)*.12);gc.lineTo(c.x+dir*s*q*.98,c.y-Math.sin(q*Math.PI)*s*1.18);gc.stroke();}gc.restore();}
    bossDeathPaint(gc,c,{x,y,rot,alpha:fade,phase:c.phase+t*11});
    return;
  }

  if (c.key === 'giganotosaurus'){
    const stagger=clamp(t/1.22,0,1), fall=clamp((t-1.18)/(c.impact-1.18),0,1),e=1-Math.pow(1-fall,3);
    const step=Math.floor(Math.min(t,1.15)/.23), x=c.x+dir*s*(step*.075+e*.46);
    const reel=(1-stagger)*Math.sin(t*17)*.075-stagger*.10+e*1.56;
    if(t>c.impact)bossDeathCracks(gc,c,clamp((t-c.impact)/.34,0,1),.9*fade);
    bossDeathPaint(gc,c,{x,y:c.y-Math.abs(Math.sin(t*13))*(1-e)*s*.035,rot:reel,alpha:fade,phase:c.phase+step*Math.PI});
    return;
  }

  if (c.key === 'drex'){
    const implode=clamp((t-1.08)/(c.impact-1.08),0,1), burst=clamp((t-c.impact)/1.25,0,1);
    gc.save();gc.globalAlpha=.34*fade;gc.fillStyle='#100807';gc.beginPath();gc.ellipse(c.x,c.y+4,s*(.65+burst*1.35),s*(.15+burst*.22),0,0,Math.PI*2);gc.fill();
    gc.globalAlpha=.28*(1-burst)*fade;gc.fillStyle='#b51f18';gc.beginPath();gc.ellipse(c.x,c.y,s*(.45+burst*1.6),s*(.18+burst*.9),0,0,Math.PI*2);gc.fill();gc.restore();
    if(t<c.impact){
      const conv=(1-implode)*Math.sin(t*31),sc=1-implode*.82;
      bossDeathPaint(gc,c,{x:c.x+conv*s*.045,y:c.y-conv*s*.025,rot:conv*.035,alpha:fade*(1-implode*.2),sx:sc*(1+Math.sin(t*19)*.035),sy:sc*(1-Math.sin(t*19)*.035),phase:c.phase+t*9});
    }
    if(t>.75){
      const power=t<c.impact?clamp((t-.75)/.8,0,1):1-burst;
      gc.save();gc.lineCap='round';for(let i=0;i<12;i++){const a=i*Math.PI/6+bossDeathRand(c,i+40)*.22,len=s*power*(.55+(i%4)*.27+burst*1.2);gc.strokeStyle=i%3?'#461816':'#e1452f';gc.lineWidth=Math.max(2,s*(.055-burst*.025));gc.globalAlpha=.75*power*fade;gc.beginPath();gc.moveTo(c.x,c.y-s*.35);gc.lineTo(c.x+Math.cos(a)*len*.45,c.y-s*.35+Math.sin(a)*len*.35);gc.lineTo(c.x+Math.cos(a+.12)*len,c.y-s*.35+Math.sin(a+.12)*len*.62);gc.stroke();}gc.restore();
    }
    return;
  }

  if (c.key === 'whiteptera'){
    const k=clamp(t/c.impact,0,1),x=c.x+dir*s*1.55*k,y=c.y+s*1.36*k-Math.sin(k*Math.PI)*s*.28,rot=k*(Math.PI*4+.34);
    gc.save();for(let i=0;i<11;i++){const q=clamp((t-i*.055)/c.impact,0,1),r=bossDeathRand(c,i+60);gc.globalAlpha=(1-q)*.68*fade;gc.fillStyle=i%3?'#eeeae0':'#bbb7ae';gc.translate(0,0);const fx=c.x+dir*s*(q*1.5+(r-.5)*.7),fy=c.y-s*(1.35-q*1.6)+Math.sin(q*9+i)*s*.18;gc.beginPath();gc.ellipse(fx,fy,s*.055,s*.17,q*5+r,0,Math.PI*2);gc.fill();}gc.restore();
    bossDeathPaint(gc,c,{x,y,rot,alpha:fade,phase:c.phase+t*10});
    return;
  }

  if (c.key === 'mosasaurus'){
    const k=clamp(t/c.impact,0,1),sink=clamp((t-c.impact)/1.5,0,1);
    const x=c.x+dir*s*.7*k,y=c.y-Math.sin(k*Math.PI)*s*1.38+sink*s*.48,rot=-.38+k*.82+sink*.18;
    gc.save();
    if(t>c.impact){const q=clamp((t-c.impact)/1.2,0,1);gc.strokeStyle='#c9f5ff';gc.lineWidth=Math.max(2,s*.055*(1-q));gc.globalAlpha=(1-q)*.8*fade;for(let i=0;i<3;i++){gc.beginPath();gc.ellipse(x,c.y+2,s*(.45+q*(1.2+i*.55)),s*(.08+q*.12),0,0,Math.PI*2);gc.stroke();}
      for(let i=0;i<14;i++){const r=bossDeathRand(c,i+80),a=-Math.PI+r*Math.PI,d=s*q*(.4+r*1.2);gc.fillStyle=i%2?'#dffaff':'#66cbe4';gc.beginPath();gc.arc(x+Math.cos(a)*d,c.y-Math.sin(a)*d+s*q*q*.65,s*(.035+r*.055),0,Math.PI*2);gc.fill();}}
    gc.restore();
    bossDeathPaint(gc,c,{x,y,rot,alpha:fade*(1-sink*.72),phase:c.phase+t*3});
    return;
  }

  const k=clamp(t/c.impact,0,1),e=1-Math.pow(1-k,3);
  bossDeathPaint(gc,c,{x:c.x+dir*s*.5*e,y:c.y,rot:e*1.35,alpha:fade});
}

function render(dt){
  G.time += dt;
  ctx.save();
  // clear the whole buffer first: when the mobile camera is panned/zoomed the
  // margin outside the map shows this clean dark stage colour instead of smear
  ctx.fillStyle = '#0a0d08'; ctx.fillRect(0, 0, W, H);
  if (G.shake > 0) ctx.translate(rand(-G.shake, G.shake), rand(-G.shake, G.shake));
  // decay shake here (in render, which always runs) rather than in step —
  // step is skipped once the run is over, so a leftover shake used to freeze
  // on and rattle the victory/defeat screen forever
  G.shake = Math.max(0, G.shake - dt * 18);
  // ---- world camera: pan/zoom on mobile, identity (zoom 1, no pan) on desktop ----
  ctx.save();
  ctx.scale(G.cam.zoom, G.cam.zoom);
  ctx.translate(-G.cam.x, -G.cam.y);
  ctx.drawImage(G.bg, 0, 0);

  // open-world maps: show the one route the column is currently marching —
  // it redraws live as weapons reshape the maze
  if (G.level.maze && G.flow){
    const rp = mazeRoutePts();
    if (rp){
      ctx.save();
      ctx.strokeStyle = 'rgba(232,185,58,0.22)';
      ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.setLineDash([10, 12]); ctx.lineDashOffset = -G.time * 26;   // crawls toward the exit
      ctx.beginPath();
      rp.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
      ctx.stroke();
      ctx.restore();
    }
  }

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

  // Bespoke boss finales sit under live actors and never interrupt the fight.
  for (const c of G.corpses) drawBossDeath(ctx, c);

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
    // electrocution: a full cartoon strobe — WHITE X-RAY frames alternate with
    // PHOTO-NEGATIVE frames (white rim, near-black body), skeleton showing
    // through both, jittering, like a saturday-morning zap gag
    const strobe = d.zapT > 0 ? Math.sin(G.time * 42) : -0.3;
    if (d.zapT > 0 && (strobe > 0.05 || strobe < -0.55)){
      const neg = strobe < -0.55;                        // the negative frame
      ctx.save();
      ctx.translate(rand(-1.5, 1.5), rand(-1.5, 1.5));   // electric jitter
      const orig = d.pal;
      if (neg){
        // white rim first (the dino redrawn slightly larger), then the black body
        d.pal = {body: '#f2f6ff', belly: '#ffffff', accent: '#f2f6ff'};
        ctx.save();
        ctx.translate(p.x, p.y); ctx.scale(1.07, 1.07); ctx.translate(-p.x, -p.y);
        drawDino(ctx, d, p.x, p.y, d.turn, d.phase, 0.8, pitch);
        ctx.restore();
        d.pal = {body: '#141824', belly: '#1d2436', accent: '#141824'};
      } else {
        d.pal = {body: '#e8efff', belly: '#ffffff', accent: '#cfe0ff'};
      }
      drawDino(ctx, d, p.x, p.y, d.turn, d.phase, 0.92, pitch);
      d.pal = orig;
      // bones over the flash: skull + jaw, spine + tail vertebrae, ribs, leg
      // and toe bones — drawn in BODY space so they ride the dino's flip/pitch
      const s = d.size;
      ctx.translate(p.x, p.y);
      const tx3 = (d.turn === undefined ? 1 : d.turn);
      ctx.scale(Math.sign(tx3 || 1) * Math.max(0.08, Math.abs(tx3)), 1);
      if (pitch){ ctx.translate(0, -s * 0.6); ctx.rotate(pitch); ctx.translate(0, s * 0.6); }
      const cy = -s * (d.flying ? 1.55 : 0.62);
      const boneCol = neg ? 'rgba(235,245,255,0.95)' : 'rgba(50,60,76,0.9)';
      ctx.strokeStyle = boneCol; ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(1.2, s * 0.055);
      ctx.beginPath(); ctx.moveTo(-s * 0.6, cy + s * 0.04);               // spine
      ctx.quadraticCurveTo(0, cy - s * 0.14, s * 0.42, cy - s * 0.06);
      ctx.stroke();
      ctx.lineWidth = Math.max(1, s * 0.035);
      ctx.beginPath(); ctx.moveTo(-s * 0.6, cy + s * 0.04);               // tail spine
      ctx.lineTo(-s * 0.95, cy - s * 0.04); ctx.stroke();
      for (let i = 1; i <= 3; i++){                                       // tail vertebrae
        const q = i / 4, vx3 = -s * 0.6 - s * 0.35 * q, vy3 = cy + s * 0.04 - s * 0.08 * q;
        ctx.beginPath(); ctx.moveTo(vx3, vy3 - s * 0.04); ctx.lineTo(vx3, vy3 + s * 0.04); ctx.stroke();
      }
      ctx.lineWidth = Math.max(1, s * 0.04);
      for (let i = 0; i < 3; i++){                                        // ribs
        const rx = -s * (0.32 - i * 0.22);
        ctx.beginPath(); ctx.arc(rx, cy - s * 0.02, s * 0.17, 0.25, Math.PI - 0.25); ctx.stroke();
      }
      if (!d.flying){                                                     // leg + toe bones
        ctx.beginPath(); ctx.moveTo(0, cy + s * 0.12); ctx.lineTo(s * 0.08, -s * 0.1); ctx.stroke();
        ctx.lineWidth = Math.max(1, s * 0.03);
        ctx.beginPath(); ctx.moveTo(s * 0.08, -s * 0.1); ctx.lineTo(s * 0.17, -s * 0.04); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(s * 0.08, -s * 0.1); ctx.lineTo(s * 0.16, -s * 0.11); ctx.stroke();
      }
      ctx.lineWidth = Math.max(1, s * 0.04);
      ctx.beginPath(); ctx.moveTo(s * 0.38, cy - s * 0.08);               // grinning jawline
      ctx.quadraticCurveTo(s * 0.53, cy - s * 0.04, s * 0.65, cy - s * 0.1); ctx.stroke();
      ctx.lineWidth = Math.max(1, s * 0.03);
      for (let i = 0; i < 3; i++){                                        // teeth
        const jx = s * (0.44 + i * 0.07);
        ctx.beginPath(); ctx.moveTo(jx, cy - s * 0.07); ctx.lineTo(jx + s * 0.015, cy - s * 0.03); ctx.stroke();
      }
      ctx.fillStyle = boneCol;                                            // eye socket…
      ctx.beginPath(); ctx.arc(s * 0.52, cy - s * 0.2, Math.max(1.6, s * 0.08), 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(255,220,110,0.4)';                            // …glowing like a
      ctx.beginPath(); ctx.arc(s * 0.52, cy - s * 0.2, Math.max(2.6, s * 0.14), 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff2b0';                                          // …lightbulb filament
      ctx.beginPath(); ctx.arc(s * 0.52, cy - s * 0.2, Math.max(1, s * 0.045), 0, Math.PI*2); ctx.fill();
      // static frazzle: the hide stands on end in jagged electric spikes
      ctx.strokeStyle = neg ? 'rgba(225,245,255,0.9)' : 'rgba(120,220,255,0.85)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 7; i++){
        const a2 = i * 0.9 + G.time * 3;
        const hx = Math.cos(a2) * s * 0.62, hy = cy + Math.sin(a2) * s * 0.42;
        const dx2 = Math.cos(a2), dy2 = Math.sin(a2);
        ctx.beginPath(); ctx.moveTo(hx, hy);
        ctx.lineTo(hx + dx2 * s * 0.09 + rand(-1.5, 1.5), hy + dy2 * s * 0.09 + rand(-1.5, 1.5));
        ctx.lineTo(hx + dx2 * s * 0.17 + rand(-2, 2), hy + dy2 * s * 0.17 + rand(-2, 2));
        ctx.stroke();
      }
      ctx.restore();
    }
    // zap hangover: for a moment after the strobe the dino is sooty and
    // smoking, with leftover static still crawling over its hide
    if (d.zapT <= 0 && d.charT > 0){
      const ck = Math.min(1, d.charT);
      const orig = d.pal;
      d.pal = {body: '#232228', belly: '#3a3840', accent: '#232228'};
      drawDino(ctx, d, p.x, p.y, d.turn, d.phase, 0.34 * ck, pitch);
      d.pal = orig;
      const s = d.size, byT = p.y - s * (d.flying ? 1.55 : 0.62);
      if (Math.random() < 0.12 && G.fx.length < 340){
        G.fx.push({kind: 'zsmoke', x: p.x + rand(-s * 0.4, s * 0.4), y: byT - s * 0.2,
                   seed: Math.random() * 9, t: 0, dur: 0.7});
      }
      if (Math.random() < 0.3){
        ctx.strokeStyle = `rgba(160,240,255,${0.7 * ck})`; ctx.lineWidth = 1;
        for (let i = 0; i < 2; i++){
          const ax = p.x + rand(-s * 0.4, s * 0.4), ay = byT + rand(-s * 0.25, s * 0.25);
          ctx.beginPath(); ctx.moveTo(ax, ay);
          ctx.lineTo(ax + rand(-5, 5), ay + rand(-4, 4));
          ctx.lineTo(ax + rand(-7, 7), ay + rand(-5, 5)); ctx.stroke();
        }
      }
    }
    // ON FIRE: flickering flame tongues dance on the dino's back while it burns,
    // with embers rising off it and a heat glow on the body. Drawn in BODY
    // space (same translate/flip/pitch transform as the dino itself) so the
    // fire stays glued to its back as it rotates through corners.
    if (d.burnT > 0){
      const s = d.size;
      ctx.save();
      ctx.translate(p.x, p.y);
      const tx2 = (d.turn === undefined ? 1 : d.turn);
      ctx.scale(Math.sign(tx2 || 1) * Math.max(0.08, Math.abs(tx2)), 1);
      if (pitch){ ctx.translate(0, -s * 0.6); ctx.rotate(pitch); ctx.translate(0, s * 0.6); }
      ctx.fillStyle = 'rgba(255,120,20,0.22)';   // heat glow on the body
      ctx.beginPath(); ctx.arc(0, -s * 0.7, s * 0.55, 0, Math.PI*2); ctx.fill();
      const by = -s * (d.flying ? 1.55 : 1.0);   // the back, in body space
      const fl = G.time * 14 + d.phase * 3;
      for (let i = -1; i <= 1; i++){             // three tongues, center one tallest
        const fx2 = i * s * 0.26 + Math.sin(fl + i * 2) * 1.5;
        const h  = s * (0.4 + 0.15 * Math.sin(fl * 1.3 + i * 2.4)) * (i === 0 ? 1.3 : 0.85);
        const w2 = s * 0.15 * (i === 0 ? 1.25 : 0.9);
        const tip = Math.sin(fl * 1.7 + i) * w2 * 0.6;
        ctx.fillStyle = 'rgba(255,110,20,0.85)';
        ctx.beginPath();
        ctx.moveTo(fx2 - w2, by);
        ctx.quadraticCurveTo(fx2 - w2 * 0.6, by - h * 0.55, fx2 + tip, by - h);
        ctx.quadraticCurveTo(fx2 + w2 * 0.7, by - h * 0.5, fx2 + w2, by);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,225,100,0.9)'; // hot yellow core
        ctx.beginPath();
        ctx.moveTo(fx2 - w2 * 0.45, by);
        ctx.quadraticCurveTo(fx2 - w2 * 0.25, by - h * 0.35, fx2 + tip * 0.5, by - h * 0.58);
        ctx.quadraticCurveTo(fx2 + w2 * 0.42, by - h * 0.3, fx2 + w2 * 0.45, by);
        ctx.closePath(); ctx.fill();
      }
      for (let i = 0; i < 3; i++){               // rising embers
        const cyc = (G.time * 1.5 + i * 0.37 + (d.phase * 0.16 % 1)) % 1;
        ctx.fillStyle = `rgba(255,${140 + i * 35},40,${0.75 * (1 - cyc)})`;
        ctx.beginPath();
        ctx.arc(Math.sin(G.time * 3 + i * 2.5) * s * 0.3, by - s * 0.35 - cyc * s * 0.9,
                1 + (1 - cyc) * 0.8, 0, Math.PI*2);
        ctx.fill();
      }
      ctx.restore();
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
    // Dino Studio original: its given name floats overhead
    if (d.custom){
      const y0 = p.y - d.size * (d.flying ? 2.1 : 1.6) - 13;
      ctx.font = 'bold 11px Verdana, sans-serif'; ctx.textAlign = 'center';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.lineJoin = 'round';
      ctx.strokeText('⭐ ' + d.custom, p.x, y0);
      ctx.fillStyle = '#ffe9a8'; ctx.fillText('⭐ ' + d.custom, p.x, y0);
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
  // a fully-maxed Tesla charges the air: its neighbors pick up St. Elmo's fire
  const stormy = G.towers.filter(z => z.key === 'tesla' && (z.ulv || 0) >= (TOWERS.tesla.maxUp || 2));
  for (const t of G.towers) depth.push({y: t.y + 12, t});
  for (const d of ground) depth.push({y: dinoPos(d).y, d});
  for (const u of G.tourists) if (u.dist > -1) depth.push({y: u.py, u});
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
      // stray corona sparks dance on weapons parked near a maxed Tesla
      if (t.key !== 'tesla' && stormy.some(z => hyp(t.x, t.y, z.x, z.y) < 95)){
        const fl = Math.sin(G.time * 9 + t.x * 0.7);
        if (fl > 0.45){
          const ex = t.x + Math.sin(G.time * 23 + t.y) * 2.5, ey = t.y - 25 - Math.sin(G.time * 17 + t.x) * 2;
          ctx.fillStyle = `rgba(195,155,255,${0.4 + 0.5 * (fl - 0.45)})`;
          ctx.beginPath(); ctx.arc(ex, ey, 1.4, 0, Math.PI*2); ctx.fill();
          ctx.strokeStyle = 'rgba(195,155,255,0.5)'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex + rand(-3, 3), ey - rand(2, 5)); ctx.stroke();
        }
      }
    } else if (it.d){
      drawOne(it.d);
    } else { // a fleeing visitor (fades out as they clear the map edge)
      const u = it.u, over = u.dist - G.paths[u.pathI].len;
      drawTourist(ctx, u, u.px, u.py, u.turn, u.phase, clamp(1 - Math.max(0, over - 30) / 50, 0, 1), u.pitch);
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
  // bolts (tesla / sniper tracer) — layered glow + core + white-hot center
  for (const b of G.bolts){
    if (b.jag){
      // one jagged polyline, re-rolled every frame so the arc writhes
      const n = 7, pts = [[b.x1, b.y1]];
      for (let i = 1; i < n; i++){
        const t = i/n;
        pts.push([b.x1 + (b.x2-b.x1)*t + rand(-8, 8), b.y1 + (b.y2-b.y1)*t + rand(-8, 8)]);
      }
      pts.push([b.x2, b.y2]);
      const trace = () => {
        ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.stroke();
      };
      // the very first frame renders PURE WHITE — lightning reads as a flash
      // first and a colored shape second
      const hot = b.flash > 0; if (hot) b.flash--;
      ctx.strokeStyle = hot ? 'rgba(255,255,255,0.5)' : (b.glow || 'rgba(60,160,255,0.28)');
      ctx.lineWidth = b.w * 3.4; trace();
      ctx.strokeStyle = hot ? '#ffffff' : b.color; ctx.lineWidth = b.w * 1.35; trace();
      ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = b.w * 0.5; trace();
      // stray forks snapping off the main arc
      for (let f = 0; f < 2; f++){
        if (Math.random() < 0.65){
          const [fx0, fy0] = pts[1 + (Math.random() * (pts.length - 2) | 0)];
          ctx.strokeStyle = b.color; ctx.lineWidth = b.w * 0.55;
          ctx.beginPath(); ctx.moveTo(fx0, fy0);
          ctx.lineTo(fx0 + rand(-16, 16), fy0 + rand(-16, 16)); ctx.stroke();
        }
      }
    } else {
      if (b.glow){ // tracer glow sheath
        ctx.strokeStyle = b.glow; ctx.lineWidth = b.w * 3;
        ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
      }
      ctx.strokeStyle = b.color; ctx.lineWidth = b.w;
      ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
    }
  }
  // residual chain arcs: dinos the tesla chained stay visibly LINKED for a
  // beat after the strike — a thin writhing thread of leftover current
  for (const l of G.links){
    if (l.a.dead || l.a.leaked || l.b.dead || l.b.leaked) continue;
    const pa = dinoPos(l.a), pb = dinoPos(l.b);
    const la = 0.55 * (l.t / 0.45);
    ctx.strokeStyle = l.maxed ? `rgba(210,160,255,${la})` : `rgba(140,230,255,${la})`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pa.x, pa.y - l.a.size * 0.5);
    for (let i = 1; i < 5; i++){
      const k2 = i / 5;
      ctx.lineTo(pa.x + (pb.x - pa.x) * k2 + rand(-3, 3),
                 (pa.y - l.a.size * 0.5) + ((pb.y - l.b.size * 0.5) - (pa.y - l.a.size * 0.5)) * k2 + rand(-3, 3));
    }
    ctx.lineTo(pb.x, pb.y - l.b.size * 0.5); ctx.stroke();
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
      case 'zap': { // electric burst where a tesla arc lands: ring + radial ticks
        const za = 1 - k;
        ctx.strokeStyle = `rgba(190,240,255,${0.85*za})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(f.x, f.y, 3 + k * f.r, 0, Math.PI*2); ctx.stroke();
        ctx.lineWidth = 1.4;
        for (let i = 0; i < 5; i++){
          const an = f.seed + i * 1.256;
          const r1 = 3 + k * f.r, r2 = r1 + 4 + 3 * Math.sin(f.seed * 9 + i * 3);
          ctx.beginPath();
          ctx.moveTo(f.x + Math.cos(an) * r1, f.y + Math.sin(an) * r1);
          ctx.lineTo(f.x + Math.cos(an) * r2, f.y + Math.sin(an) * r2);
          ctx.stroke();
        }
        break;
      }
      case 'zapscar': { // the arc's ionized path hangs in the air and fades
        const a = 0.5 * (1 - k);
        ctx.strokeStyle = f.maxed ? `rgba(200,150,255,${a})` : `rgba(140,225,255,${a})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(f.pts[0][0], f.pts[0][1]);
        for (let i = 1; i < f.pts.length; i++) ctx.lineTo(f.pts[i][0], f.pts[i][1]);
        ctx.stroke();
        break;
      }
      case 'zapglow': { // brief pool of light on the ground under a strike
        const a = 0.3 * (1 - k);
        ctx.save();
        ctx.translate(f.x, f.y); ctx.scale(1, 0.45);
        const zg = ctx.createRadialGradient(0, 0, 0, 0, 0, f.r);
        zg.addColorStop(0, f.maxed ? `rgba(200,150,255,${a})` : `rgba(140,230,255,${a})`);
        zg.addColorStop(1, 'rgba(140,230,255,0)');
        ctx.fillStyle = zg;
        ctx.beginPath(); ctx.arc(0, 0, f.r, 0, Math.PI*2); ctx.fill();
        ctx.restore();
        break;
      }
      case 'wspark': { // white-hot welder spark: ballistic arc + one bounce
        const gAcc = 340, vy0 = f.vy;
        // time the spark first meets the ground, then reflect off it once
        const tg = (-vy0 + Math.sqrt(vy0 * vy0 + 2 * gAcc * (f.gy - f.y))) / gAcc;
        let sx2, sy2;
        if (f.t <= tg){
          sx2 = f.x + f.vx * f.t;
          sy2 = f.y + vy0 * f.t + 0.5 * gAcc * f.t * f.t;
        } else {
          const t2 = f.t - tg, vyb = -(vy0 + gAcc * tg) * 0.45, vxb = f.vx * 0.7;
          sx2 = f.x + f.vx * tg + vxb * t2;
          sy2 = Math.min(f.gy, f.gy + vyb * t2 + 0.5 * gAcc * t2 * t2);
        }
        ctx.fillStyle = `rgba(255,200,120,${0.5 * (1 - k)})`;
        ctx.beginPath(); ctx.arc(sx2, sy2, 2.2, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = `rgba(255,250,225,${0.95 * (1 - k)})`;
        ctx.beginPath(); ctx.arc(sx2, sy2, 1.2, 0, Math.PI*2); ctx.fill();
        break;
      }
      case 'zsmoke': { // little gray puff popping off a freshly-zapped hide
        ctx.fillStyle = `rgba(150,150,160,${0.32 * (1 - k)})`;
        ctx.beginPath();
        ctx.arc(f.x + Math.sin(k * 5 + f.seed) * 2.5, f.y - k * 15, 2 + k * 4.5, 0, Math.PI*2);
        ctx.fill();
        break;
      }
      case 'bones': { // tesla kill: skeleton freezes mid-zap, then crumbles into a pile
        const s = f.r, gy = f.y + 2;
        const cy = f.y - s * (f.fly ? 1.5 : 0.62);       // height the body froze at
        const pr = n => { const v = Math.sin(f.seed * 37.7 + n * 91.3) * 43758.5; return v - Math.floor(v); };
        if (k < 0.14){
          // beat 1: a white-hot afterimage hangs in the air with the skeleton showing
          const a = 1 - k / 0.14;
          ctx.fillStyle = `rgba(240,248,255,${0.7 * a})`;
          ctx.beginPath(); ctx.ellipse(f.x, cy, s * 0.62, s * 0.4, 0, 0, Math.PI*2); ctx.fill();
          ctx.strokeStyle = `rgba(60,72,92,${0.9 * a})`; ctx.lineCap = 'round';
          ctx.lineWidth = Math.max(1.2, s * 0.05);
          ctx.beginPath(); ctx.moveTo(f.x - s * 0.55, cy + s * 0.04);
          ctx.quadraticCurveTo(f.x, cy - s * 0.16, f.x + s * 0.4, cy - s * 0.06); ctx.stroke();
          ctx.lineWidth = Math.max(1, s * 0.04);
          for (let i = 0; i < 3; i++){
            ctx.beginPath(); ctx.arc(f.x - s * (0.3 - i * 0.22), cy, s * 0.16, 0.25, Math.PI - 0.25); ctx.stroke();
          }
          ctx.fillStyle = `rgba(60,72,92,${0.9 * a})`;
          ctx.beginPath(); ctx.arc(f.x + s * 0.5, cy - s * 0.18, Math.max(1.4, s * 0.07), 0, Math.PI*2); ctx.fill();
        } else {
          // beat 2: the bones rain down, settle into a pile, and fade
          const te = f.t - 0.14 * f.dur;                 // seconds since the crumble began
          const kk = (k - 0.14) / 0.86;
          const fade = kk > 0.7 ? 1 - (kk - 0.7) / 0.3 : 1;
          // pile shadow grows as bones land
          ctx.fillStyle = `rgba(0,0,0,${0.22 * fade * Math.min(1, kk * 2)})`;
          ctx.beginPath(); ctx.ellipse(f.x, gy + 2, s * 0.5, s * 0.16, 0, 0, Math.PI*2); ctx.fill();
          ctx.lineCap = 'round';
          for (let i = 0; i < 6; i++){
            const tb = Math.max(0, te - pr(i) * 0.12);   // per-bone drop delay
            const y0 = cy + (pr(i + 5) - 0.5) * s * 0.4;
            const yl = gy + (pr(i + 20) - 0.5) * 4;      // where this bit lands in the pile
            const tl = Math.sqrt(Math.max(0.001, 2 * (yl - y0) / 720));  // time to land
            const tc = Math.min(tb, tl);
            const by = y0 + 0.5 * 720 * tc * tc;
            const bx = f.x + (pr(i + 10) - 0.5) * s * 0.5 + (pr(i + 15) - 0.5) * s * 0.5 * Math.min(1, tb / Math.max(tl, 0.001));
            const rot = (pr(i + 30) - 0.5) * 2 + tc * (pr(i + 40) - 0.5) * 8;
            ctx.save(); ctx.translate(bx, by); ctx.rotate(rot);
            ctx.strokeStyle = `rgba(228,224,210,${0.95 * fade})`;
            ctx.fillStyle = `rgba(228,224,210,${0.95 * fade})`;
            if (i === 0){                                // the skull
              ctx.beginPath(); ctx.arc(0, 0, Math.max(2, s * 0.14), 0, Math.PI*2); ctx.fill();
              ctx.fillStyle = `rgba(40,46,60,${0.9 * fade})`;
              ctx.beginPath(); ctx.arc(s * 0.04, -s * 0.03, Math.max(0.8, s * 0.045), 0, Math.PI*2); ctx.fill();
            } else if (i < 3){                           // rib arcs
              ctx.lineWidth = Math.max(1, s * 0.04);
              ctx.beginPath(); ctx.arc(0, 0, Math.max(1.6, s * 0.12), 0.3, Math.PI - 0.3); ctx.stroke();
            } else {                                     // long bones, knobbed ends
              ctx.lineWidth = Math.max(1.2, s * 0.05);
              ctx.beginPath(); ctx.moveTo(-s * 0.14, 0); ctx.lineTo(s * 0.14, 0); ctx.stroke();
              ctx.beginPath(); ctx.arc(-s * 0.14, 0, Math.max(1, s * 0.035), 0, Math.PI*2); ctx.fill();
              ctx.beginPath(); ctx.arc(s * 0.14, 0, Math.max(1, s * 0.035), 0, Math.PI*2); ctx.fill();
            }
            ctx.restore();
          }
          // smoke rising off the pile + a little static wisp escaping skyward
          ctx.fillStyle = `rgba(150,150,160,${0.3 * (1 - kk)})`;
          ctx.beginPath(); ctx.arc(f.x + Math.sin(kk * 6 + f.seed) * 3, cy - kk * s * 0.9, s * (0.14 + kk * 0.3), 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = `rgba(160,240,255,${0.9 * (1 - kk)})`;
          ctx.beginPath(); ctx.arc(f.x + Math.sin(kk * 9 + f.seed) * s * 0.15, cy - kk * s * 1.7, 1.4, 0, Math.PI*2); ctx.fill();
        }
        break;
      }
      case 'gibs': { // rocket kill: splat-cloud pops, cartoon pieces cartwheel
                     // out on smoke trails, bounce once (same scheme as wspark)
        const s = f.r, gAcc = 520;
        const cy = f.y - s * (f.fly ? 1.5 : 0.62);       // burst at body height
        const pr = n => { const v = Math.sin(f.seed * 37.7 + n * 91.3) * 43758.5; return v - Math.floor(v); };
        const fade = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
        // crimson splat-cloud pops in the first beat
        if (k < 0.22){
          const ka = 1 - k / 0.22;
          for (let i = 0; i < 4; i++){
            ctx.fillStyle = i ? `rgba(168,24,24,${0.5 * ka})` : `rgba(118,12,12,${0.6 * ka})`;
            ctx.beginPath();
            ctx.arc(f.x + (pr(i + 50) - 0.5) * s * 0.7, cy + (pr(i + 55) - 0.5) * s * 0.5,
                    s * (0.2 + i * 0.11) * (0.6 + (k / 0.22) * 0.8), 0, Math.PI*2);
            ctx.fill();
          }
        }
        // a smoke ring hangs where the dino stood
        ctx.strokeStyle = `rgba(140,140,150,${0.3 * (1 - k)})`;
        ctx.lineWidth = Math.max(1.5, s * 0.09 * (1 - k));
        ctx.beginPath(); ctx.ellipse(f.x, cy, s * (0.3 + k * 0.55), s * (0.14 + k * 0.26), 0, 0, Math.PI*2); ctx.stroke();
        ctx.lineCap = 'round';
        for (let i = 0; i < 5; i++){                     // the pieces
          const gy = f.y + 2 + (pr(i + 20) - 0.5) * 6;
          const vx = (pr(i) - 0.5) * 2 * (s * 3 + 60);   // mostly sideways
          const vy0 = -(90 + pr(i + 5) * 110);
          const tg = (-vy0 + Math.sqrt(vy0 * vy0 + 2 * gAcc * (gy - cy))) / gAcc;
          let px, py, airborne;
          if (f.t <= tg){                                // first arc
            airborne = true;
            px = f.x + vx * f.t;
            py = cy + vy0 * f.t + 0.5 * gAcc * f.t * f.t;
            if (f.t > 0.05){                             // thin smoke wisps trail behind
              for (const [back, wa] of [[0.06, 0.3], [0.13, 0.16]]){
                const tw = f.t - back;
                if (tw <= 0) continue;
                ctx.fillStyle = `rgba(160,160,170,${wa * fade})`;
                ctx.beginPath();
                ctx.arc(f.x + vx * tw, cy + vy0 * tw + 0.5 * gAcc * tw * tw, Math.max(1.1, s * 0.055), 0, Math.PI*2);
                ctx.fill();
              }
            }
          } else {                                       // bounced: damped second hop
            const t2 = f.t - tg, vyb = -(vy0 + gAcc * tg) * 0.4, vxb = vx * 0.55;
            const tg2 = -2 * vyb / gAcc;
            const tc = Math.min(t2, tg2);
            airborne = t2 < tg2;
            px = f.x + vx * tg + vxb * tc;
            py = Math.min(gy, gy + vyb * tc + 0.5 * gAcc * tc * tc);
            if (t2 < 0.14){                              // dust tick on the bounce
              ctx.strokeStyle = `rgba(150,130,100,${0.5 * (1 - t2 / 0.14)})`;
              ctx.lineWidth = 1.2;
              ctx.beginPath(); ctx.ellipse(f.x + vx * tg, gy, 2 + t2 * 40, 1 + t2 * 12, 0, Math.PI, Math.PI * 2); ctx.stroke();
            }
          }
          const rot = (pr(i + 30) - 0.5) * 2 + Math.min(f.t, tg + 0.35) * (pr(i + 40) - 0.5) * 14;
          ctx.save(); ctx.translate(px, py); ctx.rotate(rot);
          ctx.globalAlpha = fade;
          if (i === 0){                                  // drumstick: meat + knobbed bone stub
            ctx.fillStyle = f.body;
            ctx.beginPath(); ctx.ellipse(-s * 0.05, 0, s * 0.13, s * 0.09, 0, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = '#e8e4d4'; ctx.lineWidth = Math.max(1.2, s * 0.045);
            ctx.beginPath(); ctx.moveTo(s * 0.06, 0); ctx.lineTo(s * 0.18, 0); ctx.stroke();
            ctx.fillStyle = '#e8e4d4';
            ctx.beginPath(); ctx.arc(s * 0.2, 0, Math.max(1, s * 0.04), 0, Math.PI*2); ctx.fill();
          } else if (i === 1){                           // the tail, a tapered wedge
            ctx.fillStyle = f.body;
            ctx.beginPath(); ctx.moveTo(-s * 0.16, -s * 0.07); ctx.lineTo(s * 0.22, 0); ctx.lineTo(-s * 0.16, s * 0.07); ctx.closePath(); ctx.fill();
          } else if (i === 2){                           // a leg with the foot still on
            ctx.strokeStyle = f.body; ctx.lineWidth = Math.max(1.6, s * 0.07);
            ctx.beginPath(); ctx.moveTo(-s * 0.1, -s * 0.08); ctx.lineTo(0, s * 0.06); ctx.lineTo(s * 0.12, s * 0.08); ctx.stroke();
            ctx.fillStyle = f.belly;
            ctx.beginPath(); ctx.ellipse(s * 0.14, s * 0.08, s * 0.06, s * 0.035, 0, 0, Math.PI*2); ctx.fill();
          } else if (i === 3){                           // rib arc
            ctx.strokeStyle = '#e8e4d4'; ctx.lineWidth = Math.max(1, s * 0.04);
            ctx.beginPath(); ctx.arc(0, 0, Math.max(1.6, s * 0.1), 0.3, Math.PI - 0.3); ctx.stroke();
          } else {                                       // little long bone
            ctx.strokeStyle = '#e8e4d4'; ctx.lineWidth = Math.max(1.2, s * 0.045);
            ctx.beginPath(); ctx.moveTo(-s * 0.1, 0); ctx.lineTo(s * 0.1, 0); ctx.stroke();
            ctx.fillStyle = '#e8e4d4';
            ctx.beginPath(); ctx.arc(-s * 0.1, 0, Math.max(0.9, s * 0.03), 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(s * 0.1, 0, Math.max(0.9, s * 0.03), 0, Math.PI*2); ctx.fill();
          }
          ctx.restore();
        }
        break;
      }
      case 'punt': { // mortar kill: punted off the top of the screen — a beat
                     // of nothing — then a shadow, a slam, and legs in the dirt
        const s = f.r, gy = f.y + 2;
        const pr = n => { const v = Math.sin(f.seed * 37.7 + n * 91.3) * 43758.5; return v - Math.floor(v); };
        const dir = pr(1) > 0.5 ? 1 : -1;
        const tLaunch = 0.55, tSlam = 1.56;              // beats within the 2.6s gag
        const fade = k > 0.88 ? 1 - (k - 0.88) / 0.12 : 1;
        if (f.t < tLaunch){
          // going UP: spinning silhouette, flailing legs, speed lines
          const kk = f.t / tLaunch;
          const py = gy - s * 0.6 - Math.pow(kk, 0.8) * 820;
          ctx.save();
          ctx.translate(f.x + Math.sin(f.t * 9 + f.seed) * s * 0.12, py);
          ctx.rotate(f.t * 12 * dir);
          const sc = 1 - kk * 0.25;                      // shrinks as it recedes
          ctx.scale(sc, sc);
          ctx.fillStyle = f.body;
          ctx.beginPath(); ctx.ellipse(0, 0, s * 0.5, s * 0.3, 0, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.moveTo(-s * 0.45, -s * 0.1); ctx.lineTo(-s * 0.85, 0); ctx.lineTo(-s * 0.45, s * 0.12); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.arc(s * 0.55, -s * 0.12, s * 0.18, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = f.belly;
          ctx.beginPath(); ctx.ellipse(0, s * 0.12, s * 0.34, s * 0.16, 0, 0, Math.PI*2); ctx.fill();
          ctx.strokeStyle = f.body; ctx.lineWidth = Math.max(1.6, s * 0.09); ctx.lineCap = 'round';
          for (const [lx, ph] of [[-s * 0.18, 0], [s * 0.16, 2.2]]){
            const la = Math.sin(f.t * 26 + ph) * 0.8;
            ctx.beginPath(); ctx.moveTo(lx, s * 0.2); ctx.lineTo(lx + Math.sin(la) * s * 0.3, s * 0.2 + Math.cos(la) * s * 0.3); ctx.stroke();
          }
          ctx.restore();
          ctx.strokeStyle = `rgba(255,255,255,${0.4 * (1 - kk)})`; ctx.lineWidth = 1.5;
          for (const lx of [-s * 0.25, s * 0.2]){        // speed lines chasing it
            ctx.beginPath(); ctx.moveTo(f.x + lx, py + s); ctx.lineTo(f.x + lx, py + s + 14 + kk * 10); ctx.stroke();
          }
          if (f.t < 0.18){                               // dust at the tee
            ctx.fillStyle = `rgba(150,130,100,${0.5 * (1 - f.t / 0.18)})`;
            ctx.beginPath(); ctx.ellipse(f.x, gy, s * (0.3 + f.t * 3), s * (0.12 + f.t), 0, 0, Math.PI*2); ctx.fill();
          }
        } else if (f.t < tSlam){
          // gone. a beat… then the landing shadow grows — INCOMING
          const tw = (f.t - (tSlam - 0.32)) / 0.32;
          if (tw > 0){
            if (!f.wh){ f.wh = 1; if (!weaponMuted('mortar')) SFX.whistleIn(); }
            ctx.fillStyle = `rgba(0,0,0,${0.28 * tw})`;
            ctx.beginPath(); ctx.ellipse(f.x, gy, s * 0.55 * tw, s * 0.2 * tw, 0, 0, Math.PI*2); ctx.fill();
            if (tw > 0.82){                              // the last instant: a blur streaking in
              const st = (tw - 0.82) / 0.18;
              ctx.save(); ctx.globalAlpha = 0.55;
              ctx.strokeStyle = f.body; ctx.lineWidth = s * 0.3; ctx.lineCap = 'round';
              ctx.beginPath(); ctx.moveTo(f.x, gy - 120 + st * 90); ctx.lineTo(f.x, gy - 24 + st * 12); ctx.stroke();
              ctx.restore();
            }
          }
        } else {
          // SLAM: dust ring + crater, legs up out of the dirt, wiggling
          const te = f.t - tSlam;
          if (!f.th){ f.th = 1; if (!weaponMuted('mortar')) SFX.thud(); }
          if (te < 0.3){
            const dk = te / 0.3;
            ctx.strokeStyle = `rgba(170,150,115,${0.55 * (1 - dk)})`;
            ctx.lineWidth = Math.max(2, s * 0.16 * (1 - dk));
            ctx.beginPath(); ctx.ellipse(f.x, gy, s * (0.4 + dk * 1.1), s * (0.16 + dk * 0.4), 0, 0, Math.PI*2); ctx.stroke();
          }
          ctx.save(); ctx.globalAlpha = fade;
          ctx.fillStyle = 'rgba(0,0,0,0.28)';            // crater bowl + rim
          ctx.beginPath(); ctx.ellipse(f.x, gy + 1, s * 0.6, s * 0.22, 0, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = '#3a2c1a';
          ctx.beginPath(); ctx.ellipse(f.x, gy, s * 0.5, s * 0.18, 0, 0, Math.PI*2); ctx.fill();
          ctx.strokeStyle = '#6b5636'; ctx.lineWidth = Math.max(1.5, s * 0.07);
          ctx.beginPath(); ctx.ellipse(f.x, gy - 1, s * 0.52, s * 0.19, 0, 0, Math.PI*2); ctx.stroke();
          ctx.lineCap = 'round';
          const pop = Math.min(1, te / 0.12);            // legs pop up over the first frames
          for (const [lx, ph] of [[-s * 0.16, 0], [s * 0.14, 1.7]]){
            const wig = Math.sin(te * 16 + ph) * 0.16 * Math.max(0, Math.min(1, 1.9 - te));
            ctx.save(); ctx.translate(f.x + lx, gy); ctx.rotate(wig);
            ctx.strokeStyle = f.body; ctx.lineWidth = Math.max(2, s * 0.1);
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -s * 0.42 * pop); ctx.stroke();
            if (pop >= 1){                               // the foot, toes skyward
              ctx.fillStyle = f.belly;
              ctx.beginPath(); ctx.ellipse(0, -s * 0.44, s * 0.09, s * 0.05, wig * 2, 0, Math.PI*2); ctx.fill();
            }
            ctx.restore();
          }
          ctx.strokeStyle = f.body; ctx.lineWidth = Math.max(1.6, s * 0.07);
          ctx.beginPath(); ctx.moveTo(f.x + s * 0.32, gy);   // tail tip pokes out, drooping
          ctx.quadraticCurveTo(f.x + s * 0.44, gy - s * 0.3 * pop, f.x + s * (0.52 + Math.sin(te * 12) * 0.02), gy - s * 0.16 * pop);
          ctx.stroke();
          // a little smoke curling off the crater
          ctx.fillStyle = `rgba(150,150,160,${0.3 * fade * Math.max(0, 1 - te)})`;
          ctx.beginPath(); ctx.arc(f.x + Math.sin(te * 5 + f.seed) * 3, gy - s * 0.3 - te * s * 0.5, s * (0.12 + te * 0.18), 0, Math.PI*2); ctx.fill();
          ctx.restore();
        }
        break;
      }
      case 'deflate': { // gatling kill: riddled with daylight holes, then the
                        // dino deflates and loops away like a released balloon
        const s = f.r, gy = f.y + 2;
        const cy = f.y - s * (f.fly ? 1.5 : 0.62);
        const pr = n => { const v = Math.sin(f.seed * 37.7 + n * 91.3) * 43758.5; return v - Math.floor(v); };
        // the balloon flight path, shared by the body and its leak-lines
        const zipX = q => f.x + Math.sin(q * 9 + f.seed) * s * (0.8 + q * 0.8);
        const zipY = q => cy - q * s * 1.6 + Math.sin(q * 13 + f.seed * 2) * s * 0.5;
        if (f.t < 0.28){
          // beat 1: bullet-riddled and jittering, sunbeams through the holes
          ctx.save();
          ctx.translate(f.x + Math.sin(f.t * 70) * 1.6, cy + Math.cos(f.t * 63) * 1.2);
          gagBody(s, f.body, f.belly);
          const nH = Math.min(6, 1 + Math.floor(f.t / 0.045));
          for (let i = 0; i < nH; i++){
            const hx = (pr(i) - 0.5) * s * 0.8, hy = (pr(i + 7) - 0.5) * s * 0.42;
            ctx.strokeStyle = 'rgba(255,250,210,0.5)'; ctx.lineWidth = Math.max(1, s * 0.035);
            ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + s * 0.28, hy + s * 0.5); ctx.stroke();
            ctx.fillStyle = 'rgba(30,26,20,0.9)';
            ctx.beginPath(); ctx.arc(hx, hy, Math.max(1.2, s * 0.05), 0, Math.PI*2); ctx.fill();
          }
          ctx.restore();
        } else if (f.t < 0.95){
          // beat 2: pbbbt — it shrinks, flattens, and loops off wildly
          const kk = (f.t - 0.28) / 0.67;
          ctx.save(); ctx.translate(zipX(kk), zipY(kk));
          ctx.rotate(kk * 14 * (pr(3) > 0.5 ? 1 : -1));
          ctx.scale(1 - kk * 0.72, (1 - kk * 0.72) * (1 - kk * 0.5));
          gagBody(s, f.body, f.belly);
          ctx.restore();
          ctx.strokeStyle = `rgba(255,255,255,${0.5 * (1 - kk)})`;
          ctx.lineWidth = 1.4; ctx.lineCap = 'round';
          for (let i = 0; i < 3; i++){                   // sputtering leak-lines behind it
            const tb = kk - 0.05 - i * 0.06;
            if (tb <= 0) continue;
            ctx.beginPath(); ctx.moveTo(zipX(tb), zipY(tb));
            ctx.lineTo(zipX(tb) + 3, zipY(tb) + 3); ctx.stroke();
          }
        } else {
          // beat 3: the empty hide flutters down like a leaf and settles
          const kk = (f.t - 0.95) / (f.dur - 0.95);
          const a = kk > 0.7 ? 1 - (kk - 0.7) / 0.3 : 1;
          const ex = zipX(1) + Math.sin(kk * 6 + f.seed) * s * 0.45;
          const ey = zipY(1) + (gy - zipY(1)) * Math.min(1, kk * 1.25);
          ctx.save(); ctx.translate(ex, ey);
          ctx.rotate(Math.sin(kk * 6 + f.seed) * 0.5);
          ctx.globalAlpha = a;
          ctx.fillStyle = f.body;
          ctx.beginPath(); ctx.ellipse(0, 0, s * 0.3, s * 0.08, 0, 0, Math.PI*2); ctx.fill();
          ctx.restore();
        }
        break;
      }
      case 'ash': { // flamer kill: flash-fried into an ash statue that blinks
                    // twice — then crumbles from the feet up into a smoking pile
        const s = f.r, gy = f.y + 2;
        const cy = f.y - s * 0.62;
        const pr = n => { const v = Math.sin(f.seed * 37.7 + n * 91.3) * 43758.5; return v - Math.floor(v); };
        const kk = Math.min(1, Math.max(0, (f.t - 0.55) / 0.75));   // crumble progress
        const fade = f.t > 1.5 ? Math.max(0, 1 - (f.t - 1.5) / 0.4) : 1;
        // the growing ash pile (from the first crumb onward)
        if (kk > 0){
          ctx.fillStyle = `rgba(138,130,120,${0.95 * fade})`;
          ctx.beginPath(); ctx.ellipse(f.x, gy, s * 0.5 * Math.min(1, kk * 1.4), s * (0.1 + kk * 0.12), 0, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = `rgba(96,88,80,${0.6 * fade})`;
          ctx.beginPath(); ctx.ellipse(f.x - s * 0.1, gy, s * 0.28 * Math.min(1, kk * 1.4), s * 0.08, 0, 0, Math.PI*2); ctx.fill();
        }
        if (kk < 1){
          // the statue — sinking into its own pile once the crumble starts
          ctx.save();
          ctx.beginPath(); ctx.rect(f.x - s * 1.3, cy - s * 2, s * 2.6, gy - (cy - s * 2)); ctx.clip();
          ctx.translate(f.x, cy + kk * s * 1.25);
          gagBody(s, '#8f8880', '#a9a29a');
          ctx.strokeStyle = '#8f8880'; ctx.lineWidth = Math.max(1.6, s * 0.09); ctx.lineCap = 'round';
          for (const lx of [-s * 0.18, s * 0.16]){       // stiff statue legs
            ctx.beginPath(); ctx.moveTo(lx, s * 0.2); ctx.lineTo(lx, s * 0.58); ctx.stroke();
          }
          ctx.strokeStyle = 'rgba(60,54,48,0.7)'; ctx.lineWidth = 1;
          for (let i = 0; i < 3; i++){                   // hairline cracks spreading
            const cx2 = (pr(i) - 0.5) * s * 0.7, cy2 = (pr(i + 4) - 0.5) * s * 0.4;
            ctx.beginPath(); ctx.moveTo(cx2, cy2);
            ctx.lineTo(cx2 + (pr(i + 8) - 0.5) * s * 0.3, cy2 + s * 0.18);
            ctx.lineTo(cx2 + (pr(i + 12) - 0.5) * s * 0.4, cy2 + s * 0.34);
            ctx.stroke();
          }
          // wide cartoon eyes — two slow blinks before the crumble
          const blink = (f.t > 0.18 && f.t < 0.24) || (f.t > 0.38 && f.t < 0.44);
          if (!blink && kk < 0.4){
            for (const ex of [s * 0.48, s * 0.62]){
              ctx.fillStyle = '#fff';
              ctx.beginPath(); ctx.ellipse(ex, -s * 0.16, s * 0.06, s * 0.085, 0, 0, Math.PI*2); ctx.fill();
              ctx.fillStyle = '#222';
              ctx.beginPath(); ctx.arc(ex, -s * 0.14, s * 0.025, 0, Math.PI*2); ctx.fill();
            }
          }
          ctx.restore();
          // ash flecks shed off the crumbling edge
          if (kk > 0){
            ctx.fillStyle = `rgba(150,142,132,${0.7 * fade})`;
            for (let i = 0; i < 4; i++){
              const tf = (f.t * 1.7 + pr(i + 20)) % 0.4;
              ctx.beginPath();
              ctx.arc(f.x + (pr(i + 24) - 0.5) * s * 0.9, gy - s * 0.2 - (0.4 - tf) * s * 1.2, 1 + pr(i) * 1.2, 0, Math.PI*2);
              ctx.fill();
            }
          }
        }
        // embers drifting up + a smoke wisp off the remains
        for (let i = 0; i < 3; i++){
          const tf = (f.t * 0.8 + pr(i + 30)) % 1;
          ctx.fillStyle = `rgba(255,${140 + (pr(i) * 60 | 0)},50,${0.8 * (1 - tf) * fade})`;
          ctx.beginPath();
          ctx.arc(f.x + Math.sin(tf * 7 + i * 2) * s * 0.3, cy + s * 0.3 - tf * s * 1.4, 1.2, 0, Math.PI*2);
          ctx.fill();
        }
        ctx.fillStyle = `rgba(120,120,128,${0.3 * fade})`;
        ctx.beginPath(); ctx.arc(f.x + Math.sin(f.t * 3 + f.seed) * 3, cy - s * 0.4 - f.t * s * 0.4, s * (0.1 + f.t * 0.14), 0, Math.PI*2); ctx.fill();
        break;
      }
      case 'ko': { // sniper kill: knocked clean off its feet — double backflip,
                   // flat on its back, X-eyes, stars circling overhead
        const s = f.r, gy = f.y + 2;
        const cy0 = f.y - s * (f.fly ? 1.5 : 0.62);
        const dir = f.dir || 1, tFly = 0.5;
        const lx = f.x + dir * s * 1.5;                  // where it lands
        if (f.t < tFly){
          const kk = f.t / tFly;
          const px = f.x + dir * kk * s * 1.5;
          const py = cy0 - Math.sin(kk * Math.PI) * s * 1.1 + kk * ((gy - s * 0.22) - cy0);
          ctx.strokeStyle = `rgba(255,255,255,${0.6 * (1 - kk)})`; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(f.x - dir * s * 0.7, cy0); ctx.lineTo(px, py); ctx.stroke();
          ctx.save(); ctx.translate(px, py);
          ctx.rotate(-dir * kk * Math.PI * 4);           // the double backflip
          gagBody(s, f.body, f.belly);
          ctx.restore();
        } else {
          const te = f.t - tFly;
          const fade = f.t > f.dur - 0.3 ? (f.dur - f.t) / 0.3 : 1;
          if (te < 0.22){                                // landing dust
            ctx.strokeStyle = `rgba(160,140,105,${0.5 * (1 - te / 0.22)})`;
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.ellipse(lx, gy, s * (0.4 + te * 3), s * (0.14 + te), 0, 0, Math.PI*2); ctx.stroke();
          }
          ctx.save(); ctx.globalAlpha = fade;
          ctx.translate(lx, gy - s * 0.2);
          const tw = te < 0.55 ? Math.sin(te * 30) * 0.06 * (1 - te / 0.55) : 0; // settling twitch
          ctx.rotate(Math.PI + tw);                      // flat on its back
          gagBody(s, f.body, f.belly);
          ctx.restore();
          ctx.save(); ctx.globalAlpha = fade;            // stiff legs skyward
          ctx.strokeStyle = f.body; ctx.lineWidth = Math.max(1.8, s * 0.09); ctx.lineCap = 'round';
          for (const [ox, ph] of [[-s * 0.16, 0.15], [s * 0.14, -0.12]]){
            ctx.beginPath(); ctx.moveTo(lx + ox, gy - s * 0.34);
            ctx.lineTo(lx + ox + ph * s, gy - s * 0.78); ctx.stroke();
          }
          // X-eyes on the upside-down head
          ctx.strokeStyle = '#1c222e'; ctx.lineWidth = Math.max(1, s * 0.035);
          const hx = lx - dir * s * 0.55, hy = gy - s * 0.1;
          for (const ox of [-s * 0.06, s * 0.06]){
            ctx.beginPath();
            ctx.moveTo(hx + ox - s * 0.035, hy - s * 0.035); ctx.lineTo(hx + ox + s * 0.035, hy + s * 0.035);
            ctx.moveTo(hx + ox + s * 0.035, hy - s * 0.035); ctx.lineTo(hx + ox - s * 0.035, hy + s * 0.035);
            ctx.stroke();
          }
          // golden stars circling where its head is
          for (let i = 0; i < 4; i++){
            const ang = te * 3.2 + i * (Math.PI / 2);
            const sx2 = hx + Math.cos(ang) * s * 0.5, sy2 = gy - s * 0.7 + Math.sin(ang) * s * 0.14;
            const tw2 = 0.6 + 0.4 * Math.sin(te * 9 + i * 2);
            ctx.strokeStyle = `rgba(255,214,74,${tw2 * fade})`; ctx.lineWidth = 1.4;
            const sr = Math.max(1.6, s * 0.08);
            ctx.beginPath();
            ctx.moveTo(sx2 - sr, sy2); ctx.lineTo(sx2 + sr, sy2);
            ctx.moveTo(sx2, sy2 - sr); ctx.lineTo(sx2, sy2 + sr);
            ctx.stroke();
          }
          ctx.restore();
        }
        break;
      }
      case 'iceblock': { // cryo kill: flash-frozen solid — the block teeters,
                         // tips… and SHATTERS into shards that skid and melt
        const s = f.r, gy = f.y + 2;
        const cyA = f.y - s * (f.fly ? 1.5 : 0.62);      // where it froze
        const pr = n => { const v = Math.sin(f.seed * 37.7 + n * 91.3) * 43758.5; return v - Math.floor(v); };
        const tShatter = 0.95;
        if (f.t < tShatter){
          // a frozen flyer's block drops to earth first
          const drop = f.fly ? Math.min(1, f.t / 0.35) : 1;
          const cy = cyA + (f.y - s * 0.62 - cyA) * drop * drop;
          const tt = Math.max(0, f.t - 0.55) / 0.4;      // teeter ramps up
          ctx.save(); ctx.translate(f.x, gy);
          ctx.rotate(Math.sin(tt * 18) * 0.09 * tt);
          ctx.translate(0, cy - gy);
          const bw = s * 0.78, bh = s * 0.62;            // the block (rounded corners)
          ctx.fillStyle = 'rgba(185,228,255,0.88)';
          ctx.beginPath();
          ctx.moveTo(-bw + 3, -bh);
          ctx.arcTo(bw, -bh, bw, bh, 3); ctx.arcTo(bw, bh, -bw, bh, 3);
          ctx.arcTo(-bw, bh, -bw, -bh, 3); ctx.arcTo(-bw, -bh, bw, -bh, 3);
          ctx.closePath(); ctx.fill();
          ctx.globalAlpha = 0.45;                        // the dino, rigid inside
          gagBody(s * 0.85, f.body, f.belly);
          ctx.globalAlpha = 1;
          ctx.strokeStyle = 'rgba(235,250,255,0.9)'; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.moveTo(-bw * 0.55, -bh * 0.75); ctx.lineTo(-bw * 0.2, -bh * 0.35); ctx.stroke(); // gleam
          for (let i = 0; i < 2; i++){                   // twinkling glints
            const ga = 0.4 + 0.6 * Math.sin(f.t * 7 + i * 2.4);
            const gx2 = (pr(i + 40) - 0.5) * bw * 1.2, gy2 = (pr(i + 44) - 0.5) * bh * 1.2;
            ctx.strokeStyle = `rgba(255,255,255,${ga})`; ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(gx2 - 2.5, gy2); ctx.lineTo(gx2 + 2.5, gy2);
            ctx.moveTo(gx2, gy2 - 2.5); ctx.lineTo(gx2, gy2 + 2.5);
            ctx.stroke();
          }
          if (f.t < 0.12){                               // the freeze-flash
            ctx.fillStyle = `rgba(255,255,255,${0.8 * (1 - f.t / 0.12)})`;
            ctx.beginPath(); ctx.ellipse(0, 0, bw * 1.15, bh * 1.15, 0, 0, Math.PI*2); ctx.fill();
          }
          ctx.restore();
        } else {
          const te = f.t - tShatter;
          if (!f.sh){ f.sh = 1; if (!weaponMuted('cryo')) SFX.shatter(); }
          if (te < 0.22){                                // snow poof
            ctx.fillStyle = `rgba(225,245,255,${0.5 * (1 - te / 0.22)})`;
            ctx.beginPath(); ctx.arc(f.x, gy - s * 0.4, s * (0.4 + te * 3), 0, Math.PI*2); ctx.fill();
          }
          ctx.fillStyle = `rgba(120,160,190,${0.2 * Math.max(0, 1 - te / 0.85)})`; // melt patch
          ctx.beginPath(); ctx.ellipse(f.x, gy, s * (0.5 + te * 0.4), s * 0.18, 0, 0, Math.PI*2); ctx.fill();
          for (let i = 0; i < 7; i++){                   // shards skid out and melt
            const melt = Math.max(0, 1 - te / 0.85);
            if (melt <= 0) break;
            const vx = (pr(i) - 0.5) * 2 * (s * 2.4 + 40);
            const px = f.x + vx * (1 - Math.exp(-te * 3)) / 3;  // friction slide
            const py = gy + (pr(i + 9) - 0.5) * 5;
            const sr = Math.max(1.5, s * (0.1 + pr(i + 5) * 0.08)) * melt;
            ctx.save(); ctx.translate(px, py); ctx.rotate(pr(i + 14) * 6 + te * (pr(i + 17) - 0.5) * 6);
            ctx.fillStyle = `rgba(200,235,255,${0.85 * melt})`;
            ctx.strokeStyle = `rgba(255,255,255,${0.7 * melt})`; ctx.lineWidth = 0.8;
            ctx.beginPath(); ctx.moveTo(-sr, sr * 0.7); ctx.lineTo(0, -sr); ctx.lineTo(sr, sr * 0.5);
            ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.restore();
          }
        }
        break;
      }
      case 'notes': { // sonic kill: shaken into a blur — then the dino bursts
                      // into music notes that drift away on the breeze
        const s = f.r;
        const cy = f.y - s * (f.fly ? 1.5 : 0.62);
        const pr = n => { const v = Math.sin(f.seed * 37.7 + n * 91.3) * 43758.5; return v - Math.floor(v); };
        if (f.t < 0.3){
          const kk = f.t / 0.3;
          const off = s * (0.06 + kk * 0.18);
          for (const [ox, col, al] of [[-1, '#d6a3ff', 0.5], [1, '#ffffff', 0.4], [0, f.body, 0.7]]){
            ctx.save();
            ctx.translate(f.x + ox * off * Math.sin(f.t * 90 + ox), cy);
            ctx.globalAlpha = al * (1 - kk * 0.35);
            gagBody(s, col, null);
            ctx.restore();
          }
          ctx.strokeStyle = `rgba(214,163,255,${0.5 * (1 - kk)})`; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(f.x, cy, s * (1.15 - kk * 0.5), 0, Math.PI*2); ctx.stroke();
        } else {
          const te = f.t - 0.3;
          if (!f.no){ f.no = 1; if (!weaponMuted('sonic')) SFX.notePop(); }
          if (te < 0.2){                                 // the pop
            ctx.strokeStyle = `rgba(214,163,255,${0.7 * (1 - te / 0.2)})`; ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.arc(f.x, cy, s * (0.4 + te * 6), 0, Math.PI*2); ctx.stroke();
          }
          const glyphs = ['♪', '♫', '♩', '♪', '♫'];
          for (let i = 0; i < 5; i++){                   // notes drift up, swaying
            const tn = te - i * 0.06;
            if (tn <= 0) continue;
            const a = Math.max(0, 1 - tn / 1.0);
            if (a <= 0) continue;
            ctx.save();
            ctx.translate(f.x + (pr(i) - 0.5) * s * 0.9 + Math.sin(tn * 4 + i * 1.7) * s * 0.3,
                          cy - tn * (s * 0.9 + 18) - pr(i + 5) * s * 0.2);
            ctx.rotate(Math.sin(tn * 5 + i) * 0.25);
            ctx.fillStyle = i % 2 ? `rgba(255,255,255,${0.9 * a})` : `rgba(214,163,255,${0.95 * a})`;
            ctx.font = `${Math.max(9, s * 0.5) | 0}px sans-serif`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(glyphs[i], 0, 0);
            ctx.restore();
          }
        }
        break;
      }
      case 'ghost': { // gas kill: the dino keels over green — and a little
                      // dino ghost floats up out of it, swaying as it goes
        const s = f.r, gy = f.y + 2;
        const pr = n => { const v = Math.sin(f.seed * 37.7 + n * 91.3) * 43758.5; return v - Math.floor(v); };
        const flopK = Math.min(1, f.t / 0.4);
        const corpseA = f.t < 1.0 ? 1 : Math.max(0, 1 - (f.t - 1.0) / 0.6);
        if (corpseA > 0){
          ctx.save(); ctx.globalAlpha = corpseA;
          ctx.translate(f.x, gy - s * 0.22);
          ctx.rotate(flopK * 1.35 * (pr(2) > 0.5 ? 1 : -1)); // keels over
          gagBody(s, f.body, f.belly);
          ctx.globalAlpha = corpseA * 0.45;                  // sickly green wash
          ctx.fillStyle = '#7ec83e';
          ctx.beginPath(); ctx.ellipse(0, 0, s * 0.55, s * 0.34, 0, 0, Math.PI*2); ctx.fill();
          ctx.restore();
          for (let i = 0; i < 3; i++){                       // green bubbles popping off
            const tb = (f.t * 0.9 + pr(i + 11)) % 1;
            ctx.fillStyle = `rgba(166,224,74,${0.5 * (1 - tb) * corpseA})`;
            ctx.beginPath();
            ctx.arc(f.x + (pr(i) - 0.5) * s * 0.7, gy - s * 0.3 - tb * s * 0.5, 1.5 + tb * 2.5, 0, Math.PI*2);
            ctx.fill();
          }
        }
        if (f.t > 0.45){
          const tg2 = f.t - 0.45;
          if (!f.wo){ f.wo = 1; if (!weaponMuted('gas')) SFX.whoo(); }
          const gk = tg2 / (f.dur - 0.45);
          const a = gk < 0.75 ? 0.55 : 0.55 * (1 - (gk - 0.75) / 0.25);
          const gs = s * 0.45;
          ctx.save();
          ctx.translate(f.x + Math.sin(tg2 * 2.6 + f.seed) * s * 0.3, gy - s * 0.5 - gk * s * 2.2);
          ctx.rotate(Math.sin(tg2 * 2.6 + f.seed) * 0.12);
          ctx.fillStyle = `rgba(225,250,215,${a})`;
          ctx.beginPath();                                   // dome + wavy sheet hem
          ctx.arc(0, -gs * 0.35, gs * 0.55, Math.PI, 0);
          ctx.lineTo(gs * 0.55, gs * 0.4);
          for (let j = 0; j < 4; j++){
            const x1 = gs * 0.55 - (j + 0.5) * gs * 0.275;
            const x2 = gs * 0.55 - (j + 1) * gs * 0.275;
            ctx.quadraticCurveTo(x1, gs * 0.4 + (j % 2 ? gs * 0.22 + Math.sin(tg2 * 8 + f.seed) * gs * 0.08 : -gs * 0.1), x2, gs * 0.4);
          }
          ctx.closePath(); ctx.fill();
          ctx.beginPath();                                   // a snout, so it reads as a dino
          ctx.ellipse(gs * 0.45, -gs * 0.45, gs * 0.28, gs * 0.16, 0, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = `rgba(30,40,30,${a})`;             // little eyes
          ctx.beginPath(); ctx.arc(gs * 0.12, -gs * 0.5, gs * 0.08, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(gs * 0.38, -gs * 0.5, gs * 0.08, 0, Math.PI*2); ctx.fill();
          ctx.restore();
        }
        break;
      }
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
      case 'losthat': { // a tourist's cap, blown off — tumbles back and settles
        const hx = f.x - k * 52, hy = f.y - Math.sin(Math.min(1, k * 1.45) * Math.PI) * 30 + k * k * 34;
        ctx.save();
        ctx.globalAlpha = clamp(1 - (k - 0.72) / 0.28, 0, 1);
        ctx.translate(hx, hy); ctx.rotate(f.seed + k * 7.5);
        const hr = f.r * 0.5;
        ctx.fillStyle = f.color;
        ctx.beginPath(); ctx.arc(0, 0, hr, Math.PI, Math.PI * 2); ctx.fill();
        ctx.fillRect(-hr * 1.7, -hr * 0.16, hr * 1.7, hr * 0.32);
        ctx.restore(); break;
      }
      case 'shoe': { // a lone flip-flop, returned to earth from a great height
        const landT = Math.sqrt(Math.max(0.05, (f.gy - f.y) / 380));
        let yy, rot;
        if (f.t < landT){ yy = f.y + 380 * f.t * f.t; rot = f.seed + f.t * 9; }
        else { // one small bounce, then at rest
          const bt = f.t - landT;
          yy = f.gy - Math.max(0, Math.sin(Math.min(bt * 7, Math.PI)) * 8 * Math.max(0, 1 - bt * 1.8));
          rot = f.seed + landT * 9 + Math.min(bt * 2, 0.5);
        }
        ctx.save();
        ctx.globalAlpha = clamp((1 - k) * 4, 0, 1);
        ctx.translate(f.x, yy); ctx.rotate(rot);
        ctx.fillStyle = '#e8a13f'; // the sole
        ctx.beginPath(); ctx.ellipse(0, 0, 6.5, 3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#b5502e'; ctx.lineWidth = 1.2; // toe straps
        ctx.beginPath(); ctx.moveTo(3.5, -1.8); ctx.lineTo(0.5, 0); ctx.lineTo(3.5, 1.8); ctx.stroke();
        ctx.restore(); break;
      }
    }
  }

  // animated set pieces: gate torches + checkpoint beacon
  for (let i = 0; i < G.flames.length; i++) drawTorchFlame(ctx, G.flames[i].x, G.flames[i].y, G.time + i * 1.7);
  if (G.exitFx) drawExitBeacon(ctx, G.exitFx, G.time, !!G.level.night);

  // flyers on top
  air.forEach(drawOne);

  // the pteranodon abduction plays out above even the flyers
  drawSnatch(ctx);

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
    let px = G.mouse.x, py = G.mouse.y;
    if (G.level.maze && G.flow){
      // show the routing grid: which squares are already walled off, and the
      // exact 2×2 block this weapon will claim — so chokepoints are built by
      // eye, cell-perfectly, like any proper tower defense
      const s = mazeSnap(px, py); px = s.x; py = s.y;
      const F = G.flow, cs = F.cs;
      ctx.strokeStyle = 'rgba(255,255,255,0.09)'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let ci = 1; ci < F.cols; ci++){ ctx.moveTo(ci * cs, 0); ctx.lineTo(ci * cs, H); }
      for (let ri = 1; ri < F.rows; ri++){ ctx.moveTo(0, ri * cs); ctx.lineTo(W, ri * cs); }
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,90,60,0.13)';        // squares dinosaurs cannot walk
      for (let ri = 0; ri < F.rows; ri++) for (let ci = 0; ci < F.cols; ci++){
        if (F.blocked[ri * F.cols + ci]) ctx.fillRect(ci * cs, ri * cs, cs, cs);
      }
    }
    const ok = canPlace(px, py) && G.cash >= towerCost(G.placing);
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = ok ? 'rgba(140,240,140,0.6)' : 'rgba(255,90,90,0.7)';
    ctx.fillStyle = ok ? 'rgba(140,240,140,0.12)' : 'rgba(255,90,90,0.12)';
    const rng = (G.level.maze ? mazeRange(G.placing, 0) : def.range) * rangeUpMult(G.placing);   // base range + any lab range unlock
    ctx.beginPath(); ctx.arc(px, py, rng, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    if (G.level.maze){
      // highlight the exact squares about to become wall
      ctx.fillStyle = ok ? 'rgba(140,240,140,0.28)' : 'rgba(255,90,90,0.33)';
      ctx.fillRect(px - 32, py - 32, 64, 64);
      ctx.lineWidth = 2;
      ctx.strokeRect(px - 32, py - 32, 64, 64);
      ctx.lineWidth = 1;
    }
    if (G.mouse.off){
      // touch placement: the drop point sits ABOVE the fingertip, so draw a
      // leash from the finger up to the ghost to make the target unmistakable
      ctx.save();
      ctx.strokeStyle = ok ? 'rgba(150,240,150,0.55)' : 'rgba(255,120,120,0.6)';
      ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.moveTo(G.mouse.tx, G.mouse.ty); ctx.lineTo(px, py); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath(); ctx.arc(G.mouse.tx, G.mouse.ty, 5, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }
    drawTowerBase(ctx, px, py, G.placing, false, 0);
    if (G.pendingTap){
      ctx.font = 'bold 13px Verdana, sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillText(ok ? 'TAP AGAIN TO BUILD' : 'BLOCKED — TAP ELSEWHERE', px + 1, py - 43);
      ctx.fillStyle = ok ? '#9fe870' : '#ff8a7a';
      ctx.fillText(ok ? 'TAP AGAIN TO BUILD' : 'BLOCKED — TAP ELSEWHERE', px, py - 44);
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
    ctx.globalAlpha = 1 - tx.t / (tx.dur || 1.4);
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

  // ---- end world camera; the HUD below is drawn in fixed screen space ----
  ctx.restore();

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
    const bw = 460, bx = (W - bw) / 2, by = IS_COARSE ? 106 : 30;   // nudge below the mobile zoom pill
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
  // thunder-dim while a maxed Tesla discharges — for a heartbeat the whole
  // island darkens and the bolt becomes the light source
  if (G.thunderT > 0){
    G.thunderT = Math.max(0, G.thunderT - dt);
    ctx.fillStyle = `rgba(8,6,26,${0.17 * (G.thunderT / 0.3)})`;
    ctx.fillRect(0, 0, W, H);
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
const IS_COARSE = matchMedia('(pointer: coarse)').matches; // touch devices
// world size + mobile camera limits. Desktop never leaves zoom 1 / no pan.
const WORLD_W = W, WORLD_H = H;
const CAM_MIN_ZOOM = 0.8, CAM_MAX_ZOOM = 2.6;
const CAM_MARGIN = 160;      // how far past the map edges you can pan (dark margin)
const PLACE_LIFT_PX = 60;    // how far above the fingertip the ghost floats (CSS px)

function resetCam(){ G.cam = {x: 0, y: 0, zoom: 1}; G.gesture = null; syncZoomUI(); }
// keep the camera showing the map (plus a little margin); re-anchor the popup
function clampCam(){
  const c = G.cam;
  c.zoom = clamp(c.zoom, CAM_MIN_ZOOM, CAM_MAX_ZOOM);
  const vw = W / c.zoom, vh = H / c.zoom;             // viewport size in world units
  const minX = -CAM_MARGIN, maxX = WORLD_W + CAM_MARGIN - vw;
  const minY = -CAM_MARGIN, maxY = WORLD_H + CAM_MARGIN - vh;
  c.x = (maxX >= minX) ? clamp(c.x, minX, maxX) : (WORLD_W - vw) / 2;   // centre if it all fits
  c.y = (maxY >= minY) ? clamp(c.y, minY, maxY) : (WORLD_H - vh) / 2;
  if (G.selected) positionTowerPop(G.selected);
  syncZoomUI();
}
// zoom keeping the viewport centre fixed (used by the slider / +- buttons)
function setZoomCentered(z){
  const c = G.cam;
  const wx = (W / 2) / c.zoom + c.x, wy = (H / 2) / c.zoom + c.y;   // world point under the centre
  c.zoom = clamp(z, CAM_MIN_ZOOM, CAM_MAX_ZOOM);
  c.x = wx - (W / 2) / c.zoom;
  c.y = wy - (H / 2) / c.zoom;
  clampCam();
}
// reflect the live zoom back onto the slider (keeps it in sync with pinch-zoom)
function syncZoomUI(){ const s = $('#zoomSlider'); if (s) s.value = G.cam.zoom.toFixed(2); }

// pointer(client) -> canvas buffer px (0..W, 0..H), correcting for CSS scaling
function clientToBuffer(clientX, clientY){
  const r = cv.getBoundingClientRect();
  return {bx: (clientX - r.left) * (W / r.width), by: (clientY - r.top) * (H / r.height), r};
}
// canvas buffer px -> world, through the camera
function bufferToWorld(bx, by){ return {x: bx / G.cam.zoom + G.cam.x, y: by / G.cam.zoom + G.cam.y}; }
function canvasPos(e){ const b = clientToBuffer(e.clientX, e.clientY); return bufferToWorld(b.bx, b.by); }

// record a placement point. On touch, lift it above the fingertip so the weapon
// and its range ring aren't hidden under the finger; keep the true fingertip too.
function setPlacePoint(wx, wy, lift, rectH){
  G.mouse.tx = wx; G.mouse.ty = wy;
  let py = wy;
  if (lift){
    const rh = rectH || cv.getBoundingClientRect().height || H;
    py = wy - PLACE_LIFT_PX * (H / rh) / G.cam.zoom;   // constant on-screen lift, in world units
  }
  G.mouse.x = wx; G.mouse.y = py; G.mouse.off = !!lift;
}
/* map a pointer anywhere on screen to world coords for placement (used by the
   shop-card drag). Lifts above the finger on touch; exact under the mouse. */
function mouseFromPointer(e){
  const b = clientToBuffer(e.clientX, e.clientY);
  const r = b.r;
  if (!r.width) return;
  const w = bufferToWorld(clamp(b.bx, 0, W), clamp(b.by, 0, H));
  setPlacePoint(w.x, w.y, e.pointerType === 'touch', r.height);
  G.mouse.on = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
}

// ---- desktop: mouse ----
cv.addEventListener('mousemove', e => {
  if (IS_COARSE) return;                     // touch is handled by the pointer gestures below
  const p = canvasPos(e);
  G.mouse.x = p.x; G.mouse.y = p.y; G.mouse.tx = p.x; G.mouse.ty = p.y; G.mouse.off = false; G.mouse.on = true;
});
cv.addEventListener('mouseleave', () => { if (!IS_COARSE) G.mouse.on = false; });
cv.addEventListener('click', e => {
  if (IS_COARSE || G.state !== 'playing') return;
  const p = canvasPos(e);
  if (G.targeting === 'strike'){ launchStrike(p.x, p.y); return; }
  if (G.placing){
    placeTower(G.placing, p.x, p.y);
    if (!e.shiftKey && G.cash < towerCost(G.placing)) G.placing = null;
    updateHUD();
    return;
  }
  let hit = null;
  for (const t of G.towers) if (hyp(p.x, p.y, t.x, t.y) < 24) hit = t;
  selectTower(hit === G.selected ? null : hit);
});
cv.addEventListener('contextmenu', e => {
  e.preventDefault();
  G.placing = null; G.pendingTap = null; G.targeting = null; selectTower(null); updateHUD();
});

// ---- mobile: one finger = move ghost (when placing) or pan the map; two fingers = pinch-zoom ----
const TAP_MOVE = 12;   // client px of travel before a touch counts as a drag, not a tap
function beginPinch(g){
  g.mode = 'pinch';
  const [a, b] = [...g.pts.values()];
  const A = clientToBuffer(a.x, a.y), B = clientToBuffer(b.x, b.y);
  g.pinchDist = Math.hypot(A.bx - B.bx, A.by - B.by) || 1;
  g.pinchZoom = G.cam.zoom;
  g.pinchWorld = bufferToWorld((A.bx + B.bx) / 2, (A.by + B.by) / 2); // keep this point under the pinch centre
  G.mouse.on = false;                                                 // hide any ghost while zooming
}
function updatePinch(g){
  const vals = [...g.pts.values()];
  if (vals.length < 2) return;
  const A = clientToBuffer(vals[0].x, vals[0].y), B = clientToBuffer(vals[1].x, vals[1].y);
  const mx = (A.bx + B.bx) / 2, my = (A.by + B.by) / 2;
  const dist = Math.hypot(A.bx - B.bx, A.by - B.by) || 1;
  G.cam.zoom = clamp(g.pinchZoom * (dist / g.pinchDist), CAM_MIN_ZOOM, CAM_MAX_ZOOM);
  G.cam.x = g.pinchWorld.x - mx / G.cam.zoom;
  G.cam.y = g.pinchWorld.y - my / G.cam.zoom;
  clampCam();
}
// point the ghost at a single remaining touch (start of drag, or after a pinch ends)
function trackPlaceTouch(p){
  const b = clientToBuffer(p.x, p.y);
  const w = bufferToWorld(b.bx, b.by);
  setPlacePoint(w.x, w.y, true, b.r.height);
  G.mouse.on = true;
}
cv.addEventListener('pointerdown', e => {
  if (e.pointerType !== 'touch' || G.state !== 'playing') return;
  e.preventDefault();
  try { cv.setPointerCapture(e.pointerId); } catch(_){}
  const g = G.gesture || (G.gesture = {pts: new Map()});
  g.pts.set(e.pointerId, {x: e.clientX, y: e.clientY});
  if (g.pts.size >= 2){ beginPinch(g); return; }
  g.moved = false; g.startX = e.clientX; g.startY = e.clientY;
  if (G.placing || G.targeting){ g.mode = 'place'; trackPlaceTouch({x: e.clientX, y: e.clientY}); }
  else { g.mode = 'pan'; g.camX = G.cam.x; g.camY = G.cam.y; }
});
cv.addEventListener('pointermove', e => {
  if (e.pointerType !== 'touch') return;
  const g = G.gesture; if (!g || !g.pts.has(e.pointerId)) return;
  e.preventDefault();
  g.pts.set(e.pointerId, {x: e.clientX, y: e.clientY});
  if (g.mode === 'pinch'){ updatePinch(g); return; }
  if (Math.hypot(e.clientX - g.startX, e.clientY - g.startY) > TAP_MOVE) g.moved = true;
  if (g.mode === 'place'){
    trackPlaceTouch({x: e.clientX, y: e.clientY});
  } else if (g.mode === 'pan'){
    const b = clientToBuffer(e.clientX, e.clientY), s = clientToBuffer(g.startX, g.startY);
    G.cam.x = g.camX - (b.bx - s.bx) / G.cam.zoom;
    G.cam.y = g.camY - (b.by - s.by) / G.cam.zoom;
    clampCam();
  }
});
function endTouch(e){
  if (e.pointerType !== 'touch') return;
  const g = G.gesture; if (!g || !g.pts.has(e.pointerId)) return;
  e.preventDefault();
  g.pts.delete(e.pointerId);
  if (g.pts.size >= 2){ beginPinch(g); return; }
  if (g.pts.size === 1){                       // pinch dropped to one finger → resume drag/pan
    const p = [...g.pts.values()][0];
    g.moved = true; g.startX = p.x; g.startY = p.y;
    if (G.placing || G.targeting){ g.mode = 'place'; trackPlaceTouch(p); }
    else { g.mode = 'pan'; g.camX = G.cam.x; g.camY = G.cam.y; }
    return;
  }
  // last finger up → resolve the gesture
  const {mode, moved} = g;
  G.gesture = null;
  if (mode === 'place'){
    if (G.targeting === 'strike'){
      launchStrike(G.mouse.x, G.mouse.y);
      G.targeting = null;
    } else if (G.placing){
      const okPlace = canPlace(G.mouse.x, G.mouse.y) && G.cash >= towerCost(G.placing);
      placeTower(G.placing, G.mouse.x, G.mouse.y);   // plays the build or the error cue
      if (okPlace) G.placing = null;                 // placed → stop; keep it selected if it was blocked
    }
    G.mouse.on = false; G.mouse.off = false;
    updateHUD();
  } else if (mode === 'pan' && !moved){         // a tap that didn't drag → select/deselect a tower
    const p = canvasPos(e);
    let hit = null;
    for (const t of G.towers) if (hyp(p.x, p.y, t.x, t.y) < 26) hit = t;
    selectTower(hit === G.selected ? null : hit);
  }
}
cv.addEventListener('pointerup', endTouch);
cv.addEventListener('pointercancel', endTouch);

// map-zoom pill (top-centre, touch only). Slider + step buttons drive the camera.
(function initZoomUI(){
  const s = $('#zoomSlider');
  if (!s) return;
  s.min = CAM_MIN_ZOOM; s.max = CAM_MAX_ZOOM;
  s.addEventListener('input', () => setZoomCentered(parseFloat(s.value)));
  $('#zoomIn').onclick  = () => setZoomCentered(G.cam.zoom + 0.35);
  $('#zoomOut').onclick = () => setZoomCentered(G.cam.zoom - 0.35);
  syncZoomUI();
})();
window.addEventListener('keydown', e => {
  if (G.state !== 'playing') return;
  const keys = Object.keys(TOWERS);
  if (e.key >= '1' && e.key <= String(keys.length)){
    const k = keys[+e.key - 1];
    if (towerUnlocked(k)){ G.placing = k; selectTower(null); updateHUD(); }
    else SFX.error();
  }
  if (e.key === 'Escape'){ G.placing = null; G.pendingTap = null; G.targeting = null; selectTower(null); updateHUD(); }
  if (e.key === ' '){ e.preventDefault(); if (!G.waveActive) callWave(); else togglePause(); }
  if (e.key === 'm' || e.key === 'M') toggleMute();
});
function togglePause(){ G.paused = !G.paused; updateHUD(); }

/* ---------------- wire up UI ---------------- */
/* manual wave start (button or Space): an early call inside the rush window
   pays out the seconds you skipped */
function callWave(){
  const bonus = (!G.waveActive && !G.over && G.wave > 0 && G.rushT > 0) ? rushBonus() : 0;
  const before = G.wave;
  startWave();
  if (bonus > 0 && G.wave === before + 1){
    G.cash += bonus;
    if (G.stat) G.stat.cashEarned += bonus;
    addText(W / 2, 150, `⏩ RUSH BONUS +$${bonus}`, '#ffd24a', 19);
    SFX.coin();
    updateHUD();
  }
}
$('#btnWave').onclick = callWave;
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
  const t = G.selected; if (!t) return;
  const modes = ['first', 'last', 'strong', 'close'];
  if (TOWERS[t.key].air) modes.push('air');   // flyers-first only makes sense with anti-air
  t.mode = modes[(modes.indexOf(t.mode) + 1) % modes.length];
  saveRun();
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
$('#btnStickers').onclick = () => { buildStickers(); $('#stickers').classList.remove('hidden'); };
$('#stickClose').onclick = () => $('#stickers').classList.add('hidden');
// tap an earned sticker → its animated trading card
$('#stickTable').onclick = e => {
  const td = e.target.closest ? e.target.closest('td.cell.got') : null;
  if (td && td.dataset.w) openStickerCard(td.dataset.w, td.dataset.d);
};
$('#stickCard').onclick = e => { if (e.target.id === 'stickCard') $('#stickCard').classList.add('hidden'); };
$('#btnStudio').onclick = () => { buildStudio(); $('#studio').classList.remove('hidden'); };
$('#studioClose').onclick = () => $('#studio').classList.add('hidden');
$('#studioAdd').onclick = () => {
  if (!save.studio) save.studio = [];
  if (save.studio.length >= 3) return;
  const sp = ['velociraptor', 'triceratops', 'pteranodon'][save.studio.length] || 'compy';
  save.studio.push({sp, name: '', body: '#e055aa', belly: '#ffd9ec'});
  persist(); buildStudio();
};
$('#verChip').onclick = () => { buildChangelog(); $('#changelog').classList.remove('hidden'); };
$('#clogClose').onclick = () => $('#changelog').classList.add('hidden');

/* ---- "Install to your device" prompt (Android native / iOS Safari how-to) ---- */
(function initInstall(){
  const btn = $('#btnInstall');
  if (!btn) return;
  const label = btn.querySelector('.instTxt');
  const isStandalone = () =>
    matchMedia('(display-mode: standalone)').matches ||
    matchMedia('(display-mode: fullscreen)').matches ||
    matchMedia('(display-mode: minimal-ui)').matches ||
    navigator.standalone === true;                       // iOS home-screen launch
  const ua = navigator.userAgent || '';
  const isIOS = /iP(hone|ad|od)/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPadOS masquerades as Mac
  const iosSafari = isIOS && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);        // only Safari can Add to Home Screen
  let deferred = null;                                    // stashed beforeinstallprompt event

  const show = () => { if (!isStandalone()) btn.classList.remove('hidden'); };
  const hide = () => btn.classList.add('hidden');

  // Android / desktop Chromium: capture the native prompt and surface our own button
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferred = e;
    if (label) label.textContent = 'Install app';
    show();
  });
  window.addEventListener('appinstalled', () => { deferred = null; hide(); });

  // iOS Safari has no prompt event → offer manual instructions instead
  if (iosSafari && !isStandalone()){
    if (label) label.textContent = 'Add to Home Screen';
    show();
  }

  btn.onclick = async () => {
    if (deferred){
      deferred.prompt();
      try { await deferred.userChoice; } catch(_){}
      deferred = null; hide();
    } else {
      $('#iosInstall').classList.remove('hidden');        // fallback: show the how-to card
    }
  };
  $('#iosInstallClose').onclick = () => $('#iosInstall').classList.add('hidden');
})();
$('#btnLab').onclick = openLab;
$('#menuDna').onclick = openLab;
$('#vLab').onclick = openLab;
$('#goLab').onclick = openLab;
const openAch = () => { buildAchievements(); $('#achievements').classList.remove('hidden'); };
$('#vAch').onclick = openAch;
$('#goAch').onclick = openAch;
const openStickers = () => { buildStickers(); $('#stickers').classList.remove('hidden'); };
$('#vStick').onclick = openStickers;
$('#goStick').onclick = openStickers;
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
    save.settings.invincible = save.settings.unlimitedCash = save.settings.levelSkip = save.settings.allStickers = false;
    persist(); syncSettings(); updateHUD();
  }
};
$('#optInv').onchange  = e => setCheat('invincible', e.target.checked);
$('#optCash').onchange = e => setCheat('unlimitedCash', e.target.checked);
$('#optSkip').onchange = e => setCheat('levelSkip', e.target.checked);
// view-only preview, NOT a run-disqualifying cheat: it never writes stickers
$('#optStickAll').onchange = e => { save.settings.allStickers = e.target.checked; persist(); };
$('#optMute').onchange = e => { save.settings.mute = e.target.checked; persist(); ensureMusic(); };
$('#optMusic').onchange = e => { save.settings.music = e.target.checked; persist(); ensureMusic(); };
$('#optAuto').onchange = e => { save.settings.auto = e.target.checked; persist(); };
$('#optPreview').onchange = e => { save.settings.wavePreview = e.target.checked; persist(); updateHUD(); };
$('#optCallouts').onchange = e => { save.settings.killCallouts = e.target.checked; persist(); };
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
  const menuPreviewParams = new URLSearchParams(location.search);
  const mdMode = menuPreviewParams.get('menudino');
  const forcedBoss = MENU_BOSSES.includes(mdMode) ? mdMode : null;
  for (let i = 0; i < 3; i++){ spawnMenuDino(innerWidth || 1280, innerHeight || 860, forcedBoss); menuDinos[i].x = (innerWidth || 1280) * (0.22 + i * 0.29); }
  if (menuPreviewParams.has('menuphase')){
    const previewPhase = parseFloat(menuPreviewParams.get('menuphase')) || 0;
    for (const d of menuDinos){ d.phase = previewPhase; d.stride = 0; }
  }
  // pull each dino's fleeing tourists on-screen just ahead of its jaws
  for (const tr of menuTourists){
    const d = tr.prey;
    if (d) tr.x = d.x + d.dir * d.size * (1.0 + Math.random() * 1.3);
    if ((mdMode === 'eat' || menuPreviewParams.has('menueat')) && d){ tr.doomed = true; tr.fate = 'doomed'; tr.x = d.x + d.dir * menuMouthReach(d); } // imminent chomp
    if (mdMode === 'trip' && d){ tr.doomed = false; tr.fate = 'trip'; tr.tripT = 0.05; tr.x = d.x + d.dir * d.size * 2.6; } // imminent stumble
  }
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
if (['all','bosses'].includes(new URLSearchParams(location.search).get('stickers'))){
  // Non-persistent art-review link: reveal every card without touching progress.
  save.settings.allStickers = true;
  buildStickers(); $('#stickers').classList.remove('hidden');
}

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
  if (testParams.has('tour')){ // stage the tourist evacuation for screenshots
    G.towers = [];             // clean field — the demo towers just clutter the shot
    spawnTourists();
  }
  if (testParams.has('snatch')){ // stage the abduction: mark a specific/early victim
    G.towers = [];
    spawnTourists();
    for (const u of G.tourists) u.snatchAt = -1;
    const idx = clamp(parseInt(testParams.get('snatch'), 10) || 0, 0, G.tourists.length - 1);
    const mk = G.tourists[idx].kid ? G.tourists[2] : G.tourists[idx];
    mk.snatchAt = 0.12;
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
  if (testParams.has('mazecheck')){ // open-world grid: routing, sealing, flush walls, solid boxes
    G.cash = 1e9;
    G.towers.length = 0;                               // drop the default test loadout — walls only
    const wall = (x, y) => G.towers.push({key: 'gatling', x, y, ulv: 0, cd: 9999, angle: 0, flash: 0, invested: 0, mode: 'first'});
    // wall A at x=608 (col 9): full flush column with one missing square (row 5)
    for (let y = 32; y <= 672; y += 64){ if (y !== 352) wall(608, y); }
    // wall B at x=1120 (col 17): full column with a one-square hole at row 8
    for (let y = 32; y <= 672; y += 64){ if (y !== 544) wall(1120, y); }
    G.flow = mazeRebuild();
    const sealRejected = !canPlace(608, 352);          // plugging wall A's hole seals the field — illegal
    const flushOk = canPlace(544, 96);                 // flush against the wall (64 apart) is legal
    const overlapRejected = !canPlace(608, 96);        // on another weapon's square is not
    const openOk = canPlace(320, 544);                 // a normal free spot is fine
    // a weapon flush with the top border must fully close its square
    const f2 = mazeRebuild({x: 160, y: 32});
    const edgeSealed = f2.dist[2] < 0;
    const dbg = `gapDist=${G.flow.dist[5 * G.flow.cols + 9]},slit=${G.flow.dist[8 * G.flow.cols + 17]}(want >=0)`;
    for (let i = 0; i < 6; i++){
      spawnDino('velociraptor', 0, false);
      const d = G.dinos[G.dinos.length - 1];
      d.hp = d.maxHp = 1e9;                            // immortal — pure routing test
    }
    // a big fast boss too — they ratcheted through pad gaps small dinos couldn't
    spawnDino('trex', 0, true);
    const bz = G.dinos[G.dinos.length - 1];
    bz.hp = bz.maxHp = 1e9; bz.entranceT = 0; G.cinT = 0; G.banner = null;
    // instrument the sim: every wall crossing must happen INSIDE its gap and
    // no dino may ever stand on a weapon (phasing looks like an "escape" too)
    let minTd = 1e9; const crossA = [], crossB = [];
    for (let s = 0; s < 26; s += 0.05){
      step(0.05);
      for (const d of G.dinos){
        if (d.dead || d.flying || d.mx === undefined) continue;
        if (d.pmx !== undefined && d.pmx <= 608 && d.mx > 608) crossA.push(d.my | 0);
        if (d.pmx !== undefined && d.pmx <= 1120 && d.mx > 1120) crossB.push(d.my | 0);
        d.pmx = d.mx;
        for (const t of G.towers){
          const td = Math.max(Math.abs(d.mx - t.x), Math.abs(d.my - t.y));   // box distance
          if (td < minTd) minTd = td;
        }
      }
    }
    const escaped = G.lives < G.maxLives;
    const gapA = crossA.length > 0 && crossA.every(y => y > 315 && y < 390);   // row-5 hole: y 320-384
    const gapB = crossB.length > 0 && crossB.every(y => y > 507 && y < 582);   // row-8 hole: y 512-576
    const el = $('#errbox'); el.classList.remove('hidden');
    el.textContent = `MAZE sealRejected=${sealRejected} flushOk=${flushOk} overlapRejected=${overlapRejected} openOk=${openOk} edgeSealed=${edgeSealed} (want all true) · escaped=${escaped} · gapA=${gapA}(${crossA.join('/')}) gapB=${gapB}(${crossB.join('/')}) (want true) · minBoxDist=${minTd === 1e9 ? 'n/a' : minTd | 0}(want >=34) · ${dbg}`;
    G.paused = true;
  }
  if (testParams.has('topcheck')){ // Matt's repro: wall near the entrance, only route is over the very top
    G.cash = 1e9;
    G.towers.length = 0;
    // wall on col 3 from y=96 down to the bottom — ONLY the top row stays open
    for (let y = 96; y <= 672; y += 64) G.towers.push({key: 'gatling', x: 224, y, ulv: 0, cd: 9999, angle: 0, flash: 0, invested: 0, mode: 'first'});
    G.flow = mazeRebuild();
    const sealTop = !canPlace(224, 32);                // capping the wall flush to the edge would seal — illegal
    for (let i = 0; i < 5; i++){
      spawnDino('velociraptor', 0, false);
      const d = G.dinos[G.dinos.length - 1];
      d.hp = d.maxHp = 1e9;
    }
    spawnDino('trex', 0, true);
    const bz = G.dinos[G.dinos.length - 1];
    bz.hp = bz.maxHp = 1e9; bz.entranceT = 0; G.cinT = 0; G.banner = null;
    let minTd = 1e9; const crossT = [];
    for (let s = 0; s < 34; s += 0.05){
      step(0.05);
      for (const d of G.dinos){
        if (d.dead || d.flying || d.mx === undefined) continue;
        if (d.pmx !== undefined && d.pmx <= 224 && d.mx > 224) crossT.push(d.my | 0);
        d.pmx = d.mx;
        for (const t of G.towers){
          const td = Math.max(Math.abs(d.mx - t.x), Math.abs(d.my - t.y));
          if (td < minTd) minTd = td;
        }
      }
    }
    const escaped = G.lives < G.maxLives;
    const overTop = crossT.length > 0 && crossT.every(y => y < 70);   // rows 0-1 only
    const el = $('#errbox'); el.classList.remove('hidden');
    el.textContent = `TOP sealTop=${sealTop} overTop=${overTop} escaped=${escaped} (want all true) · crossed=${crossT.length} atY=${crossT.join('/')} · minBoxDist=${minTd === 1e9 ? 'n/a' : minTd | 0}(want >=34)`;
    G.paused = true;
  }
  if (testParams.has('grid')){ // visual: the placement grid overlay on the maze map
    G.cash = 1e9;
    G.towers.length = 0; G.flow = mazeRebuild();       // clear the default test loadout
    placeTower('gatling', 480, 160, true);
    placeTower('gatling', 480, 224, true);            // a flush vertical pair
    G.placing = 'cryo';
    G.mouse.x = 530; G.mouse.y = 270; G.mouse.on = true;   // snaps to (544,288), diagonal to the pair
    step(0.05);
    const el = $('#errbox'); el.classList.remove('hidden');
    el.textContent = `GRID canPlace(544,288)=${canPlace(544, 288)}(want true) · flushLeft=${canPlace(416, 160)}(want true) · onTop=${canPlace(480, 224)}(want false) · towers=${G.towers.map(t => t.x + ',' + t.y).join(' ')}`;
    G.paused = true;
  }
  if (testParams.has('zap')){ // stage a tesla (at the given upgrade level) mid-arc
    G.cash = 99999; G.wave = 30;
    placeTower('tesla', 420, 487, true);
    const zl = clamp(parseInt(testParams.get('zap'), 10) || 0, 0, TOWERS.tesla.maxUp);
    G.towers.forEach(tw => { if (tw.key === 'tesla') tw.ulv = zl; });
    for (let i = 0; i < 8; i++){ spawnDino('velociraptor', 0, false); G.dinos[G.dinos.length-1].dist = 690 + i * 26; }
    for (let s = 0; s < 3 && !G.bolts.length; s += 0.02) step(0.02);  // freeze on the arc frame
    G.paused = true;
  }
  if (testParams.has('flame')){ // regression: a flamer at the closest legal spot MUST be able to kill
    G.cash = 99999; G.wave = 5;
    placeTower('flamer', 420, 474, true);              // 44px off the path — closest canPlace allows
    const placedOk = G.towers.some(tw => tw.key === 'flamer' && tw.y === 474);
    if (testParams.get('flame') === 'vis'){            // visual mode: catch tanky dinos mid-burn
      // second flamer on the VERTICAL stretch — proves flames ride a pitched body
      placeTower('flamer', 344, 300, true);
      for (let i = 0; i < 3; i++){ spawnDino('ankylosaurus', 0, false); G.dinos[G.dinos.length-1].dist = 400 + i * 44; }
      for (let s = 0; s < 5 && !G.dinos.some(d => d.burnT > 0); s += 0.05) step(0.05);
      for (let s = 0; s < 0.4; s += 0.05) step(0.05);  // let the flames establish
      G.paused = true;
    } else {
      for (let i = 0; i < 6; i++){ spawnDino('compy', 0, false); G.dinos[G.dinos.length-1].dist = 660 + i * 30; }
      const before = G.dinos.length;
      for (let s = 0; s < 6; s += 0.05) step(0.05);
      const kills = before - G.dinos.filter(d => !d.dead).length;
      const el = $('#errbox'); el.classList.remove('hidden');
      el.textContent = `FLAME placed=${placedOk} · kills=${kills}/${before} (want > 0) · range=${TOWERS.flamer.range}`;
      G.paused = true;
    }
  }
  if (testParams.has('speedleak')){ // a leak while sped up must drop back to 1x
    G.speed = 10;
    spawnDino('velociraptor', 0, false);
    const d = G.dinos[G.dinos.length - 1];
    d.dist = G.paths[0].len - 1;     // one step from the exit
    const speedBefore = G.speed;
    for (let s = 0; s < 1 && G.dinos.length; s += 0.05) step(0.05);
    const el = $('#errbox'); el.classList.remove('hidden');
    el.textContent = `SPEEDLEAK before=${speedBefore}× · after leak=${G.speed}× (want 1) · lives=${G.lives}/${G.maxLives}`;
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
    const bossK = DINOS[testParams.get('bosskey')] ? testParams.get('bosskey') : 'trex';
    spawnDino(bossK, pathForKey(bossK), true);   // water bosses take the river
    const bt = parseFloat(testParams.get('boss')) || 1;
    for (let s = 0; s < bt; s += 0.05) step(0.05);
    G.paused = true;
  }
  if (testParams.has('card')){ // direct sticker-card preview without altering collection data
    const cardKey = DINOS[testParams.get('card')] ? testParams.get('card') : 'trex';
    const weaponKey = TOWERS[testParams.get('weapon')] ? testParams.get('weapon') : 'gatling';
    openStickerCard(weaponKey, cardKey);
  }
  if (testParams.has('kill')){ // stage any boss finale at an exact inspection frame
    const bossK = BOSS_DEATHS[testParams.get('bosskey')] ? testParams.get('bosskey') : 'trex';
    const pathI = pathForKey(bossK);
    // Keep visual-review captures focused on the finale rather than first-time
    // achievement UI. This is deliberately not persisted.
    save.ach = save.ach || {};
    save.ach.boss_first = save.ach.boss_first || 1;
    save.ach.apex = save.ach.apex || 1;
    spawnDino(bossK, pathI, true);
    const b = G.dinos[G.dinos.length - 1];
    b.dist = G.paths[pathI].len * 0.45;
    damage(b, 1e9, true);
    G.banner = null; G.cinT = 0;
    const ft = parseFloat(testParams.get('kill')) || 0.4;
    for (let s = 0; s < ft; s += 0.05) step(0.05);
    // A zero simulation speed freezes the exact frame without render() adding
    // the normal in-game pause veil over the artwork.
    G.speed = 0;
  }
}
