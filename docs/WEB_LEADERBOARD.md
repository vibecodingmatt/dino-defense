# Worldwide arcade leaderboard

## Player rules

- One worldwide top 50 per zone (all seven maps).
- Complete all 100 waves. Highest completed difficulty ranks first, then the
  rounded integer percentage of base health shown on the victory screen.
- Exact ties keep the earlier accepted score ahead. Simultaneous timestamps
  use the private player digest as a deterministic final sort key.
- One best accepted score per browser identity per map. Equal/worse repeat
  runs do not replace that score. Different players may use the same initials.
- Qualifiers enter exactly three ASCII letters/digits, displayed uppercase.
  The prompt follows the victory ceremony. Submission is optional and the form
  states that the name and score will be public.
- Pending personal-best results survive connection failures/reloads. Select
  their zone on the homepage leaderboard and use **Post saved result**.
- Ranked runs need a successful online check-in at the start and must be posted
  within 90 days. Registered runs can resume and finish offline, then post later.
  Old saves without this wave history still play, but cannot enter a new score.
- Identity/pending results use separate localStorage. Clearing browser storage
  loses that identity; game save-code transfer does not transfer leaderboard
  identity. A run-start check-in is the only gameplay network request; rankings
  are fetched when opening the board or claiming a completed result.
- Developer-cheat and tampered-save runs do not qualify. Cheat history and run
  IDs persist through new saves/resumes. Historical map records are not imported.

## Service and ownership

- API: `https://dino-defense-leaderboard.vibecodingmatt.workers.dev`
- Worker: `dino-defense-leaderboard`, configured in `leaderboard/wrangler.jsonc`.
- Deployed Worker version: `b185be8f-3e0a-450a-b4a2-20860a45f352` (September 14, 2026).
- D1 database: `dino-defense-leaderboard`, ID
  `df451046-ca8b-40f9-890f-3c4f0d990d35` (ENAM).
- Account: `5448a82a740c95f92d6f39fff40a9031`. These IDs are not credentials.
- Schema: `leaderboard/migrations/0001_scores.sql` and `0002_runs.sql`.
- Browser UI/network/pending state: `js/leaderboards.js`, `leaderboards.css`.
- Lifecycle hooks: run starts/saves, wave starts/ends, simulation steps, spawns,
  kills/leaks and victory in `js/game.js`. Shared modal accessibility remains
  in `js/home.js`.

`GET /leaderboard?map=0` returns public scores, plus the caller's own score/rank
when authenticated. `POST /runs` registers an ID with server time, player, map
and difficulty; retries never reset its clock. `POST /qualify` checks a completed
candidate; `POST /scores` also requires initials. Writes use an anonymous 256-bit bearer token generated
in the browser. Only its SHA-256 digest is stored; neither digest nor token is
included in public responses. Admin/OAuth credentials never ship to browsers.

All writes use bound SQL parameters, bounded request bodies, strict numeric/name
validation, and a Workers rate-limit binding (20 write requests/minute per IP
per Cloudflare location). The best-score update and top-50 cutoff check are
atomic. Retrying an accepted run is idempotent. CORS allows the production Pages
origin; local tests inject a disposable service rather than widening production
origins. Responses use `no-store`; the game service worker ignores this origin.

## Basic plausibility checks

- The server requires 100 completed waves, exactly 4,074 spawns, nonnegative
  integer kills/leaks whose sum equals spawns, and the existing map, difficulty
  (1–1,000), health (0–100%) and three-character name bounds.
- The current generator creates 4,061 ordinary dinos plus 13 bosses on every
  map. The shortest possible ordinary spawn gaps alone take 1,143.3852 simulation
  seconds, or 114.34 real seconds at the supported maximum 10x speed.
- Conservative server floors are 1,100,000 simulated milliseconds and 90,000
  elapsed milliseconds. Simulated time cannot exceed reported elapsed time
  times ten (plus 1 second rounding slack). Reported elapsed time cannot exceed
  server age plus 30 seconds of startup/network slack. Server age itself must
  meet the 90-second floor, so an instant POST cannot invent an earlier start.
- Run IDs belong to one identity, map and difficulty. Accepted health is sealed
  atomically with the score write, including concurrent submissions. The same
  ID cannot improve a prior result. Check-ins expire after 90 days; expired
  records are pruned on new check-ins. Accepted leaderboard records remain.
- The client tracks sequential wave completion and actual spawns/kills/leaks
  independently of the public HUD counters. It rejects changed map/difficulty,
  unsupported speed, oversized simulation steps, health restoration, changed
  maximum health, cheat settings and edited saves. Mid-wave resumes roll back
  counters to the last completed wave while preserving disqualification and
  elapsed time. Maximum health is recaptured on resume because purchased base
  upgrades can legitimately change it between sessions.
- Permanent validation failures do not leave an endlessly retryable pending
  result. Network failures retain eligible pending results as before.

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
full 100-wave accounting and resumed completion, ranking/ties, concurrent last-place claims,
idempotency, personal ranks, rate limits, initials, keyboard/touch, seven maps,
late responses, disqualification, reloads, failures and actual offline loading.

`node scripts/verify-leaderboard-service.cjs` uses the live API with local
frontend bytes under the Pages origin; `--live` uses the published frontend.
Set `WRANGLER_CLI` to Wrangler's `bin/wrangler.js`. This check writes one
disposable player's score, confirms public readback, and removes only that
player's score and check-ins in `finally`. It first verifies rejection of an
instant forged score, then runs the full wave accounting and waits for real
server time to catch up before submitting. Allow several minutes; it never
changes production timestamps or relaxes the guards. It must run under Node 22+ with working Wrangler
authentication. Review its cleanup message if interrupted.

Local/service/production captures and reports live outside the runtime tree at
`C:/Users/burns/dev/dino-perimeter-review/leaderboard/`.
