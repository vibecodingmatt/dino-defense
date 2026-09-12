# Browser creature mesh pipeline

The browser renders the same meshes in combat, the collection, and the homepage.
The source landmarks are `js/creature-species.js` and the two large herbivores in
`js/creature-anatomy.js`. These are authored profiles and limb stations, not
interchangeable leg meshes. This pipeline is separate from the Roblox assets.

From the repository root:

```powershell
node art/browser-creatures/export-input.cjs art/browser-creatures/build/input
& $blender --background --threads 6 --python art/browser-creatures/join_skin.py -- art/browser-creatures/build/input assets/creatures/skinned
node tests/creature-skin.cjs
node tests/creature-wings.cjs
node tests/creatures.cjs
```

`$blender` must be the absolute path to Blender (built with Blender 5.2).
Append species keys to both authoring commands to rebuild only those animals.
The browser needs no Blender installation or runtime build step.

Blender remeshes the body and each individual limb separately, sharing an
approximately 12,500-triangle budget by surface area. Each region uses its own
source surface for transferring and smoothing animation weights. Touching arms,
thighs, feet and wings must never be welded together or borrow each other's
weights. Limb roots overlap inside the torso; proximal thigh and arm weights
attach to the pelvis/scapula. The jaw, teeth, eyes, feathers, frills, horns and
membranes retain their authored geometry.

Pterosaur wings use one closed membrane shell that wraps around the arm and
elongated finger, then tapers into the bowed web. Its leading edge and supporting
volume share vertices; do not add separate exposed support sweeps. Both sides
and the rounded leading edge use the same wing bone. Membrane material preserves
this thin geometry through Blender export. The four affected species are
`whiteptera`, `pteranodon`, `dimorphodon` and `quetzalcoatlus`.

Each `.mesh.gz` contains little-endian float32 triangles, 17 floats per vertex:
position3, normal3, bind-position3, color3, boneA, material, part, boneB, blend.
The two bone weights sum to one. Parts remain constant across each triangle so
boss dismemberment does not stretch boundary triangles. The companion JSON files
record vertex counts, compressed sizes and remeshed regions. Geometry and source skeleton changes
must be rebuilt together. `DecompressionStream` loads the local mesh; missing
assets or unsupported decompression retain the procedural fallback. WebGL failure
retains the original Canvas painters.

The structural test reads all exported triangles to reject cross-limb weights
and verifies actual D-Rex knuckle-pad vertices through stance frames and connected
rear ankle/toe skin. An optional
directory argument tests saved pre-fix meshes to reproduce the historical weld
defect. The browser suite also checks independent Dilo display cycles, cached and
prepared rendering, walking and pause behavior.

`tests/creature-wings.cjs` checks exported and procedural wings for one connected,
closed surface, skin enclosing the wrist, and shared vertices staying welded
through 32 flap phases. Passing a saved asset directory reproduces a historical
wing defect as a failing assertion.

## Hide texture provenance

Runtime asset: `assets/creatures/hide-detail.webp` (1024 square, 360,592 bytes).
Source: `hide-detail-source.png`. Created using the built-in `image_gen.imagegen`
tool on September 12, 2026, then resized and encoded with browser Canvas.
Triplanar sampling provides bind-space color and fine relief without UV seams.

Prompt:

> Create one production game material texture, square 2048x2048, seamless edge-to-edge tileable. Macro surface of realistic dinosaur/reptile hide. Entire image filled with densely packed SMALL irregular polygonal pebbled scales (roughly 90 scales across the image), natural fine wrinkles and larger subtle folded creases gently flowing horizontally. Flat orthographic material scan, even soft diffuse lighting with NO directional cast shadows, NO vignette, NO gradient, NO perspective. Neutral desaturated gray values, midgray scales with darker narrow crevices and lighter tiny rough raised centers. Convincingly organic asymmetrical fine scale cells of varying sizes, very detailed rough keratin surface, restrained pores and thin fine intersecting wrinkles. NOT a dinosaur picture, NO eyes, NO teeth, NO silhouette, NO text or border, NO large crocodile armor plates. This is a neutral detail texture that will be tinted separately on 3D dinosaur models.

Visual review and its limits are recorded in `docs/WEB_CREATURE_ANATOMY_REVIEW.md`.
