# Worldwide arcade leaderboard

## Player rules

- One worldwide top 50 per zone (all seven maps).
- Victories and defeats both qualify. Rank by difficulty, wave reached, a
  completed zone ahead of a defeat during wave 100, then rounded base health.
  Dying during wave 50 records **wave 50 reached**, with 49 completed waves.
- Exact ties keep the earlier accepted score ahead. Simultaneous timestamps
  use the private player digest as a deterministic final sort key.
- One best accepted score per browser identity per map. Equal/worse repeat
  runs do not replace that score. Different players may use the same initials.
- Qualifiers enter exactly three ASCII letters/digits, displayed uppercase.
  The initials prompt follows the victory ceremony or appears over the defeat
  screen. If another dialog is open, it waits for that dialog to close.
  Submission is optional; the form states that initials and scores are public.
- Pending personal-best results survive connection failures/reloads. Select
  their zone on the homepage leaderboard and use **Post saved result**.
- Check-ins start in the background and retry after a failed connection. A
  missed acknowledgement does not discard the result. The result screen also
  retries registration/qualification and explains any exclusion.
- Older saves can rank after resuming: a new observed segment starts at their
  next wave. Earlier kills/time are not invented. Valid newer ledgers retain
  their existing segment across resumes. Rejected v1.75.1 ledgers restart
  observation because that version could reject harmless zero-time frames;
  the separate developer-cheat/tampered-save exclusions still apply.
- Post within 90 days of registration. Eligible pending results survive offline
  finishes; the initials prompt needs a connection. A very late check-in may
  briefly show verification in progress, then automatically retry.
- Identity/pending results use separate localStorage. Clearing browser storage
  loses that identity; game save-code transfer does not transfer leaderboard
  identity. During play, failed check-ins retry at wave boundaries at most once
  every 30 seconds, or when connectivity returns. Rankings are fetched when
  opening the board or claiming a result.
- Developer-cheat and tampered-save runs do not qualify. Cheat history and run
  IDs persist through new saves/resumes. Historical map records are not imported.

## Service and ownership

- API: `https://dino-defense-leaderboard.vibecodingmatt.workers.dev`
- Worker: `dino-defense-leaderboard`, configured in `leaderboard/wrangler.jsonc`.
- Current verified runtime/Worker release: see [WEB_ORIENTATION.md](WEB_ORIENTATION.md).
- D1 database: `dino-defense-leaderboard`, ID
  `df451046-ca8b-40f9-890f-3c4f0d990d35` (ENAM).
- Account: `5448a82a740c95f92d6f39fff40a9031`. These IDs are not credentials.
- Schema: `leaderboard/migrations/0001_scores.sql` through `0003_partial_runs.sql`.
  Existing accepted records migrate to wave 100, cleared, without changing rank.
- Shared ranking/spawn/timing policy: `js/leaderboard-rules.js`, imported by the
  Worker and loaded before `js/leaderboards.js` in the browser and offline shell.
- Browser UI/network/pending state: `js/leaderboards.js`, `leaderboards.css`.
- Lifecycle hooks: run starts/saves, wave starts/ends, simulation steps, spawns,
  kills/leaks, victory and defeat in `js/game.js`. Shared modal accessibility remains
  in `js/home.js`.

`GET /leaderboard?map=0` returns public scores, plus the caller's own score/rank
when authenticated. `POST /runs` registers an ID with server time, player, map
and difficulty, plus `startWave` (first wave observed in this segment); retries
never reset its clock. `POST /qualify` checks a finished candidate; `POST /scores`
also requires initials. Scores include `wave`, `cleared`, `completedWaves`, and
segment spawn/kill/leak/active-time/elapsed-time totals. Public rows expose wave
and cleared status alongside difficulty and health. Writes use a 256-bit bearer token generated
in the browser. Only its SHA-256 digest is stored; neither digest nor token is
included in public responses. Admin/OAuth credentials never ship to browsers.

All writes use bound SQL parameters, bounded request bodies, strict numeric/name
validation, and a Workers rate-limit binding (20 write requests/minute per IP
per Cloudflare location). The best-score update and top-50 cutoff check are
atomic. Retrying an accepted run is idempotent. CORS allows the production Pages
origin; local tests inject a disposable service rather than widening production
origins. Responses use `no-store`; the game service worker ignores this origin.

## Basic plausibility checks

- The server validates wave 1–100, difficulty 1–1,000, health 0–100%, strict
  three-character initials and the registered segment. Defeats require zero
  health and at least one leak; their current wave can still have unspawned or
  surviving dinosaurs. Completed earlier waves must account for every spawn.
  Victories require wave 100 completed and every observed spawn resolved.
- The current generator creates 4,061 ordinary dinos plus 13 bosses on every
  map. The shortest possible ordinary spawn gaps alone take 1,143.3852 simulation
  seconds, or 114.34 real seconds at the supported maximum 10x speed.
- The floor is half the shortest ordinary spawn schedule for completed waves
  observed in this segment: about 571.69 simulated seconds / 57.17 real seconds
  for a full run. It assumes instant kills, the shortest gaps and 10x speed;
  no combat, travel, setup, boss or between-wave time is added. Powerful weapons
  are not grounds for rejection. Active time allows 20% scheduler tolerance over
  10x plus 10 seconds. Zero-duration animation frames are harmless.
- A check-in younger than the conservative floor returns retryable HTTP 425
  and `retryAfter`; it does not erase the score. Offline time/long pauses do not
  have to match server age. Result checks automatically retry, but posting
  initials always requires the player's explicit submission.
- Run IDs belong to one identity, map, difficulty and starting wave. Accepted
  health, wave and cleared status are sealed atomically, including concurrent
  submissions. The same
  ID cannot improve a prior result. Check-ins expire after 90 days; expired
  records are pruned on new check-ins. Accepted leaderboard records remain.
- The client tracks sequential wave completion and actual spawns/kills/leaks
  independently of the public HUD counters. It rejects changed map/difficulty,
  unsupported speed, oversized simulation steps, health restoration, changed
  maximum health, cheat settings and edited saves. Mid-wave resumes roll back
  counters to the last completed wave while preserving disqualification and
  elapsed time. Maximum health is recaptured on resume because purchased base
  upgrades can legitimately change it between sessions.
- Permanent validation failures explain the exclusion and remove that invalid
  pending result. Network failures retain results, and deferred prompts cannot
  appear over a new run or after returning to the homepage.

This is a casual community board: browser-reported results are forgeable.
These thresholds stop obvious injections; a patient, modified client can still
fabricate plausible telemetry after waiting. They do not prove fair play.
Server-authoritative simulation/replay validation is outside this first version.
Scores displaced from the top 50 remain stored for their personal rank.

## Development and release

Use Node 22+ and Wrangler 4.107.0 or newer. The compatibility date is pinned to
2026-07-08 to match the verified local Workers runtime. Wrangler OAuth needs
`account:read`, `user:read`, `workers_scripts:write`, and `d1:write`; unrelated
missing-scope notices do not require granting additional services.

From `leaderboard/`, apply reviewed migrations with
`wrangler d1 migrations apply dino-defense-leaderboard --remote`, then deploy
with `wrangler deploy`. The Worker uses the free Workers/D1 service tiers. Limits
can temporarily make rankings unavailable; the game continues to work.

Tests from the repo root:

```powershell
# MINIFLARE_MODULE can point at the miniflare package in a Wrangler installation.
node tests/leaderboards.cjs
node tests/homepage.cjs
node tests/resume.cjs
node tests/endgame.cjs
node scripts/audit-web-release.cjs
```

`LEADERBOARD_REVIEW_URL` selects a published frontend; API calls still route to
an isolated Miniflare database. `LEADERBOARD_REVIEW_DIR` selects evidence output.
The suite covers validation, server timing, replay edits, concurrent result edits,
full 100-wave accounting, real upgraded weapon combat at 10x, wave-50 defeats,
legacy/resumed completion, check-in failures, retryable timing and deferred
prompts after the Lab closes, ranking/ties, concurrent last-place claims,
idempotency, personal ranks, rate limits, initials, keyboard/touch, seven maps,
late responses, disqualification, reloads, failures and actual offline loading.

`node scripts/verify-leaderboard-service.cjs` uses the live API with local
frontend bytes under the Pages origin; `--live` uses the published frontend.
Set `WRANGLER_CLI` to Wrangler's `bin/wrangler.js`. This check writes one
disposable player's score, confirms public readback, and removes only that
player's score and check-ins in `finally`. It first verifies rejection of an
instant forged score, then runs full wave accounting and waits for the real
server timing floor before submitting. It also submits a wave-50 defeat and
checks automatic verification retry. Allow about two minutes; it never changes
production timestamps or relaxes the guards. It must run under Node 22+ with working Wrangler
authentication. Review its cleanup message if interrupted.

Local/service/production captures and reports live outside the runtime tree at
`C:/Users/burns/dev/dino-perimeter-review/leaderboard/`.
