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
          settings:{invincible:false, mute:false, auto:true}};
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
let save = loadSave();
const persist = () => localStorage.setItem(SAVE_KEY, JSON.stringify(save));
const labTier = k => save.lab[k] || 0;

/* ---------------- tiny synth audio ---------------- */
let AC = null;
function audio(){
  if (save.settings.mute) return null;
  if (!AC){ try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){ return null; } }
  if (AC.state === 'suspended') AC.resume();
  return AC;
}
function tone(freq, dur, type, vol, sweep){
  const ac = audio(); if (!ac) return;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type || 'square'; o.frequency.value = freq;
  if (sweep) o.frequency.exponentialRampToValueAtTime(Math.max(30, sweep), ac.currentTime + dur);
  g.gain.value = vol || 0.05;
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
  o.connect(g); g.connect(ac.destination);
  o.start(); o.stop(ac.currentTime + dur);
}
function noiseHit(dur, vol, low){
  const ac = audio(); if (!ac) return;
  const n = ac.sampleRate * dur, buf = ac.createBuffer(1, n, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random()*2 - 1) * (1 - i/n);
  const src = ac.createBufferSource(); src.buffer = buf;
  const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = low || 900;
  const g = ac.createGain(); g.gain.value = vol || 0.15;
  src.connect(f); f.connect(g); g.connect(ac.destination); src.start();
}
const SFX = {
  shot:   () => tone(880, 0.05, 'square', 0.025),
  dart:   () => tone(1400, 0.06, 'triangle', 0.03, 500),
  snipe:  () => { tone(220, 0.15, 'sawtooth', 0.05, 60); noiseHit(0.1, 0.08); },
  boom:   () => noiseHit(0.35, 0.2, 500),
  zap:    () => tone(1800, 0.09, 'sawtooth', 0.035, 300),
  cryo:   () => tone(600, 0.12, 'sine', 0.04, 1400),
  pulse:  () => tone(160, 0.25, 'sine', 0.06, 60),
  coin:   () => tone(1200, 0.07, 'triangle', 0.03, 1800),
  leak:   () => tone(140, 0.35, 'sawtooth', 0.08, 60),
  roar:   () => { tone(90, 0.7, 'sawtooth', 0.10, 45); noiseHit(0.5, 0.1, 300); },
  build:  () => tone(500, 0.08, 'square', 0.04, 900),
  upgrade:() => { tone(700, 0.07, 'square', 0.04, 1000); setTimeout(() => tone(1000, 0.08, 'square', 0.04, 1400), 70); },
  error:  () => tone(180, 0.12, 'square', 0.05, 120),
};

/* ---------------- game state ---------------- */
const G = {
  state: 'menu',            // menu | playing
  levelIdx: 0, level: null,
  paths: [],                // [{pts, segs, len}]
  bg: null,
  wave: 0, waveActive: false,
  cash: 0, lives: 0, maxLives: 0,
  dinos: [], towers: [], projs: [], fx: [], bolts: [], texts: [],
  spawnQ: [], spawnT: 0,
  speed: 1, paused: false,
  placing: null, selected: null,
  mouse: {x: 0, y: 0, on: false},
  autoTimer: -1,
  shake: 0, banner: null,
  checkpoint: null,
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
const hpScale    = w => (0.7 + 0.3*w) * Math.pow(1.021, w) * G.level.hpMult;
const speedScale = w => Math.min(1.4, 1 + w*0.0035);
const bountyOf   = (def, w) => Math.max(1, Math.round(def.bounty * (1 + w*0.012) * (1 + 0.06*labTier('bounty'))));
const startCash  = () => 260 + 60*labTier('start_cash');
const startLives = () => 100 + 15*labTier('base_hp');

function towerStats(t){
  const def = TOWERS[t.key];
  const ammo = labTier('ammo_' + t.key);
  return {
    dmg:   def.dmg   * (1 + UPG.dmg.mult   * t.lv.dmg)   * (1 + 0.06*labTier('dmg_all')) * (1 + 0.08*ammo),
    rof:   def.rof   * (1 + UPG.rate.mult  * t.lv.rate)  * (1 + 0.04*ammo),
    range: def.range * (1 + UPG.range.mult * t.lv.range) * (1 + 0.04*labTier('range_all')),
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
  const d = {
    key, def, boss: !!isBoss,
    name: def.name, painter: def.painter, pal: def.pal, feat: def.feat, flying: !!def.flying,
    size: def.size, armor: def.armor, dmgToBase: def.dmg,
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
    G.banner = {text: '⚠  ' + def.name.toUpperCase() + '  ⚠', t: 2.6};
    if (def.roar) SFX.roar();
    G.shake = Math.max(G.shake, 6);
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
    if (hyp(t.x, t.y, p.x, p.y) > st.range + d.size * 0.4) continue;
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
  if (d.hp <= 0){
    d.dead = true;
    const p = dinoPos(d);
    G.cash += d.bounty;
    addText(p.x, p.y - d.size, '+$' + d.bounty, '#ffd24a');
    addFx('puff', p.x, p.y, d.size);
    if (d.boss){ G.shake = Math.max(G.shake, 10); SFX.boom(); addFx('ring', p.x, p.y, 20); }
    if (Math.random() < 0.3) SFX.coin();
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
  if (t.cd > 0 || !target) return;
  t.cd = 1 / st.rof;
  t.flash = 0.12;
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
    case 'missile':
      SFX.shot();
      G.projs.push({kind:'missile', x:t.x, y:t.y, target, speed:420, dmg:st.dmg, splash:def.splash, tower:t, vx:Math.cos(t.angle)*420, vy:Math.sin(t.angle)*420, color:'#ffb0a0'});
      break;
    case 'cryo':
      SFX.cryo();
      G.projs.push({kind:'cryo', x:t.x, y:t.y, target, speed:460, dmg:st.dmg, splash:def.splash, slow:def.slow, tower:t, color:'#cfeeff'});
      break;
  }
}

function updateProjs(dt){
  for (const pr of G.projs){
    if (pr.hit) continue;
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
  if (G.fx.length > 220) return;
  G.fx.push({kind, x, y, r, ang: ang || 0, t: 0,
             dur: kind === 'sonic' ? 0.5 : kind === 'boom' ? 0.45 : kind === 'frost' ? 0.5 : kind === 'flame' ? 0.22 : kind === 'ring' ? 0.8 : 0.3});
}
function addText(x, y, txt, color){
  if (G.texts.length > 40) return;
  G.texts.push({x, y, txt, color, t: 0});
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
    // move
    const slow = d.slowT > 0 ? d.slowF : 1;
    d.dist += d.speed * slow * dt;
    d.phase += dt * (d.flying ? 6 : 7) * slow;
    const path = G.paths[d.pathI];
    if (d.dist >= path.len){
      d.leaked = true;
      if (!save.settings.invincible){
        G.lives -= d.dmgToBase * (d.boss ? 1 : 1);
        G.shake = Math.max(G.shake, 4);
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
  G.spawnQ = buildWave(G.wave);
  G.spawnT = 0;
  // record best
  const b = save.best[G.levelIdx] || 0;
  if (G.wave > b){ save.best[G.levelIdx] = G.wave; persist(); }
  updateHUD();
}
function endWave(){
  G.waveActive = false;
  const bonus = 50 + 6 * G.wave;
  G.cash += bonus;
  const dna = Math.round((2 + Math.floor(G.wave / 4) + (BOSS_WAVES[G.wave] ? 15 * BOSS_WAVES[G.wave].length : 0)) * (1 + G.levelIdx * 0.5));
  save.dna += dna;
  persist();
  addText(W/2, 120, `Wave ${G.wave} cleared!  +$${bonus}  +${dna} DNA`, '#9fe870');
  SFX.coin();
  if (G.wave >= WAVES_PER_LEVEL){ victory(); return; }
  // checkpoint at start of each block of 10
  if ((G.wave) % 10 === 0){
    G.checkpoint = snapshot();
  }
  saveRun();
  if (save.settings.auto) G.autoTimer = 3;
  updateHUD();
}
function snapshot(){
  return {
    wave: G.wave, cash: G.cash, lives: G.lives,
    towers: G.towers.map(t => ({key: t.key, x: t.x, y: t.y, lv: {...t.lv}, invested: t.invested, mode: t.mode})),
  };
}

/* persist the current run so a closed tab can pick up where it left off.
   If saved mid-wave, the resume point is the start of that wave. */
function saveRun(){
  if (G.state !== 'playing' || G.over) return;
  const s = snapshot();
  s.wave = G.waveActive ? G.wave - 1 : G.wave;   // completed waves
  s.levelIdx = G.levelIdx;
  s.cp = G.checkpoint;
  save.run = s;
  persist();
}
function clearRun(){ save.run = null; persist(); }
function restoreSnapshot(s){
  G.wave = s.wave; G.cash = s.cash; G.lives = Math.max(s.lives, Math.round(startLives() * 0.5));
  G.towers = s.towers.map(t => ({key: t.key, x: t.x, y: t.y, lv: {...t.lv}, invested: t.invested, mode: t.mode, cd: 0, angle: 0, flash: 0}));
}

/* ---------------- level lifecycle ---------------- */
/* mode: 'fresh' | 'cp' (retry from checkpoint) | 'resume' (saved run) */
function startLevel(idx, mode){
  G.levelIdx = idx;
  G.level = LEVELS[idx];
  G.paths = buildPaths(G.level);
  G.bg = renderBackground(G.level, W, H, null);
  G.dinos = []; G.projs = []; G.fx = []; G.bolts = []; G.texts = []; G.spawnQ = [];
  G.selected = null; G.placing = null;
  G.waveActive = false; G.autoTimer = -1; G.over = false; G.banner = null;
  G.speed = 1;
  if (mode === 'cp' && G.checkpoint){
    restoreSnapshot(G.checkpoint);
  } else if (mode === 'resume' && save.run){
    restoreSnapshot(save.run);
    G.wave = save.run.wave; G.lives = save.run.lives;
    G.checkpoint = save.run.cp || null;
  } else {
    G.wave = 0; G.cash = startCash(); G.towers = [];
    G.lives = startLives(); G.checkpoint = null;
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
  updateHUD();
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
  $('#victory').classList.remove('hidden');
  SFX.roar();
}
function defeat(){
  G.over = true;
  clearRun();
  $('#defeatText').innerHTML =
    `The perimeter fell on <b>wave ${G.wave}</b> of ${G.level.name}.<br>` +
    `DNA you earned this run has been banked — spend it in the Lab.`;
  $('#retryCp').style.display = G.checkpoint ? '' : 'none';
  if (G.checkpoint) $('#retryCp').textContent = `⟲ Retry from Wave ${G.checkpoint.wave + 1}`;
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
function placeTower(key, x, y){
  const def = TOWERS[key];
  if (G.cash < def.cost || !canPlace(x, y)) { SFX.error(); return; }
  G.cash -= def.cost;
  G.towers.push({key, x, y, lv: {dmg: 0, rate: 0, range: 0}, cd: 0, angle: rand(0, 6.28), flash: 0, invested: def.cost, mode: 'first'});
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
  $('#tpName').textContent = def.icon + ' ' + def.name;
  $('#tpStats').innerHTML =
    `DMG <b>${st.dmg.toFixed(1)}</b> · ROF <b>${st.rof.toFixed(2)}/s</b> · RNG <b>${Math.round(st.range)}</b>` +
    (def.air ? '' : ' · <span class="warn">cannot hit flyers</span>');
  for (const stat of ['dmg', 'rate', 'range']){
    const lv = t.lv[stat];
    const btn = $('#up_' + stat);
    if (lv >= UPG.maxLv){ btn.textContent = `${UPG[stat].label} MAX`; btn.disabled = true; }
    else {
      const cost = UPG.cost(def, lv);
      btn.textContent = `${UPG[stat].label} ${'▮'.repeat(lv)}${'▯'.repeat(UPG.maxLv-lv)}  $${cost}`;
      btn.disabled = G.cash < cost;
    }
  }
  $('#tpMode').textContent = 'Target: ' + t.mode.toUpperCase();
  $('#tpSell').textContent = `Sell for $${Math.round(t.invested * 0.7)}`;
}
function upgrade(stat){
  const t = G.selected; if (!t) return;
  const def = TOWERS[t.key];
  const lv = t.lv[stat];
  if (lv >= UPG.maxLv) return;
  const cost = UPG.cost(def, lv);
  if (G.cash < cost){ SFX.error(); return; }
  G.cash -= cost; t.lv[stat]++; t.invested += cost;
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
  // shop affordability
  $$('.shopCard').forEach(el => {
    el.classList.toggle('cant', G.cash < TOWERS[el.dataset.key].cost);
    el.classList.toggle('sel', G.placing === el.dataset.key);
  });
}
function buildShop(){
  const el = $('#shopCards');
  el.innerHTML = '';
  for (const [key, def] of Object.entries(TOWERS)){
    const card = document.createElement('div');
    card.className = 'shopCard';
    card.dataset.key = key;
    card.innerHTML = `<div class="ico">${def.icon}</div><div class="nm">${def.name}</div><div class="cost">$${def.cost}</div>`;
    card.title = def.desc + (def.air ? '' : '  (Cannot hit flying dinosaurs.)');
    card.onclick = () => {
      G.placing = (G.placing === key) ? null : key;
      selectTower(null);
      updateHUD();
    };
    el.appendChild(card);
  }
}
function buildMenu(){
  $('#menuDna').textContent = fmt(save.dna) + ' DNA';
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
function syncSettings(){
  $('#optInv').checked = save.settings.invincible;
  $('#optMute').checked = save.settings.mute;
  $('#optAuto').checked = save.settings.auto;
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
  if (!G.paused && !G.over){
    for (let i = 0; i < G.speed; i++) step(dt);
  }
  render(dt);
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
  for (const f of G.fx) f.t += dt;
  G.fx = G.fx.filter(f => f.t < f.dur);
  for (const b of G.bolts) b.t -= dt;
  G.bolts = G.bolts.filter(b => b.t > 0);
  for (const tx of G.texts) tx.t += dt;
  G.texts = G.texts.filter(tx => tx.t < 1.4);
  if (G.banner){ G.banner.t -= dt; if (G.banner.t <= 0) G.banner = null; }
  G.shake = Math.max(0, G.shake - dt * 18);
}

function render(dt){
  ctx.save();
  if (G.shake > 0) ctx.translate(rand(-G.shake, G.shake), rand(-G.shake, G.shake));
  ctx.drawImage(G.bg, 0, 0);

  // tower bases + range of selected/placing
  for (const t of G.towers) drawTowerBase(ctx, t.x, t.y, TOWERS[t.key].color, t === G.selected);
  if (G.selected){
    const st = towerStats(G.selected);
    ctx.strokeStyle = 'rgba(255,220,120,0.5)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(G.selected.x, G.selected.y, st.range, 0, Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);
  }

  // dinos sorted by y (ground first, flyers on top)
  const ground = [], air = [];
  for (const d of G.dinos) (d.flying ? air : ground).push(d);
  ground.sort((a, b) => dinoPos(a).y - dinoPos(b).y);

  const drawOne = d => {
    const p = dinoPos(d);
    const dir = Math.cos(p.ang) >= 0 ? 1 : -1;
    const alpha = d.cloaked && d.revealT <= 0 ? 0.22 : 1;
    drawDino(ctx, d, p.x, p.y, dir, d.phase, alpha);
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
    }
  };
  ground.forEach(drawOne);

  // projectiles
  for (const pr of G.projs){
    ctx.fillStyle = pr.color;
    if (pr.kind === 'missile'){
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
    }
  }

  // turrets above ground dinos
  for (const t of G.towers) drawTowerTurret(ctx, t, t.flash || 0);

  // flyers on top
  air.forEach(drawOne);

  // placing ghost
  if (G.placing && G.mouse.on){
    const def = TOWERS[G.placing];
    const ok = canPlace(G.mouse.x, G.mouse.y) && G.cash >= def.cost;
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = ok ? 'rgba(140,240,140,0.6)' : 'rgba(255,90,90,0.7)';
    ctx.fillStyle = ok ? 'rgba(140,240,140,0.12)' : 'rgba(255,90,90,0.12)';
    const rng = def.range * (1 + 0.04*labTier('range_all'));
    ctx.beginPath(); ctx.arc(G.mouse.x, G.mouse.y, rng, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    drawTowerBase(ctx, G.mouse.x, G.mouse.y, def.color, false);
    ctx.globalAlpha = 1;
  }

  // floating texts
  ctx.textAlign = 'center'; ctx.font = 'bold 15px Verdana, sans-serif';
  for (const tx of G.texts){
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

  // boss banner
  if (G.banner){
    const a = Math.min(1, G.banner.t / 0.4) * Math.min(1, (2.6 - G.banner.t) / 0.3 + 1);
    ctx.globalAlpha = clamp(a, 0, 1);
    ctx.fillStyle = 'rgba(80,10,10,0.75)';
    ctx.fillRect(0, 70, W, 54);
    ctx.fillStyle = '#ffd24a';
    ctx.font = 'bold 30px Verdana, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(G.banner.text, W/2, 106);
    ctx.globalAlpha = 1;
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
cv.addEventListener('click', e => {
  if (G.state !== 'playing') return;
  const p = canvasPos(e);
  if (G.placing){
    placeTower(G.placing, p.x, p.y);
    if (!e.shiftKey && G.cash < TOWERS[G.placing].cost) { G.placing = null; }
    updateHUD();
    return;
  }
  // select tower under cursor
  let hit = null;
  for (const t of G.towers) if (hyp(p.x, p.y, t.x, t.y) < 20) hit = t;
  selectTower(hit);
});
cv.addEventListener('contextmenu', e => {
  e.preventDefault();
  G.placing = null; selectTower(null); updateHUD();
});
window.addEventListener('keydown', e => {
  if (G.state !== 'playing') return;
  const keys = Object.keys(TOWERS);
  if (e.key >= '1' && e.key <= String(keys.length)){
    G.placing = keys[+e.key - 1]; selectTower(null); updateHUD();
  }
  if (e.key === 'Escape'){ G.placing = null; selectTower(null); updateHUD(); }
  if (e.key === ' '){ e.preventDefault(); if (!G.waveActive) startWave(); else togglePause(); }
});
function togglePause(){ G.paused = !G.paused; updateHUD(); }

/* ---------------- wire up UI ---------------- */
$('#btnWave').onclick = () => { startWave(); };
$('#btnPause').onclick = togglePause;
$$('#speedBtns button').forEach(b => b.onclick = () => { G.speed = +b.dataset.s; G.paused = false; updateHUD(); });
$('#btnMenu').onclick = () => { if (!G.over) saveRun(); toMenu(); };
$('#up_dmg').onclick = () => upgrade('dmg');
$('#up_rate').onclick = () => upgrade('rate');
$('#up_range').onclick = () => upgrade('range');
$('#tpSell').onclick = sellSelected;
$('#tpMode').onclick = () => {
  const modes = ['first', 'last', 'strong', 'close'];
  const t = G.selected; if (!t) return;
  t.mode = modes[(modes.indexOf(t.mode) + 1) % modes.length];
  renderTowerPanel();
};
$('#btnLab').onclick = () => { buildLab(); $('#lab').classList.remove('hidden'); };
$('#labClose').onclick = () => { $('#lab').classList.add('hidden'); buildMenu(); };
$('#btnSettings').onclick = () => { syncSettings(); $('#settings').classList.remove('hidden'); };
$('#setClose').onclick = () => { $('#settings').classList.add('hidden'); };
$('#optInv').onchange = e => { save.settings.invincible = e.target.checked; persist(); updateHUD(); };
$('#optMute').onchange = e => { save.settings.mute = e.target.checked; persist(); };
$('#optAuto').onchange = e => { save.settings.auto = e.target.checked; persist(); };
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
$('#retryCp').onclick = () => startLevel(G.levelIdx, 'cp');
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
  placeTower('gatling', 420, 260);
  placeTower('tranq', 550, 330);
  placeTower('missile', 800, 300);
  startWave();
  const sim = parseFloat(testParams.get('sim')) || 0;
  for (let s = 0; s < sim; s += 0.05) step(0.05);
  if (testParams.has('wave')){ G.wave = parseInt(testParams.get('wave'), 10) - 1; G.waveActive = false; startWave(); for (let s = 0; s < (sim || 6); s += 0.05) step(0.05); }
}
