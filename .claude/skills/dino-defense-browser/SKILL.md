---
name: dino-defense-browser
description: Maintain, debug, test and improve the Dino Defense browser game, including shared dinosaur and guest models, weapon effects and audio, maps, homepage and saves. Use for web, localhost or GitHub Pages gameplay work; Roblox has a separate workflow.
---

# Dino Defense browser

Work from `C:/Users/burns/dev/games-playground/dino-defense` (or its checkout).
Paths below are relative to that repository. Read `AGENTS.md` and
`docs/WEB_ORIENTATION.md` first; the latter owns current release state, source
ownership and the test matrix. Follow the platform already in the conversation.

For a local preview, use `node scripts/serve-web.cjs [port]` (default 4176).
It needs no package install or Python launcher. Browser tests start their own
servers; do not depend on an old preview process still running.

## Choose the relevant workflow

- **Creature modeling/animation:** read `art/browser-creatures/README.md` and
  `docs/WEB_CREATURE_ANATOMY_REVIEW.md`. Inspect the actual rendered exported
  model before changing it, then compare several headings and gait/flap phases.
  Await `Creatures.ready(keys)` and verify `joinedSkin`; source fallback geometry
  alone does not establish what users see. Rebuild affected `.mesh.gz` and JSON
  alongside any geometry/skeleton changes. Keep species-specific proportions.
  For jaws, also read `docs/WEB_JAW_POLISH_REVIEW.md`; for the film-inspired
  T-Rex, read `docs/WEB_TREX_AUDIO_REVIEW.md`. The `rex93` sculpt and pattern 4
  palette are separate from the shared anatomy. Finish export before tests or
  captures; a partially rebuilt roster can mix old and new skins.
- **Map/paddock:** read `assets/maps/README.md`. The resident raptors are separate
  from combat creature rigs. Preserve route coordinates, existing saved tower
  locations, placement restrictions and the complete image-failure fallback.
- **Weapons:** inspect `js/arsenal.js`, `js/weapon-fx.js` and their combat callers.
  Hardware and muzzle anchors must agree at every upgrade; actual projectiles
  leave the rendered ports. Advance effects in simulation, not in draw calls.
  Status surfaces and finishers live in `js/dino-fx.js`; use
  `docs/WEB_COMBAT_FX_REVIEW.md` for attachment, cache and kill-credit details.
  Shop, guide and number keys share `TOWERS` order by base purchase price.
- **Sound effects:** read `art/browser-audio/README.md`. `js/audio-fx.js` authors
  the bank; `js/game.js` owns SFX calls, gesture unlock and mute/pause behavior.
  Regenerate the bank for recipe changes, not trigger-only changes. Dinosaur
  deaths intentionally have no creature vocalizations; keep physical finishers
  and living/entrance calls. `tests/audio-fx.cjs` checks actual combat routes.
- **Tourists/guest cameos:** shared model/poses are in `js/tourists.js`, costumes
  in `js/looks.js`, blood/debris in `js/tourist-fx.js`. Use
  `docs/WEB_GUEST_REFERENCE_REVIEW.md` for film references. Gennaro's seated and
  caught poses share `look.size`; `LOO_MAN` and derived `LOO_SEAT` position the
  occupant and toilet together. Check both desktop and phone during an actual
  bite, not only a standing costume preview.
- **Saved-game starts:** trace restoration, `beginFirstWaveCountdown()` and
  `updateStartPrompt()` together. Test an imported save in a fresh browser with
  existing weapons and insufficient cash; a text-only fix leaves play blocked.
- **Homepage/inspection:** use the shared skins and preserve independent
  animation state. Local art panels are controlled by `ART_PREVIEW_ENABLED`;
  public query flags do not grant access. Existing gameplay debug URLs are a
  separate feature. Verify actual public-origin behavior, not only CSS classes.
- **Publishing:** use `skills/deploy-dino-defense/SKILL.md` when deployment is
  requested or already authorized. Documentation/skill maintenance is not a
  reason to bump runtime versions or publish a new game release.

## Model failures to avoid

Do not union the whole animal: touching unrelated arms/thighs used to become
stretchy skin webs. Preserve independent motion-region remeshes and local
weight transfer. Tooth roots belong within the jaw margins. D-Rex needs front
knuckle support and continuous rear ankles/toes. Pterosaur arm/finger volume
and membrane share one closed skin surface; separate tubes caused floating
wing bones. The pipeline/review docs explain these repairs and their checks.
Lower jaws use a rounded rear heel blended between the existing head/jaw bones;
keep the tooth-bearing front rigid. Replacing it with a flat cap exposes a cut
surface during bites. `tests/creature-jaws.cjs` checks delivered and fallback
skins, closed topology, attachment weights and opening motion.

The user wants convincing species anatomy and motion; Roblox's moulded brick
art direction is not the browser style. A green test suite does not prove film
likeness. Report remaining visual limits candidly and inspect each affected
species rather than extrapolating from one attractive angle.

## Finish

Use the orientation's affected test suites and actual browser views. Check
homepage use when shared creatures change, offline loading when runtime assets
change, and Canvas/procedural fallbacks when renderer/loading code changes.
Keep durable procedures here, export details in the pipeline README, and current
state in the orientation. Historical screenshots and one-off review scripts
belong outside the runtime asset set.
