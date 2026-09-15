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
- Identity/pending results use separate localStorage. Clearing browser storage
  loses that identity; game save-code transfer does not transfer leaderboard
  identity. Rankings are not fetched in the background during gameplay.
- Developer-cheat and tampered-save runs do not qualify. Cheat history and run
  IDs persist through new saves/resumes. Historical map records are not imported.

## Service and ownership

- API: `https://dino-defense-leaderboard.vibecodingmatt.workers.dev`
- Worker: `dino-defense-leaderboard`, configured in `leaderboard/wrangler.jsonc`.
- Verified Worker version: `3cce3b58-050e-4ff6-8d87-ea84bc65beee` (September 14, 2026).
- D1 database: `dino-defense-leaderboard`, ID
  `df451046-ca8b-40f9-890f-3c4f0d990d35` (ENAM).
- Account: `5448a82a740c95f92d6f39fff40a9031`. These IDs are not credentials.
- Schema: `leaderboard/migrations/0001_scores.sql`.
- Browser UI/network/pending state: `js/leaderboards.js`, `leaderboards.css`.
- Lifecycle hooks: `startLevel`, `saveRun`, `victory`, `finishVictory`, `toMenu`
  in `js/game.js`. Shared modal accessibility remains in `js/home.js`.

`GET /leaderboard?map=0` returns public scores, plus the caller's own score/rank
when authenticated. `POST /qualify` checks a completed candidate; `POST /scores`
also requires initials. Both use an anonymous 256-bit bearer token generated
in the browser. Only its SHA-256 digest is stored; neither digest nor token is
included in public responses. Admin/OAuth credentials never ship to browsers.

All writes use bound SQL parameters, bounded request bodies, strict numeric/name
validation, and a Workers rate-limit binding (20 write requests/minute per IP
per Cloudflare location). The best-score update and top-50 cutoff check are
atomic. Retrying an accepted run is idempotent. CORS allows the production Pages
origin; local tests inject a disposable service rather than widening production
origins. Responses use `no-store`; the game service worker ignores this origin.

This is a casual community board: browser-reported results are forgeable.
The client cheat flag, run ID and origin restriction do not prove fair play.
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
The suite covers validation, ranking/ties, concurrent last-place claims,
idempotency, personal ranks, rate limits, initials, keyboard/touch, seven maps,
late responses, disqualification, reloads, failures and actual offline loading.

`node scripts/verify-leaderboard-service.cjs` uses the live API with local
frontend bytes under the Pages origin; `--live` uses the published frontend.
Set `WRANGLER_CLI` to Wrangler's `bin/wrangler.js`. This check writes one
disposable player's score, confirms public readback, and removes only that
player's row in `finally`. It must run under Node 22+ with working Wrangler
authentication. Review its cleanup message if interrupted.

Local/service/production captures and reports live outside the runtime tree at
`C:/Users/burns/dev/dino-perimeter-review/leaderboard/`.
