---
name: deploy-dino-defense
description: Publish and verify the Dino Defense browser game on vibecodingmatt/dino-defense GitHub Pages when the user requests a production release. Covers staged browser assets, release checks and live verification; Roblox publishing is separate.
---

# Deploy Dino Defense

Work from `C:/Users/burns/dev/games-playground/dino-defense` or its current checkout.
Read `AGENTS.md` and `docs/WEB_ORIENTATION.md` for the platform and last verified
release. This workflow carries out the user's deployment scope; existing session
authorization applies. A documentation update alone does not request a game release.

## Production

- Remote: `https://github.com/vibecodingmatt/dino-defense.git`
- Source: `main`, repository root; no build step.
- Site: `https://vibecodingmatt.github.io/dino-defense/`
- Workflow: GitHub-generated `pages build and deployment`.
- Public paths are case-sensitive. Confirm current Pages settings with
  `gh api repos/vibecodingmatt/dino-defense/pages` if setup is in question.

## Prepare the intended release

1. Inspect `git status --short --branch`, remotes and diffs. Fetch `origin main`
   and check `git rev-list --left-right --count HEAD...origin/main`. Do not
   force-push, reset or overwrite unrelated work. Stop for unexpected divergence
   or conflicts. The worktree may contain substantial unrelated Roblox work.
2. Determine all pending browser dependencies, not only the last edited file.
   A first art release needs the source modules AND actual `.mesh.gz`, JSON and
   texture/map assets. `index.html` script ordering and `sw.js` `SHELL` must agree.
   Browser skins ship as real gzip bytes, not Git LFS pointer files. Keep scratch
   build streams and external review captures out of runtime paths.
3. Use the affected test matrix in `docs/WEB_ORIENTATION.md`. Reuse
   still-applicable passing checks from this session; rerun after relevant edits
   or failures. For scanner changes also check `js/dltest.js` syntax and its real
   parser/scanner flow. Do not run Roblox suites for a browser-only release.
4. For runtime changes, check `VERSION`, the daily `CHANGELOG` and `CACHE` using
   `.claude/skills/whats-new/SKILL.md`. Audit the whole changelog, referenced files
   and rendered modal. An already prepared release needs no extra version bump
   merely because it is now being pushed. Docs/skills-only edits need no runtime
   version/cache/changelog changes.
   `node scripts/audit-web-release.cjs` checks daily notes, shell files and
   script inclusion. Its review prompts need judgment, especially historical
   entries with more than eight distinct enhancements.
5. Stage explicit intended paths; use partial hunks for mixed browser/Roblox
   edits in files such as README or `.gitignore`. Inspect
   `git diff --cached --stat`, `git diff --cached --check` and the staged content.
   Confirm every new runtime dependency is actually staged/tracked: local tests
   can pass while reading an untracked asset that production will never receive.
   Run `node scripts/audit-web-release.cjs --staged` to audit the index itself.

## Publish and verify

Commit with an outcome-based message and push `origin main`. Record the full SHA.
Monitor the Pages run whose `headSha` matches it; a successful push or an older
green workflow is insufficient. `gh run list --json databaseId,headSha,status,conclusion,url`
and `gh run view <id>` provide the needed evidence. Wait for a terminal success.

Verify the deployed release over HTTPS, using the ordinary base URL first.
`?test=1` is an existing gameplay smoke-test shortcut and skips the ordinary
homepage; use it only when deliberately testing that behavior.

Run `node scripts/verify-web-release.cjs <full-SHA>` after the matching Pages
run succeeds. The reusable check derives version, cache, roster and shop order
from that commit. It checks exact live asset hashes, loaded jaw skins, audio,
finishers, no death vocals, resume, mobile and offline behavior in disposable
browser storage. Use the same `CHROME_PATH`/`PLAYWRIGHT_MODULE` overrides as the
tests; `WEB_REVIEW_DIR` chooses an external evidence folder (default: the system
temporary directory under `dino-defense-web-releases/<SHA>`). Extend relevant
behavior checks when the game's contracts change; do not copy a historical
version-specific external script into the next release.

- Request changed public pages, scripts, styles, textures, all rebuilt skins and
  critical `SHELL` dependencies. Check HTTP 200 and expected content. Compare
  binary bytes/SHA-256, and preferably text too, against `git show <sha>:<path>`;
  working-tree CRLF can differ from the committed bytes served by Pages.
- For WebAssembly verify `application/wasm`, length and SHA-256. For scanner work
  check `ZXing-C++ ready` and the parser self-test, using fabricated AAMVA data.
- In a fresh browser context, confirm the expected version and actual loaded
  `joinedSkin` assets. Public art buttons must remain hidden, with no inspection
  dialogs/handlers, including when `?test=1` or preview-like flags are present.
- For the relevant gameplay changes, exercise real interactions on the live
  page. A resume repair needs an existing weapon, zero/insufficient cash and a
  wave that actually starts. Use isolated test browser storage, not the owner's
  personal saved game.
- Confirm the new service worker activates and a real offline reload uses its
  cache. Check mobile layout and record browser errors. Asset HTTP success alone
  does not prove decompression/rendering or service-worker installation succeeds.

Report the live URL, commit, successful Pages run and observed verification.
Confirm `main` matches `origin/main`; distinguish that from a clean worktree.
Keep unrelated local files intact. Update the browser orientation's deployed
baseline after verified success; historical version-specific external scripts
must not silently become the next release's checklist.

For a docs/skills-only follow-up commit, retain the verified runtime release
SHA in orientation. Verify that runtime files did not change, the new matching
Pages run succeeded, and `verify-web-release.cjs <SHA> --assets-only` passes.
Reuse still-applicable browser results; documentation alone needs no extra
version bump or full combat test cycle.

Never publish real driver-license data, unrelated local files or unverified
intermediate assets. If deployment fails, diagnose that run and the live state
before proposing another production mutation; do not claim the release is live.
