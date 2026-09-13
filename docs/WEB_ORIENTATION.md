# Dino Defense browser - start here

The browser game at the repository root and the Roblox project in `roblox/` are
separate maintained products. This is the browser handoff. Roblox starts at
[ORIENTATION.md](ORIENTATION.md). Keep the platform established in the conversation.

## Production baseline

Last verified runtime release: **1.65.2**, September 12, 2026; service-worker cache
**dino-defense-v61**. Published to [Dino Defense](https://vibecodingmatt.github.io/dino-defense/)
from root `main`, commit `38d057f718794b210cbad82b00d853a9085b9ee1`.
[Pages run 34731636528 succeeded](https://github.com/vibecodingmatt/dino-defense/actions/runs/34731636528).
This is a recorded deployment baseline; inspect Git and the live version before
the next release rather than assuming HEAD still equals this commit.

Live verification checked HTTP 200 and committed SHA-256 for 105 pages and
dependencies, all 33 loaded dinosaur skins and polished jaw attachments,
the guest renderer, hidden art menus,
ascending weapon prices, matching number keys and Gas selection, actual kills
with all nine finishers, surface effects and red-ring removal, resumed wave one
with one weapon and zero cash, phone layout and offline loading under cache v61.
It also checked the authored audio bank online/offline, larger Gennaro scale,
and deaths of all 33 species and nine bosses without creature vocalizations.
No browser JavaScript errors were found in those checks. Physical phone GPU
performance and film-quality likeness were not established by headless tests.

The current release includes the rounded jaw polish plus the film-reference
T-Rex, authored audio, guest models/gore, larger Gennaro, nine weapon finishers,
surface effects, price-sorted armory, Sector 7 art and earlier anatomy/resume
repairs. Focused review links below own implementation details and evidence.
The verification report and live captures are in
`C:/Users/burns/dev/dino-perimeter-review/production-1652/`.

## Ownership

No pending browser runtime changes after this release. Unrelated local Roblox
work remains. A later docs/skills-only commit can follow the verified runtime
SHA without changing the game version or cache.
Audio authoring uses the [export instructions](../art/browser-audio/README.md).

| Work | Source |
|---|---|
| Rules, roster, tower stats, seven maps, version and What's New | `js/data.js` |
| Saves/import/export, placement, first wave, combat, homepage actors | `js/game.js` |
| Shared 3D tourists, guest costumes, articulated poses and bounded sprite cache | `js/tourists.js`; look factories in `js/looks.js` |
| Tourist bite sprays, debris, ground stains and independent effect clocks | `js/tourist-fx.js`; scene integration in `js/game.js` |
| Canvas painters and fallback art | `js/draw.js`, `js/drex.js` |
| Sector 7 scene and its distinct resident raptors | `js/perimeter.js`, `js/paddock-raptors.js`, [map notes](../assets/maps/README.md) |
| Other six painted environments and animated set pieces | `js/sanctuary-scenes.js`, `assets/maps/*-sanctuary.webp`, [authoring prompts](../art/browser-maps/prompts.json) |
| Weapon models, upgrade silhouettes, muzzle anchors | `js/arsenal.js` |
| Firing, projectiles and impacts | `js/weapon-fx.js`, integrations in `js/game.js` |
| Skin-bound status effects and nine weapon finishers | `js/dino-fx.js`; attachment sampling/materials in `js/creatures.js` |
| Authored effect sounds, bank, stereo mix and voice budgets | `js/audio-fx.js`; game triggers/mutes in `js/game.js`; `art/browser-audio/export-bank.cjs` |
| Creature palette catalog and rig facade | `js/creature-meshes.js` |
| Authored species landmarks | `js/creature-species.js`; Triceratops/Apatosaurus in `js/creature-anatomy.js` |
| Surface builders, skeletons, poses | `js/creature-anatomy.js` |
| WebGL renderer, atlases, async skins, Canvas fallback hooks | `js/creatures.js` |
| Local art panels | `js/armory-guide.js`, `js/creature-guide.js`, `ART_PREVIEW_ENABLED` in `js/data.js` |
| Asset authoring/export | [Browser mesh pipeline](../art/browser-creatures/README.md) |
| Offline runtime asset list | `SHELL` and `CACHE` in `sw.js` |

There is no app bundler or package-install step. Serve the root over local HTTP
for fetched skins/textures; direct `file:` previews may use fallback geometry.
Run `node scripts/serve-web.cjs` for `http://127.0.0.1:4176/`, or pass another
port. The server binds only to loopback and needs no Python launcher or packages.
Check whether an old preview is still running; tests start their own servers.

## Behaviors to preserve

- **Resume:** `beginFirstWaveCountdown()` runs after both saved-tower restoration
  and placement. At wave zero, existing towers suffice to begin; restored cash
  may be zero. `updateStartPrompt()` checks actual tower presence. Do not fix
  this only by hiding a message or requiring another purchase. Later waves and
  selling the final tower retain their existing behavior. Transfer uses Settings
  save-code export/import; it is not automatic cloud synchronization.
- **Inspection menus:** the allowlist accepts localhost/subdomains, loopback
  addresses and `file:`. Public hosts initialize no art dialogs or handlers.
  `?test=1` still starts the older gameplay smoke-test mode; it never enables
  the weapon/dinosaur art panels. Do not conflate those separate features.
- **Homepage:** eight `MENU_BOSSES`, including Therizinosaurus, share combat skins.
  Theri stays outside feeding cameos. Gulp overlays were removed in both the
  shared homepage painter and Canvas D-Rex; do not restore them from old copies.
- **Creature loading:** call `await Creatures.ready(keys)` before judging an
  exported mesh; check `Creatures.model(key).joinedSkin`. Otherwise a capture
  can accidentally review the procedural fallback. No WebGL retains Canvas art.
- **Drawing:** render functions must not advance simulation, spawn particles or
  spend resources. Inspection renders must not overwrite live atlas snapshots.
- **Jaws:** retain the rounded rear heel and head/jaw blend while keeping teeth
  and the forward mandible rigid. Shared edits require all affected exports.
  Await export completion before browser captures or topology checks.
- **Guest scale:** Gennaro uses `LOO_MAN`, derived `LOO_SEAT` and the same
  `look.size` in seated and caught poses. Check the actual bite on desktop/phone.
- **Audio:** no dinosaur death vocalizations. Retain physical weapon finishers
  and living/entrance roars. Trigger edits live in `game.js`; recipe edits also
  require rebuilding the bank. Unlock must work with Music off; global/per-weapon
  mute, pause and hidden-tab retirement belong to the shared sound facade.
- **Paddock:** its raptors use a separate renderer and patrol system. Combat
  creature changes do not automatically alter those residents. Their scenery
  clock pauses with play but does not accelerate at 10x game speed. Rain streaks
  and repetitive splash rings were removed; preserve the image-failure fallback.
- **Other maps:** six painted plates use small rendering registration tables to
  align their roads with unchanged routes and saves. Keep the complete procedural
  fallback and asynchronous thumbnail refresh. Their set pieces share the slow,
  pausable scenery clock, respect reduced motion and emit no extra sounds.
  Perimeter also disables the random combat snarl/bellow timer; scripted living
  encounters and entrance cues remain.

## Verification by change

Run from the repository root. Browser suites use Chrome and `playwright-core`;
they can resolve the latter from adjacent `war-survival/node_modules`, or accept
`PLAYWRIGHT_MODULE` and `CHROME_PATH`. That adjacent install is a local convenience,
not a runtime game dependency. Only creature topology checks need Node alone.

| Change | Relevant commands |
|---|---|
| Dino geometry, weights, feet | `node tests/creature-skin.cjs`; `node tests/creatures.cjs` |
| Jaw shape, head attachment and bite motion | Also `node tests/creature-jaws.cjs` |
| Sound effects, mutes, output mix, voice/cache limits and offline bank | `node tests/audio-fx.cjs` |
| Pterosaur wings | Also `node tests/creature-wings.cjs` |
| Homepage art, art-panel visibility | `node tests/presentation.cjs`; creature suite for shared rigs |
| Tourists, guest cameos, evacuation, bite effects | `node tests/tourists.cjs`; `node tests/presentation.cjs`; `node tests/resume.cjs` |
| First-wave state, saved towers, cross-device transfers | `node tests/resume.cjs` |
| Weapons/upgrades/projectiles/effects | `node tests/arsenal.cjs`; `node tests/dino-fx.cjs` |
| Perimeter map/resident raptors/placement | `node tests/perimeter.cjs` |
| Other map art, animated scenery, routes, loading and offline | `node tests/sanctuary.cjs`; `node tests/resume.cjs`; `node tests/presentation.cjs` |

Use affected suites for a narrow fix and all applicable suites for a release spanning
these systems. Retain still-applicable passing results from the same source;
repeat when changes or failures justify it. Actual screenshots and motion review
are necessary for art; topology/logic checks cannot establish appearance.
The browser suites start their own temporary local servers. Their public-host
fixtures intercept local files; a `presentation-production-*.png` filename is
not evidence of a live deployment.

For publishing, use [the deployment skill](../skills/deploy-dino-defense/SKILL.md).
Keep a new runtime dependency in `SHELL`, and finish visible fixes with the
[What's New rules](../.claude/skills/whats-new/SKILL.md). Documentation/skill-only
maintenance needs no game version, cache or player-facing changelog bump.

Use `node scripts/audit-web-release.cjs` before staging and append `--staged`
afterward to check the actual index. After the matching Pages run succeeds,
`node scripts/verify-web-release.cjs <full-SHA>` verifies committed live bytes
and browser behavior. It derives the expected version/cache from that commit;
set `WEB_REVIEW_DIR` to save evidence outside the repository. For a verified
docs-only follow-up, `--assets-only` checks live bytes without repeating combat.
For a map release, also run `tests/sanctuary.cjs` with `MAP_REVIEW_URL` set to
the ordinary live base URL and `MAP_REVIEW_DIR` set to its release evidence
folder. It verifies all six painted scenes on production, including offline
loading, layout, scenery clocks and restored placements.

## Focused reviews and evidence

Read only the review relevant to the task: [guests and costumes](WEB_GUEST_REFERENCE_REVIEW.md),
[combat effects](WEB_COMBAT_FX_REVIEW.md), [body/limb/wing repairs](WEB_CREATURE_ANATOMY_REVIEW.md),
[T-Rex and sounds](WEB_TREX_AUDIO_REVIEW.md), or [jaw attachments](WEB_JAW_POLISH_REVIEW.md).
These link the source references, visual comparisons and remaining limitations.
Automated geometry/signal checks do not establish film likeness, listening
quality or physical phone GPU performance.

Historical captures and baseline meshes live outside the repo in
`C:/Users/burns/dev/dino-perimeter-review/`; the jaw comparisons are in
`jaw-polish/`. Older `verify-production-16xx.cjs` scripts are evidence of past
releases, not the next release checklist. Use `scripts/verify-web-release.cjs`.
Its default evidence folder is the system temporary directory under
`dino-defense-web-releases/<SHA>`; override `WEB_REVIEW_DIR` when persistence matters.

The worktree contains unrelated Roblox source, docs, config and skill work.
Preserve it and stage explicit browser paths; branch synchronization does not
imply a clean worktree. Skill sources are in `skills/`; compare before updating
matching `.claude/skills/` and installed Codex discovery copies.
