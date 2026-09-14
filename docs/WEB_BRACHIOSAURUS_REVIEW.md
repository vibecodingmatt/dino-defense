# Brachiosaurus head - September 14, 2026

Prepared for browser **1.72.0 / cache v68**. The verified production baseline is in
[WEB_ORIENTATION.md](WEB_ORIENTATION.md).

The sculpt uses the original Jurassic Park puppet as its visual reference:
[Stan Winston School's puppet rehearsal photos](https://www.stanwinstonschool.com/blog/rehearsing-jurassic-park-brachiosaurus-puppet).
The images show the high nasal vault ahead of the orbit, saddle into a broad
muzzle, heavy lids around dark eyes, fleshy lips and small rounded teeth.
Reference copies and matching before/after views are external review evidence,
not shipped assets.

## Source and export

`brachio93` in `js/creature-species.js` owns the revised skull, rounded chin,
high nostrils and fuller upper neck. The species branch in
`js/creature-anatomy.js` adds recessed eye sockets, chestnut irises, round pupils,
eyelids, nasal rims, cheek folds, lips and short spoon-like crowns. The old
keratin beak is removed. The broad palate meets the mandible across its width;
the carnivore's arched cross-section previously left a triangular opening in
the closed front view. Jaw heel blending and rigid teeth are preserved.

Fine facial tissue uses retained skin material 6. Both upper and lower lips
sample the same dense profiles as the surfaces. Nostril patches follow the
nasal wall and must stay below the roof across their entire ellipse; a rim
crossing the roof produces an exposed polygon band when viewed head-on.

Pattern 6 adds muted umber pigment, warm lip/throat tones, subtle orbit folds
and finer, softer relief on the head. Both the creature catalog and `DINOS`
palette are updated because live actors use `DINOS` colors. This shader branch
does not change the other species' texture scale or relief.

Rebuild **brachiosaurus only** with both pipeline commands. The export uses
0.010 voxels, three smoothing passes at 0.60, and a 20,500 skin-triangle target
distributed among independent motion regions. The delivered mesh contains
148,710 vertices / 49,570 total triangles, compressed to 1,316,948 bytes.
The prior mesh was 57,666 vertices / 19,222 triangles and 636,333 bytes.
Body and leg landmarks are unchanged, though the higher export budget also
refines their tessellation. No new bones, draw calls or runtime assets are added.

The follow-up shortens the muzzle's projection ahead of the nasal vault by
about 30% (roughly 20% off the lower jaw's length from its first landmark).
The front upper lip no longer rises sharply into the rounded nose. Since the
mandible follows that lip, the former rising edge produced an upturned hook
when the jaw opened. A nearly level front edge and a chin rounded from below
fix that shape while keeping the closed mouth seated. Teeth, lip folds, nasal
rims and the mouth anchor follow the shortened profiles. The dome and eye
landmarks retain the first pass's proportions.

## Review and limits

The exported model was inspected from both sides, front, rear, elevated angles,
closed/open jaws and several gait phases. The before/after viewer uses the actual
exported skins. A missing-mesh check exercises the procedural fallback as well.
All 32 other species' procedural vertex streams are byte-identical to the saved
baseline. Brachiosaurus is not a homepage roamer; the existing eight homepage
species are covered by the creature and presentation suites.

Passed: `creature-skin.cjs`, `creature-jaws.cjs`, `creatures.cjs`,
`presentation.cjs`, and `dino-fx.cjs`. These cover all 33 loaded skins, 396
headings, 66 closed jaw surfaces, attached effects, phone collection controls,
Canvas fallback, homepage integration and offline asset loading.
Focused desktop/phone combat and the interactive comparison are recorded in
the external audit.

After the muzzle/jaw refinement, skin, jaw and creature suites were rechecked.
The jaw suite now measures the actual front lip's rise on exported and fallback
surfaces, independently of animation. The saved first pass fails that bound;
the refined export passes. Matching side views compare closed, half-open and
fully open jaws, in addition to the six-heading views.

This is a substantial likeness improvement within the existing browser model
and renderer. It remains a simplified game sculpt, without film-production
displacement or facial-muscle simulation. Headless tests do not establish
physical-phone GPU performance.

Evidence: `C:/Users/burns/dev/dino-perimeter-review/brachio-film/`.
`before-assets/` preserves the original sources and export; `first-pass-assets/`
preserves the first movie-inspired sculpt. `jaw-comparison.png` compares that
pass with the shorter muzzle at three jaw openings. `final-face.png`,
`final-body.png` and `final-cycle.png` record six actual rendered views each.
Run `node preview.cjs` there for the local before/after viewer on port 4179;
`audit.cjs` verifies desktop/phone combat, viewer controls and procedural fallback.
