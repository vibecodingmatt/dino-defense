# Dino Defense browser - start here

The browser game at the repository root and the Roblox project in `roblox/` are
separate maintained products. This is the browser handoff. Roblox starts at
[ORIENTATION.md](ORIENTATION.md). Keep the platform established in the conversation.

## Production baseline

Last verified runtime release: **1.77.2**, September 19, 2026; service-worker cache
**dino-defense-v78**. Published to [Dino Defense](https://vibecodingmatt.github.io/dino-defense/)
from root `main`, commit `a293a828da2d5f3eb5c884ddac02ec9c902ead99`.
[Pages run 35478494515 succeeded](https://github.com/vibecodingmatt/dino-defense/actions/runs/35478494515).
This is a recorded deployment baseline; inspect Git and the live version before
the next release rather than assuming HEAD still equals this commit.

The autoplay correction removes the newly introduced upgrade, boss and chapter
preparation stops. Every cleared wave uses the normal three-second countdown;
manual pause and the existing Auto-start waves preference still work. The
obsolete chapter-break setting is gone, and old saved values cannot restore it.
Local experience and saved-run suites passed. Live verification checked all 92
committed assets, five desktop/mobile layouts, real countdown-to-wave starts,
manual pause, opening/boss/chapter boundaries, saves and offline cache v78,
with zero browser errors. Evidence is under
`C:/Users/burns/dev/dino-perimeter-review/autoplay1772/` in `production-release/`
and `production-experience/`.

The landscape follow-up gives phones and coarse-pointer tablets a 96 px weapon
rail, compact HUD, a map that fills the stage, Overview, and a separate side
upgrade dock. Panning accounts for horizontal and vertical cropping; rotation
keeps the selected tower visible. At 844 × 390 this gives about 47% more visible
map area. Portrait keeps its bottom dock. Cancelled weapon holds cannot click
through onto the homepage after a scene change.

The landscape, experience, weapon-info, homepage, Extinction and endgame suites
passed locally. Production checked exact committed hashes for 92 assets and
the full release verifier, plus real touch gestures/placement, side upgrades,
support access, orientation changes and offline use at six emulated landscape
sizes from 568 × 320 to 1366 × 1024. Cache v77 activated, with no browser errors.
Physical iOS/Safari hardware was not available. Reviewed live evidence is in
`C:/Users/burns/dev/dino-perimeter-review/landscape1771/production-release/`
and `production-landscape/`. Run `node tests/landscape.cjs` for the focused suite.

The [experience review](WEB_EXPERIENCE_REVIEW.md) describes the
larger portrait battlefield, compact armory/upgrade dock, guided first defense,
route coverage and undo, chapter pacing, Gatling/Cryo specializations,
research/debrief improvements and verification. `js/experience.js` and
`experience.css` own the additions; run `node tests/experience.cjs` for their
focused regression suite.

The initial 1.77.0 production verification checked HTTP 200 and exact committed SHA-256 for all
92 assets, loaded skins/audio, all ten weapon finishers, zero-cash resume,
desktop/phone pause controls and actual offline reload under cache v76.
The experience suite also passed on the live site at five layouts: real
placement and undo, prompt first contact, specializations, boss preparation,
research, defeat reports, legacy saves and offline play. It checked all seven
guided starts and 700 legal wave queues. No browser JavaScript errors occurred.
Physical iOS/Safari hardware was not tested. Live captures were reviewed;
evidence is under `C:/Users/burns/dev/dino-perimeter-review/experience1770/`
in `production-release/` and `production-experience/`.

The previous 1.76.0 runtime release, September 14, 2026, used cache v75 and
commit `0e82ac5e2fa8bc3d4a48325b92841732c0957390`;
[Pages run 34919595430 succeeded](https://github.com/vibecodingmatt/dino-defense/actions/runs/34919595430).

The 1.76.0 release ranks victories and defeats: difficulty first, then wave
reached, a completed zone ahead of a defeat during wave 100, then health.
Three-character entry is labeled **initials** throughout. The same result
card works on victory and defeat screens; the board has a wave column and
marks fully cleared zones. Migration `0003_partial_runs.sql` preserves existing
accepted scores as full victories. Worker version
`4e439fcd-3ef8-4f3a-aa21-2abfee777895` is deployed.

Missed-prompt fixes cover failed initial check-ins, old saves, zero-duration
animation frames and qualification while another dialog covers the results.
Old saves start an observed segment at the next wave. New ledgers retain
completed-wave counters across resumes; developer-cheat flags still exclude
runs. Shared bounds in `js/leaderboard-rules.js` allow instant kills at 10x with
generous timing slack, independent of weapon strength. A very late check-in
returns retryable verification status and retains the score; posting remains
an explicit player action. This is still a casual, client-reported leaderboard.

The release passed API validation, replay/concurrency tests, wave-50 defeat
entry, automatic timing retry, failed check-ins, legacy save recovery, deferred
initials after closing the Lab, and a full Difficulty 1 run using heavily
upgraded weapons with normal combat at 10x. Resume imports, the six-layout
endgame suite, seven-layout homepage suite, narrow/touch initials entry and
offline loading passed. Live verification checked all 90 committed assets,
gameplay, mobile controls, rendered daily recap and cache v75, with zero
browser JavaScript errors. The live service held an instant fabricated result,
then accepted both a victory and a wave-50 defeat through a phone browser.
Independent public reads confirmed both scores; the disposable player's scores
and check-ins were removed. Physical iOS/Safari hardware was not tested.
Current evidence is under
`C:/Users/burns/dev/dino-perimeter-review/leaderboard/partial/`.

The 1.75.0 release adds worldwide arcade leaderboards: top 50 per map, completed
difficulty then health, three-character names, post-victory entry, and View
Leaderboards on the homepage. Pending results survive connection failures, and
new saves retain run IDs and cheat history. The dedicated Cloudflare Worker/D1
service is live. See [leaderboard operations](WEB_LEADERBOARD.md) for the API,
identity, pending results, known score-authenticity limits and tests.

The 1.75.0 production verification checked HTTP 200 and committed SHA-256 for all 89 assets,
plus the full release gameplay/offline checks and seven-layout homepage suite.
The leaderboard suite passed ranking/ties, concurrent last-place submissions,
validation, duplicates, personal records, cheat/resume exclusion, keyboard and
touch entry, narrow/landscape layouts, late responses and actual offline reloads.
The real Cloudflare check submitted from a phone browser and confirmed independent
public readback; its disposable player's row was removed. Screenshots of the
entry form, board, homepage button and daily recap were reviewed. No browser
JavaScript errors were found. Phone checks use Chrome emulation, not physical
iOS/Safari. Evidence is under
`C:/Users/burns/dev/dino-perimeter-review/leaderboard/` in `production/`,
`production-service/`, `production-scenes/`, `production-home/` and `production-release/`.

The previous 1.74.1 verification checked HTTP 200 and committed SHA-256 for 87 pages and
dependencies, all 33 loaded dinosaur skins and polished jaw attachments,
the guest renderer, hidden art menus,
ascending weapon prices, matching number keys and Gas selection, actual kills
with all ten finishers, surface effects and red-ring removal, resumed wave one
with one weapon and zero cash, phone layout and offline loading under cache v72.
It also checked the authored audio bank online/offline, larger Gennaro scale,
and deaths of all 33 species and nine bosses without creature vocalizations.
No browser JavaScript errors were found in those checks. Physical phone GPU
performance and film-quality likeness were not established by headless tests.

The 1.74.1 armory supports touch/pen long presses for weapon details, including
locked gear. Phones use a full-width bottom sheet and tablets a centered card,
with a weapon image, current price, targeting, upgrade count and shared description.
Reading pauses play; dismissing restores the prior pause state and selection.
Select weapon returns to placement without making a purchase.

The focused suite passed on production in six phone/tablet viewport configurations
(320–1366 px, portrait and landscape), using actual browser touch events. It checked
release suppression, quick taps, movement cancellation, real vertical scrolling,
multi-touch, resize, lifecycle cleanup, locked/duplicate prices, map purchases,
all ten descriptions, mouse hover, keyboard focus, pen holds and offline use.
The full release verifier and saved-game regressions passed. No browser errors
were found. These are Chrome emulation checks, not physical iPad/Safari testing.
Reviewed live captures and reports are under
`C:/Users/burns/dev/dino-perimeter-review/weapon-info/production/` and
`production-release/`; local checks and the rendered daily recap are in `local/`.

The 1.74.0 Extinction Cannon unlocks at wave 40 for $2,600 and upgrades through
Prometheus, Sunbreaker and the Extinction Engine. Mechanical charge petals hold
a miniature sun; its armor-piercing blast fractures surviving hides for 20% more
incoming damage over 2.4 seconds. Sunfall kills dissolve the actual dinosaur skin
into rising embers. Key `0` selects it; the shop and homepage now list ten weapons.
[Weapon review](WEB_EXTINCTION_REVIEW.md) records the three tiers, balance,
visual design, audio recipes and bounded rendering budgets.

Production checks passed real mouse/touch placement, all three attack and upgrade
flows, seven-map placement/attacks/saves, armor and targeting exclusions, damage
falloff, fracture expiry, unique rewards, pause, desktop, 390/320 px phones,
short landscape, Canvas fallback and offline loading of the weapon and sound bank.
No browser errors were found. Production evidence is in
`C:/Users/burns/dev/dino-perimeter-review/extinction/production/` and
`production-release/`. Its parent directory contains an eleven-second gameplay
recording with the authored audio, plus reviewed charge and impact frames.
The production homepage suite also passed all seven layouts, menus, Play/Continue,
sharing, metadata and offline behavior; those captures are in `production-home/`.

The 1.73.0 wave-one Pteranodon now uses the detailed shared 3D model: sculpted
beak/crest, recessed eyes, mottled leathery wings and articulated gripping feet.
The guest follows the posed foot sockets through the carry. Production checks
confirmed the actual 156,456-vertex export, the full adult pickup on all seven
maps, both headings, exact passenger attachment, pure redraws and unchanged
lives/cash/kills. Desktop, 390/320 px phones, short landscape, centered pause/resume,
missing-skin/Canvas fallbacks and a real offline reload passed without browser
errors. [Pteranodon review](WEB_PTERANODON_REVIEW.md) records geometry, reference
and export details. Live sequence/scene captures were reviewed; evidence is in
`C:/Users/burns/dev/dino-perimeter-review/ptera-film/production/` and
`production-release/`.

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
T-Rex, authored audio, guest models/gore, larger Gennaro, ten weapon finishers,
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
| Worldwide rankings, arcade name entry and pending scores | `js/leaderboards.js`, `leaderboards.css`, `leaderboard/worker.mjs`; [operations](WEB_LEADERBOARD.md) |
| Saves/import/export, placement, first wave, combat, homepage actors | `js/game.js` |
| Guided opening, encounter themes, specializations, mobile armory and run debrief | `js/experience.js`, `experience.css`; [experience review](WEB_EXPERIENCE_REVIEW.md) |
| Touch weapon descriptions, hold recognition and reading pause | `js/weapon-info.js`, shop gestures in `js/game.js`, `#weaponInfo` in `index.html`/`style.css` |
| Homepage fence/outhouse paintings, debris and electrical effects | `js/home-scenery.js`; scene simulation in `js/game.js`; [homepage notes](WEB_HOME_REVIEW.md) |
| Shared 3D tourists, guest costumes, articulated poses and bounded sprite cache | `js/tourists.js`; look factories in `js/looks.js` |
| Wave-one Pteranodon pickup, flight pose and guest attachment | `js/game.js`, `js/creatures.js`, `Tourists.shoulder()`; [Pteranodon review](WEB_PTERANODON_REVIEW.md) |
| Tourist bite sprays, debris, ground stains and independent effect clocks | `js/tourist-fx.js`; scene integration in `js/game.js` |
| Canvas painters and fallback art | `js/draw.js`, `js/drex.js` |
| Sector 7 scene and its distinct resident raptors | `js/perimeter.js`, `js/paddock-raptors.js`, [map notes](../assets/maps/README.md) |
| Other six painted environments and animated set pieces | `js/sanctuary-scenes.js`, `assets/maps/*-sanctuary.webp`, [authoring prompts](../art/browser-maps/prompts.json) |
| Weapon models, upgrade silhouettes, muzzle anchors | `js/arsenal.js` |
| Firing, projectiles and impacts | `js/weapon-fx.js`, integrations in `js/game.js` |
| Extinction Cannon charge, star projectile, blast and tuning | `js/extinction.js`; [review](WEB_EXTINCTION_REVIEW.md) |
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

- **Guided opening:** a new player's first wave waits for Start Wave; skipping
  guidance restores the normal countdown. Transferred or resumed wave-zero
  runs with existing weapons retain automatic startup. Placement guidance must
  cover an early legal route and produce prompt first contact. Every cleared
  wave retains the normal three-second autoplay countdown, including opening,
  boss and chapter boundaries; players can pause manually. Old chapter-break
  preferences must not interrupt autoplay.

- **Weapon descriptions:** touch or pen holds open the public `#weaponInfo`
  sheet after 480 ms, including for locked/unaffordable gear. Tap selects and
  movement beyond 10 px cancels the hold for dragging/scrolling. Multi-touch,
  scroll, resize, hidden tabs and match transitions cancel pending holds.
  The opening finger's release cannot dismiss the sheet or buy a weapon.
  Reading temporarily pauses play and restores its previous pause/speed/selection;
  explicit Select only arms placement. Native modal isolation, trapped keyboard
  focus, close/backdrop/Escape and coarse-pointer hints keep it accessible.
  Desktop hover titles remain. Descriptions use `TOWERS`; prices use `towerCost`.
  This is a player feature, separate from the localhost-only art inspection menu.

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
| Leaderboard service, rankings, entry, saves and offline behavior | Node 22+: `node tests/leaderboards.cjs`; `node tests/homepage.cjs`; `node tests/resume.cjs`; `node tests/endgame.cjs`; [live-service check](WEB_LEADERBOARD.md) |
| Homepage fence/outhouse art, breakup, electrical effects and phone framing | `node tests/home-scenery.cjs`; `node tests/homepage.cjs`; `node tests/presentation.cjs`; `node tests/tourists.cjs` |
| Tourists, guest cameos, evacuation, bite effects | `node tests/tourists.cjs`; `node tests/presentation.cjs`; `node tests/resume.cjs` |
| First-wave state, saved towers, cross-device transfers | `node tests/resume.cjs` |
| Guided placement, compact armory, specializations, encounter pacing and debrief | `node tests/experience.cjs`; `node tests/resume.cjs`; `node tests/weapon-info.cjs` |
| Landscape phone/tablet battlefield, armory rail, side upgrades and rotation | `node tests/landscape.cjs`; `node tests/experience.cjs`; `node tests/weapon-info.cjs` |
| Weapons/upgrades/projectiles/effects | `node tests/arsenal.cjs`; `node tests/dino-fx.cjs` |
| Touch weapon descriptions, bay gestures and reading pause | `node tests/weapon-info.cjs`; `node tests/resume.cjs`; `WEAPON_INFO_REVIEW_URL` and `WEAPON_INFO_REVIEW_DIR` select live checks/evidence |
| Extinction Cannon economy, placement, upgrades, fracture and offline attack | Also `node tests/extinction.cjs`; `EXTINCTION_REVIEW_URL` and `EXTINCTION_REVIEW_DIR` select live verification/evidence |
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
