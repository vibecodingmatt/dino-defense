# Browser creature repair review - September 12, 2026

These repairs shipped in browser **1.62.7**. See [the browser orientation](WEB_ORIENTATION.md)
for the production commit/run and current maintenance entry points. This file
replaces the earlier optimistic reviews and accumulating follow-up summaries.

Later focused passes are recorded in [T-Rex and audio review](WEB_TREX_AUDIO_REVIEW.md)
and [jaw attachment review](WEB_JAW_POLISH_REVIEW.md). The
[Blue review](WEB_BLUE_REVIEW.md) covers her film references, swept neck,
muzzle taper and dense lip/tooth placement. Use these for the current
focused sculpts and shared lower-jaw shape; the rules below still cover the body,
limbs, wings and homepage integration.

## Assessment

The pass repairs geometry and improves species silhouettes. It does **not**
establish the cinematic, film-like quality requested by the owner. Close-up
facial sculpture remains simplified, feather grooming is regular, some armor
and crests still look procedural, and each wing uses one transform rather than
an articulated wrist. Tests establish specific behaviors, not film likeness or
performance on physical mobile hardware.

## Current anatomy and regression lessons

| Defect | Repair to preserve | Evidence/check |
|---|---|---|
| Generic bloated bodies and thin support legs | Species-authored body/skull/limb landmarks; substantial Triceratops and sauropod limbs | Actual profile/front/rear views of each affected species |
| Teeth through the cheeks | Upper and lower lip margins meet; tooth roots stay medial to them | Inspect closed and fully open jaws from several angles |
| Folded tails/body profiles | Shape-preserving interpolation uses actual station spacing | `tests/creatures.cjs` checks monotonic profiles |
| Stretchy skin between passing arms and thighs | Remesh independent motion regions; transfer weights only within their source region | `tests/creature-skin.cjs` rejects unrelated limb/torso weights |
| D-Rex walking on splayed front toes | Upright palms, curled fingers and knuckle pads; claws fold above ground | Planted knuckle vertices tested across stance frames |
| Detached D-Rex rear feet | Metatarsal skin reaches the toe bases before remeshing | Connected ankle/toe components in actual exported skin |
| Floating pterosaur wing ropes | One closed skin shell wraps arm/finger volume and tapers into membrane; no separate exposed support tubes | `tests/creature-wings.cjs`, exported and fallback geometry through 32 phases |

The wing repair covers `whiteptera`, `pteranodon`, `dimorphodon` and
`quetzalcoatlus`, preserving their species landmarks. The saved pre-fix White
Pteranodon fails the new check with eight disconnected components per wing.
Other historical assets reproduce the unrelated-limb welding defect. These
negative fixtures live outside the repo; current checks do not require them.

The authoring/export source and commands are in the
[browser mesh pipeline](../art/browser-creatures/README.md). Pterosaur membranes
are retained authored surfaces, not remeshed with the torso. Do not resurrect
the old whole-animal union or independently swept wing ribs.

## Animation and homepage behavior

- Dilophosaurus keeps its paired crests and pleated red/yellow/black frill. Live
  animals display for about 2.45 seconds on staggered 7-11-second cycles.
  Simulation time drives `frillClock`/`frillOpen`, independently of jaws and
  rendering. Pause, game speed, cached/prepared WebGL and Canvas consume the
  same state. `CreatureMeshes.pose(mesh, phase, roar, frill)` supports independent
  frills; retain that fourth parameter through callers and atlas signatures.
- Therizinosaurus keeps its dark feather coverage, small head and long claws.
  It is the eighth random homepage species, sharing the combat model with
  adjusted homepage size/speed. Feeding cameos retain their carnivores.
- Home swallowing bulges are gone from both `drawMenuDino` and the Canvas
  D-Rex painter. Feeding timing and the return to walking remain intact.
- Combat, local collection, boss painters and all eight homepage species share
  skins. Homepage/collection use a lower observation angle; feeding mouth
  anchors use that same projection. A paused collection repaints after loading.
- Art inspection menus initialize only on local allowed hosts. Public query
  flags do not enable them; new game graphics still load in production.

## Verification and evidence

At release, all seven browser suites passed. Creature checks covered all 33
exported meshes, 791,334 triangles with zero unrelated-limb violations, planted
knuckles, closed wing topology, 396 rendered headings, repeating gait, palettes,
staggered Dilo displays, random Theri homepage selection, all nine boss finales,
phone collection controls, a 60-animal herd, graphics fallback and offline skins.
`tests/presentation.cjs` covers both local/public panel behavior and removed gulps.
Its public-origin fixture serves local files; it is not live-site evidence.

Historical actual-renderer captures are in
`C:/Users/burns/dev/dino-perimeter-review/`:

- `revision3-<species>.png`: four views across the roster; pterosaur captures
  were refreshed after the wing repair.
- `revision4-cycle-<species>.png`, `revision4-dilo-display.png`,
  `revision4-dilo-map.png`: overlapping limb motion and walking frill displays.
- `revision5-drex-ankles.png`, `revision5-theri-home-<viewport>.png`: rear foot
  continuity and actual desktop/phone homepage use.
- `revision8-whiteptera-<upper|underside>.png`: eight flap phases on both sides;
  `revision8-before/` holds the earlier source, assets and White Pteranodon view.
- `production-1627-verification.json` and `production-1627-*.png`: live release
  checks. The old seven-roamer review scripts are historical and should not be
  used as the current roster checklist; repo tests cover all eight.

Evidence may be absent on another checkout. Reproduce checks with repo tests and
capture the actual renderer after `Creatures.ready(keys)` confirms joined skins.

References examined during the art pass (not every species received a film
reference comparison): `assets/ref/drexref1.png`,
[Dilophosaurus](https://controlroom.jurassicoutpost.com/app/uploads/2020/09/jp_dilo_1.jpg),
[Dimorphodon](https://image.pngaaa.com/92/946092-middle.png),
[Therizinosaurus close-up](https://www.looper.com/img/gallery/ranking-every-dinosaur-in-jurassic-world-dominion-worst-to-best/therizinosaurus-1654876051.jpg),
and [Therizinosaurus body](https://i.pinimg.com/736x/9b/a7/50/9ba750a6c5b0aa9987eb83362c41e65c.jpg).
