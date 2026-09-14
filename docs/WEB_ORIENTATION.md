# Dino Defense browser - start here

The browser game at the repository root and the Roblox project in `roblox/` are
separate maintained products. This is the browser handoff. Roblox starts at
[ORIENTATION.md](ORIENTATION.md). Keep the platform established in the conversation.

## Production baseline

Last verified runtime release: **1.72.1**, September 14, 2026; service-worker cache
**dino-defense-v69**. Published to [Dino Defense](https://vibecodingmatt.github.io/dino-defense/)
from root `main`, commit `f6a268a9ca9556767416e53611999bb3fcfce542`.
[Pages run 34902861847 succeeded](https://github.com/vibecodingmatt/dino-defense/actions/runs/34902861847).
This is a recorded deployment baseline; inspect Git and the live version before
the next release rather than assuming HEAD still equals this commit.

Live verification checked HTTP 200 and committed SHA-256 for 85 pages and
dependencies, all 33 loaded dinosaur skins and polished jaw attachments,
the guest renderer, hidden art menus,
ascending weapon prices, matching number keys and Gas selection, actual kills
with all nine finishers, surface effects and red-ring removal, resumed wave one
with one weapon and zero cash, phone layout and offline loading under cache v69.
It also checked the authored audio bank online/offline, larger Gennaro scale,
and deaths of all 33 species and nine bosses without creature vocalizations.
No browser JavaScript errors were found in those checks. Physical phone GPU
performance and film-quality likeness were not established by headless tests.

The 1.72.1 pause screen adds a centered native **Resume game** button, with
mouse, touch, Enter and Space support. Local and production interaction checks
passed desktop, 390/320 px phones and short landscape: centered layout, frozen
simulation, pre-wave and active-wave resume, retained speed, no map click-through,
and cleanup on returning to the menu. The release verifier also exercised the
button after an offline reload. Existing save-transfer/resume checks passed.
Rendered release notes and phone screenshots were reviewed; evidence is under
`C:/Users/burns/dev/dino-perimeter-review/pause1721/` in `local/`, `production/`
and `production-release/`.

The 1.72.0 Brachiosaurus makeover adds a raised nasal dome, short rounded muzzle,
dark eyes/heavy lids, high nostrils, finer facial detail and a lower jaw whose tip
stays level when opened. Focused production checks confirmed its actual
148,710-vertex export, 34 finite jaw/gait poses, the shortened muzzle and corrected
tip, desktop/phone combat, rendered release notes and an offline reload under
cache v68. No browser errors were reported. [Brachiosaurus review](WEB_BRACHIOSAURUS_REVIEW.md)
records the references, export budget and shape regression. Live evidence is in
`C:/Users/burns/dev/dino-perimeter-review/brachio-film/production/` and
`production-scenes/`.

The 1.71.0 Blue makeover adds a fuller curved neck, a muzzle tapered in width
and depth, an uneven lip, amber eyes, curved teeth, articulated fingers and
sickle claws, and mottled silver/olive hide with a pale-edged cobalt stripe.
The production Blue review confirmed the actual 157,110-vertex exported skin,
desktop/phone homepage and combat views, eight bite attachments, rendered
release notes and an offline reload of Blue under cache v67. No browser errors
were reported. [Blue review](WEB_BLUE_REVIEW.md) records the references,
geometry lessons, export budget and visual comparisons. Live evidence is under
`C:/Users/burns/dev/dino-perimeter-review/blue-film/production/` and
`production-scenes/`.

The 1.70.0 D-Rex finale builds to a skin-cracking rupture at 2.85 seconds, throws
real detached anatomy through 148 blood droplets and ends in a smoking crater
at 9.6 seconds. Victory waits for that complete ending, then stages a full-screen
gold medal ceremony with 21 choreographed firework launches and actual run stats.
The production endgame suite passed desktop, 390/320 px phones, short landscape,
reduced motion and Canvas fallback: all nine bosses walk without camera shake,
rewards are granted once, the show uses real time at 10x combat speed, hidden
tabs freeze it, and touch/keyboard dismissal restores results focus. Offline
loading and the full production homepage suite also passed with no browser errors.
[Endgame notes](WEB_ENDGAME_REVIEW.md) document the design and bounded effects.
Evidence is under `C:/Users/burns/dev/dino-perimeter-review/endgame1700/` in
`production/`, `production-endgame/` and `production-home/`.

The 1.69.0 homepage outhouse rebuilds as the next lawyer-scene T-Rex spawns,
before its walk-on, even if the prior wreck's timer has not expired. Production
checks passed three consecutive scheduled repeats on desktop and 390/320 px
phones, with every approach frame hiding Gennaro behind an intact hut before
the door-break reveal and bite. Missile kills now spray 72 larger droplets and
24 flesh fragments, with landed splatter fading through a 2.8-second finisher.
Real projectile/splash kills, surviving-target credit, visible blood at several
beats, pure redraws and complete cleanup passed on desktop, phone and Canvas
fallback. The full live homepage suite also passed. Evidence and live captures
are under `C:/Users/burns/dev/dino-perimeter-review/missile1690/` in
`production/`, `production-scenes/`, `production-home/` and `production-fx/`.

The new homepage has a charcoal/amber design, a compact fence shield brand,
Play/Continue entry, an image-led seven-zone gallery, grouped progression menus,
keyboard-accessible dialogs and a saved/reduced-motion scenery preference.
The dinosaur and guest scenes remain, with a weathered outhouse, recognizable
falling door/roof pieces, detailed fence hardware and contact-anchored discharge.
Portrait phones have a visible scene strip below Play. Social sharing has an original
1200 x 630 T-Rex illustration, static crawler-readable metadata and native/copy
sharing fallbacks. [Homepage notes](WEB_HOME_REVIEW.md) own design, assets,
the generation prompt and the focused test procedure.

The production homepage suite passed seven sizes (320 to 1440 px), keyboard
and touch entry, all seven menus, focus trapping/restoration, difficulty limits,
saved-run cancellation, zero-cash Continue, reduced motion/persisted settings,
native/clipboard failure paths, metadata and image decoding without JavaScript,
and offline UI/icons/dialogs. Social-platform cache refresh and physical-device
GPU performance are not established by these browser checks.

The 1.68.0 production scenery suite passed the actual outhouse and fence beats
on desktop and 390/320 px phones: reveal, seated attachment, bite, breakup and
cleanup, plus climb, warning, discharge and ash landing. It checked pure redraws,
frozen particles when paused, bounded painting caches, Canvas fallback and
offline loading with zero browser errors. Live captures were visually reviewed.
Scenery CPU submission p95 was 0.4 ms on a 1440 x 1000 canvas in that run;
this does not establish physical-device GPU frame rates.

The prior 1.66.0 production map suite verified all six new painted environments,
unchanged land/water routes, real mouse and phone-touch weapon placement, combat,
saved cash and exact tower coordinates, maze routing, pause/10× scenery clocks,
reduced motion, missing/late images, thumbnail refresh and offline rendering.
It also confirmed Perimeter's random ambient growls are disabled with a living
raptor on the field. Desktop scenery CPU submission p95 was 0.2–0.5 ms in that
run; this is not a physical-device GPU frame-rate benchmark.

The current release also retains the rounded jaw polish plus the film-reference
T-Rex, authored audio, guest models/gore, larger Gennaro, nine weapon finishers,
surface effects, price-sorted armory, all seven detailed map environments and
earlier anatomy/resume repairs. The six-map release adds fountains, waterfalls,
an expedition helicopter, estate ambience, the Helios array and a luminous reef,
plus compact phone onboarding. [Map notes](../assets/maps/README.md) own the
scene pipeline and authoring details.
The 1.68.0 verification reports and live captures are in
`C:/Users/burns/dev/dino-perimeter-review/scenery1680/production/`,
`C:/Users/burns/dev/dino-perimeter-review/scenery1680/production-scenes/` and
`C:/Users/burns/dev/dino-perimeter-review/scenery1680/production-home/`.
The 1.67.0 homepage design evidence remains in
`C:/Users/burns/dev/dino-perimeter-review/home1670/production/` and
`C:/Users/burns/dev/dino-perimeter-review/home1670/production-home/`.
The prior map verification evidence remains in
`C:/Users/burns/dev/dino-perimeter-review/maps1660/production/` and
`C:/Users/burns/dev/dino-perimeter-review/maps1660/production-maps/`.

## Ownership

Brachiosaurus shipped in 1.72.0 / cache v68 with a film-puppet-inspired head: a raised
nasal dome, broad fleshy muzzle, dark eyes/heavy lids, high nostrils, small rounded
teeth and a fuller upper neck. Its `brachio93` geometry, pattern 6 palette and
148,710-vertex export are reviewed in [Brachiosaurus notes](WEB_BRACHIOSAURUS_REVIEW.md).
The follow-up shortens the muzzle ahead of the dome and removes the lower-jaw
tip's upward hook; its shape regression checks both delivered and fallback skin.
The production verification is recorded above.

Blue's film-reference sculpt, pattern 5, palette and rebuilt skin shipped in
1.71.0; see [Blue review](WEB_BLUE_REVIEW.md). The first pass cleared six
regression suites; the final neck/muzzle export rechecked skin, jaws, creatures
and tourists before the production verification recorded above.
Unrelated local Roblox work remains.
Audio authoring uses the [export instructions](../art/browser-audio/README.md).

| Work | Source |
|---|---|
| Rules, roster, tower stats, seven maps, version and What's New | `js/data.js` |
| Homepage, shared dialog design, navigation/accessibility and social sharing | `index.html`, `home.css`, `js/home.js`; [homepage notes](WEB_HOME_REVIEW.md) |
| Saves/import/export, placement, first wave, combat, homepage actors | `js/game.js` |
| Homepage fence/outhouse paintings, debris and electrical effects | `js/home-scenery.js`; scene simulation in `js/game.js`; [homepage notes](WEB_HOME_REVIEW.md) |
| Shared 3D tourists, guest costumes, articulated poses and bounded sprite cache | `js/tourists.js`; look factories in `js/looks.js` |
| Wave-one Pteranodon pickup, flight pose and guest attachment | `js/game.js`, `js/creatures.js`, `Tourists.shoulder()`; [Pteranodon review](WEB_PTERANODON_REVIEW.md) |
| Tourist bite sprays, debris, ground stains and independent effect clocks | `js/tourist-fx.js`; scene integration in `js/game.js` |
| Canvas painters and fallback art | `js/draw.js`, `js/drex.js` |
| Sector 7 scene and its distinct resident raptors | `js/perimeter.js`, `js/paddock-raptors.js`, [map notes](../assets/maps/README.md) |
| Other six painted environments and animated set pieces | `js/sanctuary-scenes.js`, `assets/maps/*-sanctuary.webp`, [authoring prompts](../art/browser-maps/prompts.json) |
| Weapon models, upgrade silhouettes, muzzle anchors | `js/arsenal.js` |
| Firing, projectiles and impacts | `js/weapon-fx.js`, integrations in `js/game.js` |
| Skin-bound status effects and nine weapon finishers | `js/dino-fx.js`; attachment sampling/materials in `js/creatures.js` |
| D-Rex rupture and full-screen victory ceremony | `js/endgame-fx.js`; transitions/rewards in `js/game.js`; [endgame notes](WEB_ENDGAME_REVIEW.md) |
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

- **Pause controls:** the centered `#pausePrompt` uses a native resume button
  above the map; it shares `togglePause()` with the HUD. `updateHUD()` controls
  visibility and restores focus when it hides, while menu/victory transitions
  clear it immediately. Keep touch clicks off the underlying placement canvas,
  retain game speed and keep the original HUD/speed resume controls working.
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
  Play becomes Continue for a saved run; all zone cards remain native buttons.
  `homeMotion` follows reduced motion by default; `menuScenePaused` freezes only
  the home scene clock. `js/home.js` owns modal focus/inert state and sharing.
  `js/home-scenery.js` caches decorative paintings and never advances actors or
  consumes simulation randomness. Preserve the shared outhouse seat anchors,
  contact position for fence arcs, paused smoke and portrait scene framing.
- **Creature loading:** call `await Creatures.ready(keys)` before judging an
  exported mesh; check `Creatures.model(key).joinedSkin`. Otherwise a capture
  can accidentally review the procedural fallback. No WebGL retains Canvas art.
- **Drawing:** render functions must not advance simulation, spawn particles or
  spend resources. Inspection renders must not overwrite live atlas snapshots.
- **Wave-one carrier:** use the shared Pteranodon export and its posed foot
  sockets with the guest sprite's shoulder anchor. The cameo changes no match
  accounting. Keep its pure bounded tile draw, pause behavior, procedural/Canvas
  fallbacks and retained closed leg/toe skin; see the Pteranodon review above.
- **Endgame:** the final corpse holds victory through its full duration. The
  ceremony uses a separate real-time clock, pauses in hidden tabs and grants no
  extra rewards on redraw or dismissal. Keep keyboard/touch results access,
  reduced motion, phone/landscape framing and new-run cleanup. Boss entrances,
  footfalls and deaths no longer shake the camera.
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
| Wave-one Pteranodon pickup and guest attachment | Also `node tests/snatcher.cjs`; `SNATCH_REVIEW_URL` and `SNATCH_REVIEW_DIR` select live verification/evidence |
| Homepage art, art-panel visibility | `node tests/presentation.cjs`; creature suite for shared rigs |
| Homepage UI, dialogs, sharing, Play/Continue and social metadata | `node tests/homepage.cjs`; `node tests/presentation.cjs`; `node tests/resume.cjs` |
| Homepage fence/outhouse art, breakup, electrical effects and phone framing | `node tests/home-scenery.cjs`; `node tests/homepage.cjs`; `node tests/presentation.cjs`; `node tests/tourists.cjs` |
| Tourists, guest cameos, evacuation, bite effects | `node tests/tourists.cjs`; `node tests/presentation.cjs`; `node tests/resume.cjs` |
| First-wave state, saved towers, cross-device transfers | `node tests/resume.cjs` |
| Weapons/upgrades/projectiles/effects | `node tests/arsenal.cjs`; `node tests/dino-fx.cjs` |
| Missile kill blood, splash credit, persistence and cleanup | Also `node tests/missile-gore.cjs`; `FX_REVIEW_URL` and `FX_REVIEW_DIR` select live verification/evidence |
| D-Rex finale, boss camera and wave-100 victory | `node tests/endgame.cjs`; creature/audio suites for shared painters or sound triggers; `ENDGAME_REVIEW_URL` and `ENDGAME_REVIEW_DIR` select live verification/evidence |
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
For homepage releases, also run `tests/homepage.cjs` with `HOME_REVIEW_URL` set
to the ordinary live URL and `HOME_REVIEW_DIR` set to an external evidence folder.
For homepage scenery releases, also run `tests/home-scenery.cjs` with
`SCENERY_REVIEW_URL` set to that URL and `SCENERY_REVIEW_DIR` set externally.
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
[T-Rex and sounds](WEB_TREX_AUDIO_REVIEW.md), [Blue's sculpt](WEB_BLUE_REVIEW.md),
or [jaw attachments](WEB_JAW_POLISH_REVIEW.md).
The [endgame review](WEB_ENDGAME_REVIEW.md) owns the D-Rex rupture and victory
ceremony timelines, particle limits, dismissal and visual evidence.
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
