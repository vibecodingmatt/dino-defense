# Blue film-reference sculpt — September 13, 2026

Published in browser **1.71.0**, cache **v67**, from commit
`1d015d2f44c34314610a6a9340e4a0646fc5cc31`.
[Pages run 34781053595 succeeded](https://github.com/vibecodingmatt/dino-defense/actions/runs/34781053595).
The deployed baseline is maintained in [WEB_ORIENTATION.md](WEB_ORIENTATION.md).

## Reference study

Downloaded and inspected these four references, plus the original exported
Blue from both sides, front, rear, three-quarter headings and walking phases:

- [Universal's Blue promotional artwork](https://www.universalorlando.com/contentdata/uor/pt/br/files/Images/gds/ioa-raptor-encounter-cutout-lvp-b.png): overall build, folded neck, hands, digitigrade feet and raised inner sickle claws.
- [Blue in Dominion](https://static.wikia.nocookie.net/jurassicpark/images/6/62/Blue_in_2022.jpg/revision/latest?cb=20250331041409): blunt muzzle, forehead, orbit and lower-jaw depth. Film still hosted by Jurassic Park Wiki.
- [Jurassic World Blue VR close-up](https://as.com/meristation/2018/06/08/betech/1528449553_997068.html): amber slit pupil, lip scales, curved teeth, gum margins and irregular pale edging around the blue pigment. Promotional image, not a film frame.
- [Licensed Prime 1 Blue sculpture](https://www.prime1studio.com/jw-blue-open-mouth/PCFJW-03.html): corroborating body proportions, neck folds, arms and tooth rows. Treated as a sculpture reference, not the original film asset.

A fifth downloaded image, `blue-profile.jpg`, proved to depict a different
raptor and was excluded. The separate ILM
[Fallen Kingdom page](https://www.ilm.com/vfx/jurassic-world-fallen-kingdom/)
provided production context. No reference image is distributed as a game asset.

Exact downloads, source snapshots, scratch scripts and render evidence are in
`C:/Users/burns/dev/dino-perimeter-review/blue-film/`.

## Changes

`blueFilm` in `js/creature-species.js` and `js/creature-anatomy.js` owns Blue's
sculpt. A tapered muzzle with a small rounded tip replaces the generic skull. The head
has temporal breadth, recessed orbital and antorbital regions, shaped brows,
small nasal scutes, larger visible nostrils and an amber iris with fine radial
markings and a narrow vertical pupil. The lower jaw keeps its rounded attached
heel. Sixty-four curved teeth have varied lengths, narrower lower crowns and
embedded roots with gum margins. Sparse irregular cheek/lip scutes supplement
the existing hide texture.

The torso has a fuller chest and tucked belly, a thicker swept neck with skin
folds, stronger thighs and a longer tapered tail. The hands hang with three
separate curved fingers. Two forward toes support each foot; the inner second
digit has its own lifted pad and sickle, plus a small rear digit. Independent
limb regions remain intact.

Pattern 5 in `js/creatures.js` owns the silver/olive hide, warm underside,
subdued transverse mottling and a broken cobalt stripe with a narrow pale
border. The stripe follows the neck and tail, ends around the eye, and excludes
the lower jaw and limbs. Pigmentation and surface effects stay in bind space.
The Blue palettes in `js/creature-meshes.js` and `js/data.js` agree; the latter
also supplies the Canvas fallback.

Material 6 is retained dermal relief and runs through the same skin and effect
shader as the main body. It must not enter the membrane or feather branches.
Blender preserves it while remeshing material 1. Blue uses 0.010 voxels, three
smoothing iterations at 0.60 and a 20,500 skin-triangle target across five
independent regions. Rebuild Blue's gzip and JSON together.

The exported asset has 157,110 vertices / 52,370 triangles, including 20,498
remeshed skin triangles. Compressed size is 1,401,715 bytes, up 645,520 bytes
from the baseline. It uses the existing bones and one creature draw call.

This remains an authored, stylized browser model. It is closer to the reference
design, but is not a scan or a replica of the film production mesh. Physical
phone GPU performance has not been measured.

## Head-profile refinement

The owner found the first sculpt's skull roof too steep and the mouth too
uniformly curved. The nasal bridge now stays nearly level ahead of the brow,
with its rounded rollover concentrated at the nose. The upper lip descends
under the cheek, rises gently across the maxilla and dips slightly again ahead
of it. The lower jaw matches that lip while retaining a smooth chin contour.
The first iteration exaggerated the wave through the chin; the final refinement
reduces that effect and lowers the nose's front lip for a cleaner frontal closure.

Blue's lip margins, gums, teeth and lower-jaw scutes now sample the same dense
interpolated profiles as the skin. This keeps the detail seated along the new
curve. The authored jaw stations follow the skull stations so both sides meet
at rest. Only Blue's head/jaw landmarks and their detail placement changed in
that focused pass; the shared rounded hinge remains intact.

## Neck and muzzle taper

The next review identified the narrow neck and the muzzle's nearly constant
depth as remaining likeness problems. Increasing vertical neck-profile depth
alone still produced a stalk when viewed from the side: the column rises
steeply, so vertical sections do not describe its perpendicular thickness well.
Blue now uses the existing swept-neck path with a muscular curved centerline,
full shoulder attachment and a rounded nape beneath the skull. Shallow folds
wrap the column. The final iteration lowers the nape to avoid a hump behind
the brow. The sweep is merged into the same body region; limb regions, bones
and draw calls remain separate and unchanged.

The skull keeps temporal breadth around the eye and narrows progressively
ahead of it. At the forward nasal station x=1.66, authored half-width falls
from 0.129 to 0.088 and upper-skull depth from 0.299 to 0.187. Most depth taper
comes from the rising lower edge; the roof has a gentle slope into a smaller
rounded tip. The mandible follows that narrowing and becomes shallower toward
the nose, retaining the uneven lip. Existing dense profile sampling carries
teeth, gums and scutes onto the reshaped surfaces.

The shared sweep builder accepts an optional surface-sculpt callback for the
neck folds. Only Blue uses it; the external audit confirms all 32 other species'
procedural vertices and rigs remain byte-identical. No palette or shader
changes were needed in this pass.

## Verification

Passed again on the final neck and muzzle source/export:

- `node tests/creature-skin.cjs`: all 33 exports, 849,478 triangles, zero unrelated-limb triangles.
- `node tests/creature-jaws.cjs`: 66 closed exported/fallback jaw surfaces, attached hinges and rigid bite tips across 383,792 posed vertices.
- `node tests/creatures.cjs`: all loaded skins, 396 headings, gait, palettes, boss dismemberment, homepage use, phone controls, Canvas fallback and offline loading.
- `node tests/tourists.cjs`: actual Blue/warden bite, guest effects, phone and Canvas paths, offline loading.

The initial sculpt also passed `tests/presentation.cjs` for local/public art
panels and homepage presentation, and `tests/dino-fx.cjs` for all skin effects,
detached parts, phone and offline checks. The focused head pass did not change
their shader or UI code.

The external `audit.cjs` also compared current procedural vertices and rigs
against the saved baseline: all 32 other species are byte-identical. It checks
both loaded comparison frames, synchronized turn/jaw/elevation controls and the 390 px layout.
`scenes.cjs` captures Blue in the actual homepage and combat at 1440 x 1000 and
390 x 844, plus eight posed homepage bite attachments. No browser JavaScript
errors were reported.

`baseline-*` and `final-*` now compare the prior head-profile pass with the
fuller neck and tapered muzzle. `taper-before-assets/` preserves that prior
head; `head-before-assets/` preserves the first sculpt;
`original-before-assets/` and `original-comparison.png` preserve the original
generic raptor comparison. The sheets use the actual exported meshes, shaders and
animation with a larger 3072 px inspection framebuffer for readable close-ups;
this capture override does not ship. Close-up resting views use fully closed
jaws, with an additional open-mouth view. `comparison.png` shows matching side
views. `shape-study.png` compares matched eye-level and elevated three-quarter
views at the normal inspection resolution; `taper-pass3-*` records the final
six-heading and gait review. The interactive comparison uses the normal inspection resolution and
can be started with `node C:/Users/burns/dev/dino-perimeter-review/blue-film/preview.cjs`
at `http://127.0.0.1:4178/`. It is a local review artifact, outside the game.

## Production verification

`scripts/verify-web-release.cjs` passed against the full release SHA: 86 live
pages/assets matched committed SHA-256 and returned HTTP 200. All 33 exported
skins loaded, jaws retained their attachments, public inspection tools stayed
hidden, all nine weapon finishers worked, and resume, phone and offline checks
passed with no browser JavaScript errors.

The focused `scenes.cjs` review used the ordinary production URL at desktop
and phone sizes. It checked the actual final Blue export and pattern, homepage
and combat appearances, eight bite poses, the rendered release note and an
offline reload of Blue's 157,110-vertex skin from `dino-defense-v67`. Production
reports and captures are in `blue-film/production/` and `production-scenes/`
under the external review directory above. The release contains the authored
model and existing hide texture; downloaded reference images remain outside
the published game.
