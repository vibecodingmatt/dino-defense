# Browser creature repair review — September 12, 2026

Browser release 1.62.7, service-worker cache v55. Verification below records the local pre-release review.
This supersedes the previous review, whose positive assessment did not match the defects visible in the user's screenshots.

## Follow-up: skin-covered pterosaur wing supports

The White Pteranodon's old membrane had straight boundaries and a bowed center,
while separate curved arm/finger sweeps and straight dark support tubes sat
outside it. Each wing now has one closed skin surface, rounded around the leading
support and tapering into the membrane. There are no separate exposed rib tubes.
The common construction defect affected Pteranodon, Dimorphodon and Quetzalcoatlus
as well; all four meshes were rebuilt with their existing species landmarks.

`tests/creature-wings.cjs` rejects the saved old White Pteranodon (eight disconnected
components per wing). The repaired exported meshes and procedural fallback have
one closed component per wing, enclose the wrist, and keep every shared vertex
connected throughout 32 flap phases. Actual renderer views cover all four species,
plus eight White Pteranodon flap phases from above and below in
`C:/Users/burns/dev/dino-perimeter-review/revision8-whiteptera-<upper|underside>.png`.
Pre-fix source/assets and the original White Pteranodon capture are in
`revision8-before/` in that directory. Wings still use one transform each.

Verification passed: wing topology/motion (16 exported/fallback wings), the
full 33-species skin checks (791,334 triangles; zero unrelated-limb triangles),
and the browser creature suite including offline loading and graphics fallback.

## Earlier follow-up: homepage gulp removal and local inspection panels

Removed the old swallowing bulge overlay from the homepage painter and the
separate bulge in the legacy Canvas D-Rex. Feeding timing and the return to
walking remain intact. The weapon and dinosaur inspection buttons start hidden;
the panels initialize only on localhost/subdomains, loopback IPs or file previews.
Public-host query flags cannot enable them. The new gameplay graphics remain
available on all hosts.

`node tests/presentation.cjs` verifies local panel interaction, the public host
with and without query flags (using intercepted local files, without contacting
production), 24 late-feeding renders across all eight homepage species, and the
Canvas D-Rex across the former bulge interval. Desktop home/game captures are in
`C:/Users/burns/dev/dino-perimeter-review/presentation-production-<home|game>.png`.

## Earlier follow-up: Therizinosaurus homepage roamer and D-Rex rear feet

Therizinosaurus is the eighth homepage species and participates in the random roaming pool. Its existing feathered mesh, palette and gait are shared with combat/collection. Homepage size and speed account for its taller silhouette; feeding cameos retain their carnivores.

D-Rex's rear-leg skin previously ended behind its toe bases. The metatarsal surface now extends into the toes before remeshing, retaining a continuous ankle-to-foot connection. Only D-Rex required a mesh rebuild. The new connectivity check in `tests/creature-skin.cjs` failed on the previous exported mesh and passes on the repaired asset; all prior independent-limb and knuckle-plant checks also pass.

Actual renderer inspection covers eight close-up gait phases in `C:/Users/burns/dev/dino-perimeter-review/revision5-drex-ankles.png`, plus desktop/phone Therizinosaurus homepage captures named `revision5-theri-home-<viewport>.png`. Source and the old D-Rex asset are backed up in `revision5-before/` outside the repository.

## Earlier follow-up: knuckles, skin welding and walking frill displays

- D-Rex front hands now have upright palms, four curled fingers, tucked thumbs and dark knuckle pads. Claws curve inward above the ground. The existing forelimb gait plants the pads during stance and lifts the closed hands during swing.
- The whole-animal remesh was welding touching arms and thighs and transferring weights across unrelated limbs. Every arm, leg and wing now has an independent remesh and local weight-transfer surface. Limb roots overlap inside the torso, with fixed proximal attachment weights. All 33 assets were rebuilt.
- Spawned Dilos now open, hold and fold their frills for approximately 2.45 seconds on individual 7–11-second cycles. Initial delays are staggered. The display uses simulation time, continues during walking, respects pause/speed controls and operates separately from the jaw. Both WebGL and Canvas rendering consume the same display amount.

The saved pre-fix Indominus, Triceratops and D-Rex meshes reproduce 771 triangles spanning unrelated limbs and 8,436 torso-vertex weight influences from limbs. `node tests/creature-skin.cjs` finds zero such violations in the rebuilt roster's 775,160 triangles and checks 149,184 planted knuckle-pad vertex samples. Its optional directory argument can inspect historical fixtures without treating them as current assets.

Actual browser captures were inspected at eight phases per cycle for D-Rex, Indominus, Triceratops, Therizinosaurus, Velociraptor, Pteranodon and Mosasaurus. The arms and thighs remain separate through overlapping poses. Six Dilo display frames show extension and folding with changing walking poses and a closed jaw. The map capture shows mixed display states in one herd. Files: `C:/Users/burns/dev/dino-perimeter-review/revision4-cycle-<species>.png`, `revision4-dilo-display.png` and `revision4-dilo-map.png`. Previous assets/source are saved outside the repository in `revision4-before/`.

## Assessment

This pass repairs geometry and makes silhouettes more distinct. It does **not** establish the cinematic, film-like quality requested by the owner. Close-up facial sculpture remains simplified, feather grooming is regular, some armor and crest forms still read as procedural geometry, and wings use one transform each rather than articulated wrist deformation. These are remaining art limitations. Passing integration tests does not resolve them.

The roster has 33 Blender-remeshed skins. Body surfaces are joined; each limb has its own surface to prevent skin webs between moving limbs. Proximal thigh skin remains attached to the pelvis. Each animal retains authored proportions and its skeleton. Jaws, teeth, eyes, feathers, membranes, frills and keratin remain separate. Reproduction instructions: `art/browser-creatures/README.md`.

## Corrections examined in actual browser renders

- Carnivores: lips and lower jaws meet along the upper tooth line; tooth roots sit inside the lips. Open jaws expose the two rows and mouth interior.
- Tail/body profiles: shape-preserving interpolation uses actual station spacing. Closely spaced stations previously folded backward, producing seams and abrupt bulges.
- Triceratops and sauropods: substantial supporting limbs, joined shoulders and pelvis, reduced protruding upper-leg masses and continuous tail roots.
- D-Rex: lower broad cranium, high shoulders, large outer supporting arms with hands, medial chest arms placed clear of those forelimbs in sampled poses. Facial sculpture remains well short of the reference.
- Therizinosaurus: dark feather coverage across body, neck, crown, thighs and arms; rust dorsal accents, small beaked head and three long curved claws.
- Dilophosaurus: paired cranial crests and pleated red/yellow/black display frill. The resting display gathers vertically behind the neck.
- Dimorphodon: angular nasal profile, enlarged eye, compact body, wing fingers and diamond tail vane. Pteranodon/Quetzalcoatlus use blade-shaped crests.
- Pachycephalosaurus/Stygimoloch: rounded cranial caps replace pointed towers.
- Parasaurolophus: wider duckbill and connected swept crest.
- Stegosaurus/Ankylosaurus: plates and armor anchored to the revised body.
- Marine animals: flattened skulls, reduced jaw depth and tapered nasal profiles.
- Blue/Indoraptor: continuous flank pigment across the joined hip surface.

All 33 species were rendered in profile, three-quarter, front and rear views with different gait phases and closed/open mouths. Actual game-renderer captures are in `C:/Users/burns/dev/dino-perimeter-review/revision3-<species>.png`. The source backup before this pass is `revision3-before/` in the same directory.

References visually examined:

- Existing `assets/ref/drexref1.png`.
- Dilophosaurus: https://controlroom.jurassicoutpost.com/app/uploads/2020/09/jp_dilo_1.jpg
- Dimorphodon: https://image.pngaaa.com/92/946092-middle.png
- Therizinosaurus: https://www.looper.com/img/gallery/ranking-every-dinosaur-in-jurassic-world-dominion-worst-to-best/therizinosaurus-1654876051.jpg
- Therizinosaurus full-body reference: https://i.pinimg.com/736x/9b/a7/50/9ba750a6c5b0aa9987eb83362c41e65c.jpg

This is not a claim that every species received a film-reference comparison.

## Shared rendering and delivery

Combat, collection, direct boss painters and all eight homepage giants use the same skins and skeletons. Homepage and collection use a lower observation angle; the feeding mouth anchor uses that same projection. Combat retains its game camera. A paused collection repaints after a skin finishes loading.

The generated neutral hide texture supplies triplanar detail in bind coordinates. Its prompt, tool and source are documented alongside the exporter. Runtime WebP: 360,592 bytes. All 33 compressed skins: approximately 25.9 MB. They load on demand; the service worker caches the entire roster for offline play. This increases the initial offline download. Unsupported decompression or failed asset requests retain procedural meshes; unavailable WebGL uses original Canvas painters.

## Verification

`tests/creatures.cjs` validates actual decompressed Blender geometry for all 33 species, bone/material/normal channels, 5,688 monotonically advancing profile samples, 396 rendered headings, repeating gait/stance positions, palettes, all eight homepage actors, random selection and movement of Therizinosaurus, nine boss masks and finales, desktop/touch collection controls, reduced motion, a 60-animal moving herd, Canvas fallback and all 33 exported skins loading offline.

The fallback check caught a null WebGL access from the asynchronous loader; it was fixed. Geometry checks caught zero normals from remeshing; the exporter repairs those normals. These tests establish correctness for the cases tested. They do not measure film likeness or guarantee performance on physical mobile hardware.

`anatomy-home-check.cjs` captures the seven actual homepage painters and Blue/T-Rex feeding poses. Its captures are in the external review directory.
