# Pteranodon and wave-one tourist pickup

Published September 14, 2026 in browser release 1.73.0.

The wave-one carrier previously bypassed the shared creature renderer and used
the old flat Canvas bird. It now draws the same exported Pteranodon used by
combat and the collection, with independent wing-fold, leg-reach and grasp poses.
The original omen, dive, pickup, carry and exit timings remain in `game.js`.

## Reference and authored model

The visual reference is the Pteranodon model imagery in Digital Model Creative's
[Jurassic World portfolio](https://digitalmodelcreative.com/-jurassic-world-2015).
The reviewed image is saved outside the repository as `reference-jw.jpg` in
`C:/Users/burns/dev/dino-perimeter-review/ptera-film/`. It guides the long beak,
swept red crest, slate body and mottled leathery wings; this is an authored game
interpretation, not an extracted film asset or a claim of exact film likeness.

`pteraFilm` landmarks define the fuller chest, swept neck, tapered toothless
beak, recessed eye sockets, nasal openings, eyelids, cheek folds and closed
sculpted crest. Pattern 7 supplies slate skin, a pale throat, russet crest and
warm mottled wing membranes with fine fibres and veins. It reuses the existing
hide-detail texture; no additional texture request is needed.

Each wing remains a closed shell enclosing its supporting arm and long finger.
Root weights blend into the body during the dive's shoulder fold. Three free
wrist fingers and their hooks sit outside the membrane. Each foot has a reaching
leg and four individually posed toes, including the opposed rear digit.

Only `pteranodon.mesh.gz` and its paired JSON were rebuilt in Blender 5.2.
The body uses 0.010 voxels, three smoothing passes at 0.60 and a 20,500-triangle
skin budget. Final export: **156,456 vertices**, **1,451,257 compressed bytes**
(previously 757,336 bytes); procedural source: 109,380 vertices.

The narrow leg and toe lofts use retained material 6. A trial voxel remesh
perforated the lower legs; the delivered asset retains their closed authored
surfaces instead. The regression checks the actual gzip as well as the fallback,
including welded positions through 24 reach/grasp phases. Do not put these
small leg surfaces back into material-1 remeshing without equivalent evidence.

## Scene attachment and rendering

`Creatures.snatchFrame()` projects the posed foot sockets using the exact
flight bones, camera angle and bank used to draw the bird. `Tourists.shoulder()`
uses the guest sprite's quantized animation frame and projection. Their shared
anchor keeps the tourist's shoulders under the grasp through flap and carry.
The old independent vertical bounce was removed from the passenger offset.

`Creatures.drawSnatcher()` renders one bounded tile, capped at 384 pixels for
coarse pointers and 640 on desktop, without adding continuously changing flight
poses to the sprite cache. It preserves copied combat atlas snapshots and does
not advance simulation. Prefetch starts with the omen. Missing mesh data uses
the updated procedural model; unavailable WebGL retains the original Canvas
bird and guest drawing. `sw.js` already includes the Pteranodon gzip and JSON;
cache v70 refreshes their contents.

## Verification and evidence

Passing local checks:

- `tests/snatcher.cjs`: complete naturally triggered adult pickup on all seven
  maps; unchanged lives/cash/kills; both headings over 24 phases; exact passenger
  attachment; pure redraws; desktop, 390/320 px phones and short landscape;
  frozen pause, centered resume and exit; missing skin, Canvas and real offline
  reload. The closed-leg check evaluates 259,200 posed vertex copies.
- `tests/creature-skin.cjs`, `tests/creature-wings.cjs` and
  `tests/creature-jaws.cjs`: full-roster exported surface ownership, closed wing
  shells and attachment through flap, rounded jaws and rigid bite tips.
- `tests/creatures.cjs`, `tests/tourists.cjs`, `tests/presentation.cjs`:
  shared model/guest rendering, all eight homepage species, animation/cache
  contracts, public art-menu restrictions and offline/Canvas paths.
- `tests/resume.cjs`: imported saves, all seven maps, restored weapons with
  zero cash, fresh starts and selling the last weapon.

Visual captures were reviewed after `Creatures.ready(['pteranodon'])` resolved
and `joinedSkin` was confirmed. Evidence in the external directory above includes
`before-*`, `final-model.png`, `final-cameo.png`, `final-feet.png`,
`final-scene.png` and the `local/` sequence/phone captures. The scene suite accepts
`SNATCH_REVIEW_URL` and `SNATCH_REVIEW_DIR` for equivalent production checks.

These checks establish appearance, attachment and browser behavior. Headless
software rendering does not establish physical-phone GPU frame rates.

Production commit `2004551037a3f14b29f94fbbf8e96ecb4e322799` deployed through
[successful Pages run 34906055860](https://github.com/vibecodingmatt/dino-defense/actions/runs/34906055860).
The full release verifier passed exact committed hashes for 86 live pages/assets,
all 33 loaded skins, gameplay/audio/resume checks, phone layout and offline
cache v70. The scene suite also passed against the ordinary production URL:
all seven maps, four layouts, 233 passenger attachment samples, 48 heading/flap
poses per layout, pure redraws, centered pause/resume, procedural/Canvas fallbacks
and offline loading, with zero page errors. The live sequence and unobscured
scene captures were visually reviewed. Reports and images are in `production/`
and `production-release/` under the external evidence directory above.
