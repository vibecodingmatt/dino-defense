// Public, casual leaderboard. Client reports are not proof of an authentic run.
// Anonymous bearer credentials are hashed at rest and never appear in rankings.
import '../js/leaderboard-rules.js';
const Rules = globalThis.LeaderboardRules;
const LIMIT = 50;
const RUN_LIFETIME = Rules.lifetime;
const order = 'difficulty DESC, wave DESC, cleared DESC, health DESC, achieved ASC, player ASC';
const int = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;
class HttpError extends Error {
  constructor(status, message, retryAfter) { super(message); this.status = status; this.retryAfter = retryAfter; }
}
function fail(status, message) { throw new HttpError(status, message); }
async function playerId(request, required = false) {
  const authorization = request.headers.get('Authorization');
  if (!authorization && !required) return null;
  if (!/^Bearer [a-f0-9]{64}$/.test(authorization || '')) fail(401, 'A player identity is required.');
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(authorization.slice(7)));
  return [...new Uint8Array(hash)].map(n => n.toString(16).padStart(2, '0')).join('');
}
async function readJson(request) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) fail(415, 'Send JSON.');
  const reader = request.body?.getReader();
  if (!reader) fail(400, 'Missing result.');
  const chunks = []; let size = 0;
  while (true) {
    const {value, done} = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 2048) { await reader.cancel(); fail(413, 'Result is too large.'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch (_) { fail(400, 'Invalid JSON.'); }
}
function validateRunStart(score) {
  if (!score || !int(score.map, 0, 6) || !int(score.difficulty, 1, 1000)
      || typeof score.runId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(score.runId)
      || typeof score.version !== 'string' || !/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(score.version)
      || !int(score.startWave, 1, 100) || score.cheated !== false) fail(400, 'An eligible run is required.');
}
function validateScore(score, submit) {
  validateRunStart(score);
  if (!int(score.wave, score.startWave, 100) || typeof score.cleared !== 'boolean'
      || score.completedWaves !== (score.cleared ? 100 : score.wave - 1)
      || (score.cleared && score.wave !== 100) || !int(score.health, 0, 100)
      || (!score.cleared && score.health !== 0)) fail(400, 'This result has impossible wave or health totals.');
  const previous = Rules.spawnTotal(score.startWave, score.completedWaves);
  const maximum = previous + (score.cleared ? 0 : Rules.spawnCount(score.wave));
  const resolved = score.kills + score.leaks;
  if (!int(score.spawned, previous + (score.cleared ? 0 : 1), maximum)
      || !int(score.kills, 0, maximum) || !int(score.leaks, score.cleared ? 0 : 1, maximum)
      || resolved < previous || resolved > score.spawned || (score.cleared && resolved !== score.spawned)
      || !int(score.elapsedMs, 1, RUN_LIFETIME)
      || !int(score.activeMs, Rules.minimumActiveMs(score.startWave, score.completedWaves), RUN_LIFETIME * 10)
      || score.activeMs > score.elapsedMs * 12 + 10000) fail(400, 'This result has impossible run totals or timing.');
  if (submit && (typeof score.initials !== 'string' || !/^[A-Z0-9]{3}$/.test(score.initials))) fail(400, 'Enter exactly 3 letters or numbers.');
}
async function registeredRun(db, score, player) {
  const run = await db.prepare('SELECT * FROM runs WHERE run_id = ?1 AND player = ?2').bind(score.runId, player).first();
  if (!run || run.map !== score.map || run.difficulty !== score.difficulty || run.start_wave !== score.startWave) fail(422, 'This run has no matching online check-in.');
  const age = Date.now() - run.started;
  if (age > RUN_LIFETIME) fail(422, 'This run has expired. Start a new run while connected.');
  const minimumAge = Rules.minimumActiveMs(score.startWave, score.completedWaves) / 10;
  if (age < minimumAge) throw new HttpError(425, 'Your result is saved. The scorekeeper is still verifying this run.', Math.ceil((minimumAge - age) / 1000));
  if (run.submitted_health !== null && (run.submitted_health !== score.health || run.submitted_wave !== score.wave
      || !!run.submitted_cleared !== score.cleared)) fail(422, 'A submitted run cannot be changed.');
  return run;
}
function publicScore(row, player, rank) {
  return {rank, initials: row.initials, difficulty: row.difficulty, wave: row.wave, cleared: !!row.cleared, health: row.health, you: row.player === player};
}
async function board(db, map, player) {
  const {results} = await db.prepare(`SELECT * FROM scores WHERE map = ?1 ORDER BY ${order} LIMIT 50`).bind(map).all();
  const entries = results.map((row, i) => publicScore(row, player, i + 1));
  let personal = entries.find(row => row.you) || null;
  if (!personal && player) {
    const own = await db.prepare('SELECT * FROM scores WHERE map = ?1 AND player = ?2').bind(map, player).first();
    if (own) {
      const {count} = await db.prepare(`SELECT COUNT(*) AS count FROM scores WHERE map = ?1 AND
        ((difficulty, wave, cleared, health) > (?2, ?3, ?4, ?5) OR
        ((difficulty, wave, cleared, health) = (?2, ?3, ?4, ?5) AND (achieved, player) < (?6, ?7)))`)
        .bind(map, own.difficulty, own.wave, own.cleared, own.health, own.achieved, player).first();
      personal = publicScore(own, player, count + 1);
    }
  }
  return {map, limit: LIMIT, entries, personal};
}
async function qualify(db, score, player) {
  const own = await db.prepare('SELECT * FROM scores WHERE map = ?1 AND player = ?2').bind(score.map, player).first();
  if (own?.run_id === score.runId) return {qualifies: false, submitted: true};
  if (own && Rules.compare(own, score) >= 0) {
    return {qualifies: false, reason: 'personal-best'};
  }
  const {count} = await db.prepare(`SELECT COUNT(*) AS count FROM scores WHERE map = ?1 AND player != ?2
    AND (difficulty, wave, cleared, health) >= (?3, ?4, ?5, ?6)`)
    .bind(score.map, player, score.difficulty, score.wave, Number(score.cleared), score.health).first();
  return {qualifies: count < LIMIT, rank: count + 1, reason: count < LIMIT ? null : 'outside-top'};
}
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
    const headers = {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Vary': 'Origin', 'X-Content-Type-Options': 'nosniff'};
    if (origin && allowed.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
    const reply = (data, status = 200) => new Response(JSON.stringify(data), {status, headers});
    try {
      if (origin && !allowed.includes(origin)) fail(403, 'This game origin is not allowed.');
      const url = new URL(request.url);
      if (request.method === 'OPTIONS') {
        return new Response(null, {status: 204, headers: {...headers,
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '86400'}});
      }
      if (url.pathname === '/health' && request.method === 'GET') return reply({ok: true});
      if (url.pathname === '/leaderboard' && request.method === 'GET') {
        const map = Number(url.searchParams.get('map'));
        if (!url.searchParams.has('map') || !int(map, 0, 6)) fail(400, 'Choose a valid map.');
        return reply(await board(env.DB, map, await playerId(request)));
      }
      if (request.method !== 'POST' || !['/runs', '/qualify', '/scores'].includes(url.pathname)) fail(404, 'Not found.');
      const player = await playerId(request, true);
      if (env.WRITE_LIMITER) {
        const {success} = await env.WRITE_LIMITER.limit({key: request.headers.get('CF-Connecting-IP') || player});
        if (!success) { headers['Retry-After'] = '60'; fail(429, 'Too many attempts. Please try again in a minute.'); }
      }
      const score = await readJson(request), submitting = url.pathname === '/scores';
      // Keep the previous full-victory client working during a rolling update.
      if (score && typeof score === 'object') {
        if (score.startWave === undefined) score.startWave = 1;
        if (score.cleared === undefined && score.wave === 100 && score.completedWaves === 100) score.cleared = true;
      }
      if (url.pathname === '/runs') {
        validateRunStart(score);
        await env.DB.batch([
          env.DB.prepare('DELETE FROM runs WHERE started < ?1').bind(Date.now() - RUN_LIFETIME),
          env.DB.prepare('INSERT INTO runs (run_id, player, map, difficulty, started, start_wave) VALUES (?1, ?2, ?3, ?4, ?5, ?6) ON CONFLICT(run_id) DO NOTHING')
            .bind(score.runId, player, score.map, score.difficulty, Date.now(), score.startWave)
        ]);
        const run = await env.DB.prepare('SELECT * FROM runs WHERE run_id = ?1 AND player = ?2').bind(score.runId, player).first();
        if (!run || run.map !== score.map || run.difficulty !== score.difficulty || run.start_wave !== score.startWave) fail(422, 'This run check-in cannot be changed.');
        return reply({registered: true});
      }
      validateScore(score, submitting);
      const run = await registeredRun(env.DB, score, player);
      if (run.submitted_health !== null) return reply(submitting
        ? {submitted: true, ...await board(env.DB, score.map, player)} : {qualifies: false, submitted: true});
      const eligibility = await qualify(env.DB, score, player);
      if (!submitting) return reply(eligibility);
      if (eligibility.submitted) return reply({submitted: true, ...await board(env.DB, score.map, player)});
      if (!eligibility.qualifies) return reply({...eligibility, ...await board(env.DB, score.map, player)}, 409);
      // Recheck the top-50 cutoff AND personal best within a single atomic write.
      // Concurrent arrivals cannot use an outdated qualification to claim a place.
      const writes = await env.DB.batch([
        env.DB.prepare(`UPDATE runs SET submitted_health = ?1, submitted_wave = ?6, submitted_cleared = ?7
          WHERE run_id = ?2 AND player = ?3 AND submitted_health IS NULL
          AND (SELECT COUNT(*) FROM scores WHERE map = ?4 AND player != ?3
            AND (difficulty, wave, cleared, health) >= (?5, ?6, ?7, ?1)) < 50
          AND NOT EXISTS (SELECT 1 FROM scores WHERE map = ?4 AND player = ?3
            AND (difficulty, wave, cleared, health) >= (?5, ?6, ?7, ?1))`)
          .bind(score.health, score.runId, player, score.map, score.difficulty, score.wave, Number(score.cleared)),
        env.DB.prepare(`INSERT INTO scores (player, map, initials, difficulty, health, achieved, run_id, version, wave, cleared)
        SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10
        WHERE EXISTS (SELECT 1 FROM runs WHERE run_id = ?7 AND player = ?1
          AND submitted_health = ?5 AND submitted_wave = ?9 AND submitted_cleared = ?10)
        AND (SELECT COUNT(*) FROM scores WHERE map = ?2 AND player != ?1
          AND (difficulty, wave, cleared, health) >= (?4, ?9, ?10, ?5)) < 50
        ON CONFLICT(player, map) DO UPDATE SET initials = excluded.initials, difficulty = excluded.difficulty,
          health = excluded.health, wave = excluded.wave, cleared = excluded.cleared,
          achieved = excluded.achieved, run_id = excluded.run_id, version = excluded.version
        WHERE scores.run_id != excluded.run_id AND
          (excluded.difficulty, excluded.wave, excluded.cleared, excluded.health) > (scores.difficulty, scores.wave, scores.cleared, scores.health)`)
        .bind(player, score.map, score.initials, score.difficulty, score.health, Date.now(), score.runId, score.version, score.wave, Number(score.cleared))
      ]);
      const result = writes[1];
      if (!result.meta.changes) {
        // A competing request may have sealed this ID after the initial read.
        // Recheck its health before treating an identical-ID retry as accepted.
        await registeredRun(env.DB, score, player);
        const latest = await qualify(env.DB, score, player);
        return reply({...latest, ...await board(env.DB, score.map, player)}, latest.submitted ? 200 : 409);
      }
      return reply({submitted: true, ...await board(env.DB, score.map, player)});
    } catch (error) {
      if (error.retryAfter) headers['Retry-After'] = String(error.retryAfter);
      return reply({error: error instanceof HttpError ? error.message : 'The leaderboard is temporarily unavailable.',
        ...(error.retryAfter ? {retryAfter: error.retryAfter} : {})}, error.status || 503);
    }
  }
};
