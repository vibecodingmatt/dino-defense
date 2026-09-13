# Lower-jaw attachment polish - September 12, 2026

Local preview: **1.65.2 / cache v61**. This follows the verified **1.65.1**
production release; see [browser orientation](WEB_ORIENTATION.md) for its SHA/run.
The jaw polish has not been published.

## Change

All 33 shared browser models ended their lower-jaw loft at a full-depth vertical
cap. Side views made the mandible look severed; open three-quarter views exposed
the pale cap. `js/creature-anatomy.js` now extends that same closed surface into
a rounded rear heel seated inside the cheek. Its short attachment blends the
existing head and jaw bones. The forward jaw, teeth, bite pivot and mouth anchor
keep their rigid motion. No new bones, draw calls or runtime animation system
are required. Each species keeps its authored jaw depth and width.

The T-Rex's cream jaw coloration now fades below the raised attachment instead
of painting the upper joint uniformly pale. Other palettes are unchanged.
All 33 gzip meshes and JSON metadata were rebuilt through the existing Blender
pipeline. Every exported vertex outside the lower-jaw part is byte-identical to
the deployed baseline, including its animation weights.

The cost is 640 triangles per model: 21,120 triangles across the whole roster,
and 310,596 additional compressed bytes. The complete roster has 820,134
triangles; these are shared assets, not 33 simultaneously drawn models.

## Verification

Passed: `creature-jaws.cjs`, `creature-skin.cjs`, `creature-wings.cjs`,
`creatures.cjs`, `tourists.cjs`, `presentation.cjs`, and `dino-fx.cjs`.

The new jaw test reconstructs both exported and fallback surfaces, rejects a
broad rear cap, checks a single closed component and consistent seam weights,
and exercises the head attachment and rigid bite tip through 17 opening/gait
poses. It passes for 66 surfaces and 382,160 posed vertices. The saved production
meshes fail on their original cap, confirming the regression test detects it.
Existing checks cover 396 headings, planted feet, intact wings, all nine boss
finales and weapon finishers, surface effects, guest bites, phone layout,
Canvas fallback, render purity and offline loading.

All 33 exported models were visually compared before/after from the side with
closed and fully open mouths, then inspected from the opposite side and two
three-quarter views. Desktop and phone homepage captures cover Spinosaurus,
Blue, Giganotosaurus and the T-Rex/Gennaro scene. The rendered What's New modal
was checked at both sizes. No browser JavaScript errors were observed.

This repairs the joint silhouette within the existing stylized models. It does
not add cheek-muscle simulation or establish performance on physical phones.

## Evidence

External review directory: `C:/Users/burns/dev/dino-perimeter-review/jaw-polish/`.
`before-assets/` contains the deployed mesh baseline. `before-<species>.png` and
`after-<species>.png` contain six rendered views each; `comparison-1.png` through
`comparison-7.png` compare profiles, and `angles-*.png` show alternate headings.
`homepage-*.png` and `notes-*.png` capture actual local pages. The review page is
`index.html`; all captures and scratch scripts stay outside runtime assets.
