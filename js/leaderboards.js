'use strict';
/* Shared worldwide rankings; gameplay and local saves never wait for this service. */
const Leaderboards = (() => {
  const API = 'https://dino-defense-leaderboard.vibecodingmatt.workers.dev';
  const STORAGE = 'dino-defense-leaderboard-v1';
  const el = id => document.getElementById(id);
  const cleanInitials = value => value.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 3);
  let profile = {}, result = null, entryScore = null, generation = 0, boardRequest = 0, entryRequest = 0;
  let posting = false, checking = false;
  let run = null, wave = null, checkpoint = null, clockStarted = 0, savedElapsed = 0;
  try { profile = JSON.parse(localStorage.getItem(STORAGE)) || {}; } catch (_) {}
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) profile = {};
  if (!profile.pending || typeof profile.pending !== 'object') profile.pending = {};
  profile.pending = Object.fromEntries(Object.entries(profile.pending).filter(([key, s]) =>
    s && Number.isInteger(s.map) && s.map >= 0 && s.map < LEVELS.length && String(s.map) === key
    && Number.isInteger(s.difficulty) && s.difficulty >= 1 && s.difficulty <= 1000
    && Number.isInteger(s.health) && s.health >= 0 && s.health <= 100 && s.wave === 100
    && /^[a-f0-9-]{36}$/.test(s.runId || '') && s.cheated === false && s.completedWaves === 100));
  function persistProfile() { try { localStorage.setItem(STORAGE, JSON.stringify(profile)); } catch (_) {} }
  function token() {
    if (!/^[a-f0-9]{64}$/.test(profile.token || '')) {
      profile.token = [...crypto.getRandomValues(new Uint8Array(32))].map(n => n.toString(16).padStart(2, '0')).join('');
      persistProfile();
    }
    return profile.token;
  }
  async function request(path, score) {
    if (navigator.onLine === false) throw Error('You are offline. Connect to view or post scores.');
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(API + path, {method: score ? 'POST' : 'GET', credentials: 'omit',
        signal: controller.signal, cache: 'no-store', headers: {Authorization: 'Bearer ' + token(), ...(score ? {'Content-Type': 'application/json'} : {})},
        ...(score ? {body: JSON.stringify(score)} : {})});
      const data = await response.json();
      if (!response.ok && response.status !== 409) {
        const error = Error(data.error || 'The leaderboard is temporarily unavailable.');
        error.permanent = [400, 401, 413, 415, 422].includes(response.status);
        throw error;
      }
      return {...data, conflict: response.status === 409};
    } catch (error) {
      if (error.name === 'AbortError' || error instanceof TypeError) throw Error('Cannot reach the leaderboard. Please try again.');
      throw error;
    } finally { clearTimeout(timeout); }
  }
  function text(id, value) { el(id).textContent = value; }
  function forget(score) {
    if (profile.pending[score.map]?.runId === score.runId) { delete profile.pending[score.map]; persistProfile(); }
  }
  function summary(score) { return `${LEVELS[score.map].name} · Difficulty ${score.difficulty} · ${score.health}% health`; }
  function closeEntry() {
    entryRequest++; entryScore = null;
    el('leaderboardEntry').classList.add('hidden');
  }
  function closeAll() {
    generation++; boardRequest++; closeEntry();
    el('leaderboards').classList.add('hidden');
    checking = false; result = null;
  }
  function beginRun(map, difficulty, resume) {
    closeAll();
    el('victoryLeaderboard').classList.add('hidden');
    wave = null; clockStarted = performance.now(); savedElapsed = resume?.elapsedMs || 0;
    try {
      run = resume ? {...resume} : {runId: crypto.randomUUID(), map, difficulty,
        completedWaves: 0, spawned: 0, kills: 0, leaks: 0, activeMs: 0, elapsedMs: 0,
        registered: false, invalid: false};
      if (run.map !== map || run.difficulty !== difficulty || run.completedWaves !== G.wave) run.invalid = true;
      run.maxLives = G.maxLives; run.lastLives = G.lives;
      checkpoint = {...run};
      const current = run;
      // Check in without blocking play. Repeating a check-in never resets the
      // server clock. An offline resume keeps its existing registration.
      if (!run.invalid && !runDisqualified() && !new URLSearchParams(location.search).has('test')) {
        request('/runs', {map, difficulty, runId: run.runId, version: VERSION, cheated: false})
          .then(data => { if (run === current && data.registered) { run.registered = true; saveRun(); } })
          .catch(() => {});
      }
      return run.runId;
    } catch (_) { run = checkpoint = null; return null; }
  }
  function elapsed() { return Math.max(0, Math.round(savedElapsed + performance.now() - clockStarted)); }
  function expectedSpawns(n) {
    return Math.min(60, 8 + Math.floor(n * 0.7)) + ((G.level.bosses?.[n] || BOSS_WAVES[n])?.length || 0);
  }
  function startWave() {
    if (!run) return;
    if (wave || G.wave !== run.completedWaves + 1 || G.waveTotal !== expectedSpawns(G.wave)) run.invalid = true;
    wave = {spawned: 0, kills: 0, leaks: 0, activeMs: 0};
  }
  function advance(dt) {
    if (!run) return;
    if (G.levelIdx !== run.map || G.difficulty !== run.difficulty || ![1, 2, 4, 10].includes(G.speed)
        || !Number.isFinite(G.lives) || G.lives > run.lastLives || G.maxLives !== run.maxLives
        || G.lives > G.maxLives || !Number.isFinite(dt) || dt <= 0 || dt > 0.051
        || runDisqualified()) run.invalid = true;
    run.lastLives = Math.min(run.lastLives, G.lives);
    if (wave) wave.activeMs += dt * 1000;
  }
  function spawned() { if (wave) wave.spawned++; }
  function resolved(killed) {
    if (wave) wave[killed ? 'kills' : 'leaks']++;
    if (run && !killed) run.lastLives = Math.min(run.lastLives, G.lives);
  }
  function endWave() {
    if (!run) return;
    if (!wave || G.wave !== run.completedWaves + 1 || G.spawnQ.length || G.dinos.length
        || wave.spawned !== expectedSpawns(G.wave) || wave.kills + wave.leaks !== wave.spawned) run.invalid = true;
    if (wave) for (const key of ['spawned', 'kills', 'leaks', 'activeMs']) run[key] += wave[key];
    run.completedWaves = G.wave; wave = null; checkpoint = {...run};
  }
  function saveProgress() {
    // A mid-wave save replays that wave. Keep only completed-wave totals, but
    // retain wall time and any disqualification from the interrupted attempt.
    return run && checkpoint ? {...checkpoint, registered: run.registered, invalid: run.invalid, elapsedMs: elapsed()} : null;
  }
  function recordVictory(score, disqualified) {
    result = null;
    el('victoryLeaderboard').classList.add('hidden');
    if (disqualified || !score.runId || new URLSearchParams(location.search).has('test') || score.wave !== 100) return;
    if (!run || run.invalid || !run.registered || wave || run.completedWaves !== 100
        || run.spawned !== 4074 || run.kills + run.leaks !== 4074 || run.activeMs < 1100000
        || run.activeMs > elapsed() * 10 + 1000 || score.map !== run.map || score.difficulty !== run.difficulty
        || G.lives <= 0 || !Number.isFinite(G.lives) || G.lives > run.lastLives || G.maxLives !== run.maxLives
        || G.lives > G.maxLives || score.health !== Math.round(G.lives / G.maxLives * 100)) {
      el('victoryLeaderboard').classList.remove('hidden');
      el('vPostScore').classList.add('hidden');
      text('victoryRankStatus', 'This run is not eligible for the worldwide board. Start a new run while connected to enter.');
      return;
    }
    result = {...score, completedWaves: run.completedWaves, spawned: run.spawned, kills: run.kills,
      leaks: run.leaks, activeMs: Math.round(run.activeMs), elapsedMs: elapsed(), cheated: false, version: VERSION};
    const previous = profile.pending[score.map];
    if (!previous || previous.difficulty < score.difficulty || (previous.difficulty === score.difficulty && previous.health < score.health)) {
      profile.pending[score.map] = result; persistProfile();
    }
  }
  function showEntry(score, rank) {
    entryScore = score; entryRequest++;
    text('entryRank', `YOU MADE THE TOP 50 · #${rank}`);
    text('entrySummary', summary(score));
    text('entryStatus', '');
    el('arcadeInitials').value = cleanInitials(typeof profile.initials === 'string' ? profile.initials : '');
    el('leaderboardEntry').classList.remove('hidden');
    updateInitials();
    requestAnimationFrame(() => { if (entryScore === score) { el('arcadeInitials').focus(); el('arcadeInitials').select(); } });
  }
  function reason(data) {
    return data.submitted ? 'Your score is on the board.' : data.reason === 'personal-best'
      ? 'Your existing personal best is higher or tied.' : 'This run finished outside the top 50. Keep climbing!';
  }
  async function checkResult(score, automatic = false) {
    if (!score || checking) return;
    checking = true;
    const session = generation;
    el('vPostScore').disabled = true;
    text('victoryRankStatus', 'Checking the worldwide top 50…');
    try {
      const data = await request('/qualify', score);
      if (generation !== session) return;
      text('victoryRankStatus', data.qualifies ? `Top 50 material! Claim your place at #${data.rank}.` : reason(data));
      el('vPostScore').classList.toggle('hidden', !data.qualifies);
      if (!data.qualifies) forget(score);
      const otherModal = [...document.querySelectorAll('.modal:not(.hidden)')].some(m => !['victory','leaderboards'].includes(m.id));
      if (data.qualifies && (!automatic || !otherModal)) showEntry(score, data.rank);
      if (!el('leaderboards').classList.contains('hidden')) {
        updatePending();
        if (!data.qualifies) text('leaderboardStatus', reason(data));
      }
    } catch (error) {
      if (generation !== session) return;
      if (error.permanent) forget(score);
      text('victoryRankStatus', error.message + (error.permanent ? '' : ' Your result is saved for later.'));
      el('vPostScore').classList.toggle('hidden', !!error.permanent);
      updatePending();
      if (!el('leaderboards').classList.contains('hidden')) text('leaderboardStatus', error.message);
    } finally {
      if (generation === session) { checking = false; el('vPostScore').disabled = false; }
    }
  }
  function showResult() {
    if (!result) return;
    el('victoryLeaderboard').classList.remove('hidden');
    el('vPostScore').classList.remove('hidden');
    checkResult(result, true);
  }
  function updatePending() {
    const pending = profile.pending[Number(el('leaderboardMap').value)];
    el('postPendingScore').classList.toggle('hidden', !pending);
  }
  function renderBoard(data) {
    const body = el('leaderboardRows'); body.replaceChildren();
    for (const row of data.entries) {
      const tr = document.createElement('tr');
      if (row.you) tr.className = 'your-score';
      const values = [String(row.rank).padStart(2, '0'), row.initials + (row.you ? ' · YOU' : ''), String(row.difficulty), row.health + '%'];
      for (const value of values) { const td = document.createElement('td'); td.textContent = value; tr.append(td); }
      body.append(tr);
    }
    text('leaderboardStatus', data.entries.length ? `${data.entries.length} of 50 places claimed.` : 'The board is wide open. Complete all 100 waves to claim the first spot.');
    text('leaderboardPersonal', data.personal
      ? `YOUR BEST · #${data.personal.rank} · ${data.personal.initials} · Difficulty ${data.personal.difficulty} · ${data.personal.health}% health`
      : 'Complete a zone and claim a top-50 score to put your initials here.');
    el('leaderboardTable').classList.toggle('hidden', !data.entries.length);
    updatePending();
  }
  async function loadBoard() {
    generation++; checking = false; el('vPostScore').disabled = false;
    const id = ++boardRequest, map = Number(el('leaderboardMap').value);
    text('leaderboardStatus', 'Calling the scorekeeper…'); text('leaderboardPersonal', '');
    el('leaderboardTable').classList.add('hidden');
    el('leaderboardRows').replaceChildren(); updatePending();
    try {
      const data = await request('/leaderboard?map=' + map);
      if (id === boardRequest) renderBoard(data);
    } catch (error) { if (id === boardRequest) text('leaderboardStatus', error.message); }
  }
  function open(map = 0) {
    el('leaderboardMap').value = String(map);
    el('leaderboards').classList.remove('hidden');
    loadBoard();
  }
  function updateInitials() {
    const input = el('arcadeInitials'); input.value = cleanInitials(input.value);
    el('submitArcadeScore').disabled = posting || !/^[A-Z0-9]{3}$/.test(input.value);
  }
  el('arcadeInitials').addEventListener('input', updateInitials);
  el('arcadeEntryForm').addEventListener('submit', async event => {
    event.preventDefault();
    const initials = cleanInitials(el('arcadeInitials').value), score = entryScore;
    if (posting || !score || !/^[A-Z0-9]{3}$/.test(initials)) return;
    posting = true; updateInitials();
    const id = entryRequest;
    text('entryStatus', 'Saving your place in history…');
    try {
      const data = await request('/scores', {...score, initials});
      if (data.submitted) { profile.initials = initials; forget(score); persistProfile(); }
      else if (data.conflict) forget(score);
      updatePending();
      if (id !== entryRequest) return;
      if (data.submitted) {
        text('victoryRankStatus', `Score posted! ${initials} · #${data.personal?.rank || '—'}`);
        el('vPostScore').classList.add('hidden');
        closeEntry();
        el('leaderboardMap').value = String(score.map);
        el('leaderboards').classList.remove('hidden');
        boardRequest++; renderBoard(data);
      } else {
        text('entryStatus', 'The rankings changed. ' + reason(data));
        entryScore = null;
        el('vPostScore').classList.add('hidden');
      }
    } catch (error) {
      if (error.permanent) { forget(score); updatePending(); }
      if (id === entryRequest) {
        text('entryStatus', error.message + (error.permanent ? '' : ' Your result is saved.'));
        if (error.permanent) entryScore = null;
      }
    }
    finally { posting = false; updateInitials(); if (!entryScore) el('submitArcadeScore').disabled = true; }
  });
  for (const [index, level] of LEVELS.entries()) {
    const option = document.createElement('option'); option.value = String(index); option.textContent = level.name;
    el('leaderboardMap').append(option);
  }
  el('btnLeaderboards').onclick = () => open();
  el('vLeaderboard').onclick = () => open(G.levelIdx);
  el('vPostScore').onclick = () => checkResult(result);
  el('postPendingScore').onclick = () => checkResult(profile.pending[Number(el('leaderboardMap').value)]);
  el('leaderboardMap').onchange = loadBoard;
  el('refreshLeaderboards').onclick = loadBoard;
  el('closeLeaderboards').onclick = () => { boardRequest++; generation++; checking = false; el('leaderboards').classList.add('hidden'); };
  el('leaderboards').querySelector('.modalX').addEventListener('click', () => { boardRequest++; generation++; checking = false; });
  el('leaderboardEntry').querySelector('.modalX').addEventListener('click', closeEntry);
  el('skipArcadeEntry').onclick = closeEntry;
  return {beginRun, startWave, advance, spawned, resolved, endWave, saveProgress, recordVictory, showResult, closeAll};
})();
