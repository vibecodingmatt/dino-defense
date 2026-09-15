'use strict';
/* Shared worldwide rankings; gameplay and local saves never wait for this service. */
const Leaderboards = (() => {
  const API = 'https://dino-defense-leaderboard.vibecodingmatt.workers.dev';
  const STORAGE = 'dino-defense-leaderboard-v1';
  const Rules = LeaderboardRules;
  const el = id => document.getElementById(id);
  const cleanInitials = value => value.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 3);
  let profile = {}, result = null, entryScore = null, generation = 0, boardRequest = 0, entryRequest = 0;
  let posting = false, checking = false;
  let run = null, wave = null, checkpoint = null, clockStarted = 0, savedElapsed = 0;
  let retryTimer = null, nextRegistration = 0, deferredEntry = null;
  const registrations = new Map();
  try { profile = JSON.parse(localStorage.getItem(STORAGE)) || {}; } catch (_) {}
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) profile = {};
  if (!profile.pending || typeof profile.pending !== 'object') profile.pending = {};
  profile.pending = Object.fromEntries(Object.entries(profile.pending).filter(([key, s]) =>
    s && Number.isInteger(s.map) && s.map >= 0 && s.map < LEVELS.length && String(s.map) === key
    && Number.isInteger(s.difficulty) && s.difficulty >= 1 && s.difficulty <= 1000
    && Number.isInteger(s.health) && s.health >= 0 && s.health <= 100 && Number.isInteger(s.wave) && s.wave >= 1 && s.wave <= 100
    && /^[a-f0-9-]{36}$/.test(s.runId || '') && s.cheated === false));
  for (const score of Object.values(profile.pending)) {
    score.startWave ??= 1;
    score.cleared ??= score.completedWaves === 100;
  }
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
        error.retryAfter = data.retryAfter;
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
  function summary(score) {
    return `${LEVELS[score.map].name} · Difficulty ${score.difficulty} · ${score.cleared ? 'All 100 waves cleared' : 'Reached wave ' + score.wave} · ${score.health}% health`;
  }
  function closeEntry() {
    entryRequest++; entryScore = null;
    el('leaderboardEntry').classList.add('hidden');
  }
  function closeAll() {
    clearTimeout(retryTimer); deferredEntry = null;
    generation++; boardRequest++; closeEntry();
    el('leaderboards').classList.add('hidden');
    checking = false; result = null;
  }
  function beginRun(map, difficulty, resume) {
    closeAll();
    el('victoryLeaderboard').classList.add('hidden');
    const previous = resume?.leaderboardProgress;
    // v1.75.1 could flag a harmless zero-time frame. Restart observation for
    // those older rejected ledgers; the separate saved cheat flag still applies.
    const keepPrevious = previous?.runId && (!previous.invalid || previous.ledgerVersion === 2);
    wave = null; clockStarted = performance.now(); savedElapsed = keepPrevious ? previous.elapsedMs || 0 : 0;
    nextRegistration = 0;
    el('victory').querySelector('.modalBox').insertBefore(el('victoryLeaderboard'), el('victory').querySelector('.modalBtns'));
    try {
      // An older save starts a new observed segment at its next wave. Do not
      // invent kills or elapsed time for the part played before this feature.
      run = keepPrevious ? {...previous, startWave: previous.startWave || 1} : {runId: crypto.randomUUID(), map, difficulty,
        startWave: G.wave + 1, completedWaves: G.wave, spawned: 0, kills: 0, leaks: 0, activeMs: 0, elapsedMs: 0,
        registered: false, invalid: false};
      run.ledgerVersion = 2;
      if (run.map !== map || run.difficulty !== difficulty || run.completedWaves !== G.wave) run.invalid = true;
      run.maxLives = G.maxLives; run.lastLives = G.lives;
      checkpoint = {...run};
      tryRegistration();
      return run.runId;
    } catch (_) { run = checkpoint = null; return null; }
  }
  async function register(candidate) {
    if (candidate.registered) return;
    let promise = registrations.get(candidate.runId);
    if (!promise) {
      promise = request('/runs', {map: candidate.map, difficulty: candidate.difficulty, runId: candidate.runId,
        startWave: candidate.startWave, version: VERSION, cheated: false});
      registrations.set(candidate.runId, promise);
    }
    try {
      const data = await promise;
      if (data.registered) {
        candidate.registered = true;
        if (run?.runId === candidate.runId) { run.registered = true; saveRun(); }
        const pending = profile.pending[candidate.map];
        if (pending?.runId === candidate.runId) { pending.registered = true; persistProfile(); }
      }
    } finally { if (registrations.get(candidate.runId) === promise) registrations.delete(candidate.runId); }
  }
  function tryRegistration() {
    if (!run || run.invalid || run.registered || Date.now() < nextRegistration || runDisqualified()
        || new URLSearchParams(location.search).has('test')) return;
    nextRegistration = Date.now() + 30000;
    register(run).catch(() => {}); // Result entry retries and explains failures.
  }
  window.addEventListener('online', () => { nextRegistration = 0; tryRegistration(); });
  function elapsed() { return Math.max(0, Math.round(savedElapsed + performance.now() - clockStarted)); }
  function expectedSpawns(n) {
    return Rules.spawnCount(n);
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
        || G.lives > G.maxLives || !Number.isFinite(dt) || dt < 0 || dt > 0.051
        || runDisqualified()) run.invalid = true;
    run.lastLives = Math.min(run.lastLives, G.lives);
    if (wave) wave.activeMs += dt * 1000;
  }
  function spawned() { if (wave) wave.spawned++; }
  function resolved(killed) {
    if (wave) wave[killed ? 'kills' : 'leaks']++;
    if (run && !killed) run.lastLives = Math.min(run.lastLives, Math.max(0, G.lives));
  }
  function endWave() {
    if (!run) return;
    if (!wave || G.wave !== run.completedWaves + 1 || G.spawnQ.length || G.dinos.length
        || wave.spawned !== expectedSpawns(G.wave) || wave.kills + wave.leaks !== wave.spawned) run.invalid = true;
    if (wave) for (const key of ['spawned', 'kills', 'leaks', 'activeMs']) run[key] += wave[key];
    run.completedWaves = G.wave; wave = null; checkpoint = {...run};
    tryRegistration();
  }
  function saveProgress() {
    // A mid-wave save replays that wave. Keep only completed-wave totals, but
    // retain wall time and any disqualification from the interrupted attempt.
    return run && checkpoint ? {...checkpoint, registered: run.registered, invalid: run.invalid, elapsedMs: elapsed()} : null;
  }
  function recordResult(score, disqualified) {
    result = null;
    const parent = el(score.cleared ? 'victory' : 'gameover').querySelector('.modalBox');
    parent.insertBefore(el('victoryLeaderboard'), parent.querySelector('.modalBtns'));
    el('victoryLeaderboard').classList.remove('hidden');
    el('vPostScore').classList.add('hidden');
    if (disqualified || new URLSearchParams(location.search).has('test')) {
      text('victoryRankStatus', 'Leaderboard entry is unavailable for runs with developer cheats, edited saves, or test mode.');
      return;
    }
    if (!run || run.invalid || !score.runId || score.runId !== run.runId
        || score.map !== run.map || score.difficulty !== run.difficulty || score.wave < run.startWave
        || (score.cleared ? !!wave || score.wave !== 100 || run.completedWaves !== 100 || G.lives <= 0
          : !wave || run.completedWaves !== score.wave - 1 || G.lives !== 0)
        || !Number.isFinite(G.lives) || G.lives > run.lastLives || G.maxLives !== run.maxLives || G.lives > G.maxLives
        || score.health !== Math.round(G.lives / G.maxLives * 100)) {
      text('victoryRankStatus', 'This run could not be verified: its wave, health, or speed history is inconsistent.');
      return;
    }
    const totals = {...run};
    if (wave) for (const key of ['spawned', 'kills', 'leaks', 'activeMs']) totals[key] += wave[key];
    result = {...score, startWave: run.startWave, completedWaves: run.completedWaves, spawned: totals.spawned, kills: totals.kills,
      leaks: totals.leaks, activeMs: Math.round(totals.activeMs), elapsedMs: Math.max(1, elapsed()), registered: run.registered,
      cheated: false, version: VERSION};
    const previous = profile.pending[score.map];
    if (!previous || Rules.compare(previous, result) < 0) {
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
    clearTimeout(retryTimer);
    checking = true;
    const session = generation;
    el('vPostScore').disabled = true;
    text('victoryRankStatus', 'Checking the worldwide top 50…');
    try {
      await register(score);
      const data = await request('/qualify', score);
      if (generation !== session) return;
      text('victoryRankStatus', data.qualifies ? `Top 50 material! Claim your place at #${data.rank}.` : reason(data));
      el('vPostScore').classList.toggle('hidden', !data.qualifies);
      if (!data.qualifies) forget(score);
      if (data.qualifies) {
        if (automatic) { deferredEntry = {score, rank: data.rank, session}; showDeferredEntry(); }
        else showEntry(score, data.rank);
      }
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
      if (!error.permanent && generation === session) {
        clearTimeout(retryTimer);
        retryTimer = setTimeout(() => { if (generation === session) checkResult(score, automatic); },
          Math.max(2, Math.min(error.retryAfter || 15, 60)) * 1000);
      }
    } finally {
      if (generation === session) { checking = false; el('vPostScore').disabled = false; }
    }
  }
  function showDeferredEntry() {
    if (!deferredEntry) return;
    if (deferredEntry.session !== generation) { deferredEntry = null; return; }
    const others = [...document.querySelectorAll('.modal:not(.hidden)')].some(m => !['victory', 'gameover', 'leaderboards'].includes(m.id));
    if (others || el('victoryLeaderboard').closest('.modal').classList.contains('hidden')) return;
    const next = deferredEntry; deferredEntry = null; showEntry(next.score, next.rank);
  }
  const modalObserver = new MutationObserver(showDeferredEntry);
  for (const modal of document.querySelectorAll('.modal')) modalObserver.observe(modal, {attributes: true, attributeFilter: ['class']});
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
      const values = [String(row.rank).padStart(2, '0'), row.initials, String(row.difficulty), row.cleared ? '100 ✓' : String(row.wave), row.health + '%'];
      for (const value of values) { const td = document.createElement('td'); td.textContent = value; tr.append(td); }
      if (row.you) tr.children[1].append(Object.assign(document.createElement('small'), {textContent: 'YOU', className: 'leaderboard-you'}));
      body.append(tr);
    }
    text('leaderboardStatus', data.entries.length ? `${data.entries.length} of 50 places claimed.` : 'The board is wide open. Win or fall, your run can claim the first spot.');
    text('leaderboardPersonal', data.personal
      ? `YOUR BEST · #${data.personal.rank} · ${data.personal.initials} · Difficulty ${data.personal.difficulty} · ${data.personal.cleared ? '100 waves cleared' : 'Wave ' + data.personal.wave} · ${data.personal.health}% health`
      : 'Your run can qualify even if the dinosaurs break through before wave 100.');
    el('leaderboardTable').classList.toggle('hidden', !data.entries.length);
    updatePending();
  }
  async function loadBoard() {
    clearTimeout(retryTimer); deferredEntry = null;
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
  el('goLeaderboard').onclick = () => open(G.levelIdx);
  el('vPostScore').onclick = () => checkResult(result);
  el('postPendingScore').onclick = () => checkResult(profile.pending[Number(el('leaderboardMap').value)]);
  el('leaderboardMap').onchange = loadBoard;
  el('refreshLeaderboards').onclick = loadBoard;
  el('closeLeaderboards').onclick = () => { boardRequest++; generation++; checking = false; el('leaderboards').classList.add('hidden'); };
  el('leaderboards').querySelector('.modalX').addEventListener('click', () => { boardRequest++; generation++; checking = false; });
  el('leaderboardEntry').querySelector('.modalX').addEventListener('click', closeEntry);
  el('skipArcadeEntry').onclick = closeEntry;
  return {beginRun, startWave, advance, spawned, resolved, endWave, saveProgress, recordResult, showResult, closeAll};
})();
