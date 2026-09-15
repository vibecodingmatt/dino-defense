'use strict';
/* Shared worldwide rankings; gameplay and local saves never wait for this service. */
const Leaderboards = (() => {
  const API = 'https://dino-defense-leaderboard.vibecodingmatt.workers.dev';
  const STORAGE = 'dino-defense-leaderboard-v1';
  const el = id => document.getElementById(id);
  const cleanInitials = value => value.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 3);
  let profile = {}, result = null, entryScore = null, generation = 0, boardRequest = 0, entryRequest = 0;
  let posting = false, checking = false;
  try { profile = JSON.parse(localStorage.getItem(STORAGE)) || {}; } catch (_) {}
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) profile = {};
  if (!profile.pending || typeof profile.pending !== 'object') profile.pending = {};
  profile.pending = Object.fromEntries(Object.entries(profile.pending).filter(([key, s]) =>
    s && Number.isInteger(s.map) && s.map >= 0 && s.map < LEVELS.length && String(s.map) === key
    && Number.isInteger(s.difficulty) && s.difficulty >= 1 && s.difficulty <= 1000
    && Number.isInteger(s.health) && s.health >= 0 && s.health <= 100 && s.wave === 100
    && /^[a-f0-9-]{36}$/.test(s.runId || '') && s.cheated === false));
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
      if (!response.ok && response.status !== 409) throw Error(data.error || 'The leaderboard is temporarily unavailable.');
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
  function beginRun() {
    closeAll();
    el('victoryLeaderboard').classList.add('hidden');
    // Older/insecure browsers can still play; only online ranking needs an ID.
    try { return crypto.randomUUID(); } catch (_) { return null; }
  }
  function recordVictory(score, disqualified) {
    result = null;
    el('victoryLeaderboard').classList.add('hidden');
    if (disqualified || !score.runId || new URLSearchParams(location.search).has('test') || score.wave !== 100) return;
    result = {...score, cheated: false, version: VERSION};
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
      text('victoryRankStatus', error.message + ' Your result is saved for later.');
      el('vPostScore').classList.remove('hidden');
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
    } catch (error) { if (id === entryRequest) text('entryStatus', error.message + ' Your result is saved.'); }
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
  return {beginRun, recordVictory, showResult, closeAll};
})();
