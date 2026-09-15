// Public, casual leaderboard. Client reports are not proof of an authentic run.
// Anonymous bearer credentials are hashed at rest and never appear in rankings.
const LIMIT = 50;
const order = 'difficulty DESC, health DESC, achieved ASC, player ASC';
const ahead = `(difficulty > ?2 OR (difficulty = ?2 AND health > ?3)
  OR (difficulty = ?2 AND health = ?3 AND (achieved < ?4 OR (achieved = ?4 AND player < ?5))))`;
const int = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
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
function validateScore(score, submit) {
  if (!score || !int(score.map, 0, 6) || !int(score.difficulty, 1, 1000)
      || !int(score.health, 0, 100) || score.wave !== 100
      || typeof score.runId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(score.runId)
      || typeof score.version !== 'string' || !/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(score.version)
      || score.cheated !== false) fail(400, 'A completed, eligible run is required.');
  if (submit && (typeof score.initials !== 'string' || !/^[A-Z0-9]{3}$/.test(score.initials))) fail(400, 'Enter exactly 3 letters or numbers.');
}
function publicScore(row, player, rank) {
  return {rank, initials: row.initials, difficulty: row.difficulty, health: row.health, you: row.player === player};
}
async function board(db, map, player) {
  const {results} = await db.prepare(`SELECT * FROM scores WHERE map = ?1 ORDER BY ${order} LIMIT 50`).bind(map).all();
  const entries = results.map((row, i) => publicScore(row, player, i + 1));
  let personal = entries.find(row => row.you) || null;
  if (!personal && player) {
    const own = await db.prepare('SELECT * FROM scores WHERE map = ?1 AND player = ?2').bind(map, player).first();
    if (own) {
      const {count} = await db.prepare(`SELECT COUNT(*) AS count FROM scores WHERE map = ?1 AND ${ahead}`)
        .bind(map, own.difficulty, own.health, own.achieved, player).first();
      personal = publicScore(own, player, count + 1);
    }
  }
  return {map, limit: LIMIT, entries, personal};
}
async function qualify(db, score, player) {
  const own = await db.prepare('SELECT * FROM scores WHERE map = ?1 AND player = ?2').bind(score.map, player).first();
  if (own?.run_id === score.runId) return {qualifies: false, submitted: true};
  if (own && (own.difficulty > score.difficulty || (own.difficulty === score.difficulty && own.health >= score.health))) {
    return {qualifies: false, reason: 'personal-best'};
  }
  const {count} = await db.prepare(`SELECT COUNT(*) AS count FROM scores WHERE map = ?1 AND player != ?2
    AND (difficulty > ?3 OR (difficulty = ?3 AND health >= ?4))`)
    .bind(score.map, player, score.difficulty, score.health).first();
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
      if (request.method !== 'POST' || !['/qualify', '/scores'].includes(url.pathname)) fail(404, 'Not found.');
      const player = await playerId(request, true);
      if (env.WRITE_LIMITER) {
        const {success} = await env.WRITE_LIMITER.limit({key: request.headers.get('CF-Connecting-IP') || player});
        if (!success) { headers['Retry-After'] = '60'; fail(429, 'Too many attempts. Please try again in a minute.'); }
      }
      const score = await readJson(request), submitting = url.pathname === '/scores';
      validateScore(score, submitting);
      const eligibility = await qualify(env.DB, score, player);
      if (!submitting) return reply(eligibility);
      if (eligibility.submitted) return reply({submitted: true, ...await board(env.DB, score.map, player)});
      if (!eligibility.qualifies) return reply({...eligibility, ...await board(env.DB, score.map, player)}, 409);
      // Recheck the top-50 cutoff AND personal best within a single atomic write.
      // Concurrent arrivals cannot use an outdated qualification to claim a place.
      const result = await env.DB.prepare(`INSERT INTO scores (player, map, initials, difficulty, health, achieved, run_id, version)
        SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8
        WHERE (SELECT COUNT(*) FROM scores WHERE map = ?2 AND player != ?1
          AND (difficulty > ?4 OR (difficulty = ?4 AND health >= ?5))) < 50
        ON CONFLICT(player, map) DO UPDATE SET initials = excluded.initials, difficulty = excluded.difficulty,
          health = excluded.health, achieved = excluded.achieved, run_id = excluded.run_id, version = excluded.version
        WHERE scores.run_id != excluded.run_id AND (excluded.difficulty > scores.difficulty
          OR (excluded.difficulty = scores.difficulty AND excluded.health > scores.health))`)
        .bind(player, score.map, score.initials, score.difficulty, score.health, Date.now(), score.runId, score.version).run();
      if (!result.meta.changes) {
        const latest = await qualify(env.DB, score, player);
        return reply({...latest, ...await board(env.DB, score.map, player)}, latest.submitted ? 200 : 409);
      }
      return reply({submitted: true, ...await board(env.DB, score.map, player)});
    } catch (error) {
      return reply({error: error instanceof HttpError ? error.message : 'The leaderboard is temporarily unavailable.'}, error.status || 503);
    }
  }
};
