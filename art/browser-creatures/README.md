# Browser creature mesh pipeline

The browser renders the same meshes in combat, the collection, and the homepage.
The source landmarks are `js/creature-species.js` and the two large herbivores in
`js/creature-anatomy.js`. These are authored profiles and limb stations, not
interchangeable leg meshes. This pipeline is separate from the Roblox assets.

From the repository root, rebuild only the affected species (White Pteranodon
shown here). Use the same keys on both export commands:

```powershell
node art/browser-creatures/export-input.cjs art/browser-creatures/build/input whiteptera
& $blender --background --threads 6 --python-exit-code 1 --python art/browser-creatures/join_skin.py -- art/browser-creatures/build/input assets/creatures/skinned whiteptera
node tests/creature-skin.cjs
node tests/creature-wings.cjs
node tests/creatures.cjs
```

`$blender` must be the absolute path to Blender (built with Blender 5.2).
Append more species keys to both commands when shared geometry affects them.
Omit the filter only for an intended full-roster rebuild.
The browser needs no Blender installation or runtime build step.

Wait for `SKIN_EXPORT_COMPLETE` and a successful process exit before running
tests or capturing views. Shared builders can affect the full roster even when
the reported defect names only a few species. Color/shader-only edits need no
mesh rebuild; jaw-shape edits do, although the jaw is retained by the remesher.

Before reviewing in a browser, await `Creatures.ready(keys)` and confirm
`Creatures.model(key).joinedSkin`. `Creatures.inspect(ctx, actor, x, y, size,
phase, yaw, opening)` draws a high-resolution view of that same model; actor
`artView` controls the observation angle. Inspect both sides and a complete gait
cycle. A procedural fallback capture is not a review of the delivered gzip asset.

Blender remeshes the body and each remeshable limb separately, sharing an
approximately 12,500-triangle budget by surface area. Each region uses its own
source surface for transferring and smoothing animation weights. Touching arms,
thighs, feet and wings must never be welded together or borrow each other's
weights. Limb roots overlap inside the torso; proximal thigh and arm weights
attach to the pelvis/scapula. The jaw, teeth, eyes, feathers, frills, horns and
membranes retain their authored geometry.

The jaw loft includes a rounded rear heel seated inside the cheek, with a short
head/jaw weight blend and a rigid tooth-bearing front. Keep it in the retained
lower-jaw part; a full-depth rear cap creates an exposed vertical cut during
bites. Run `node tests/creature-jaws.cjs` after jaw edits and rebuild all affected
skins. See `docs/WEB_JAW_POLISH_REVIEW.md` for the complete roster comparison.

Only material-1 skin outside the lower jaw is remeshed. In particular, material-3
wing shells survive exactly as authored. Remeshing those thin shells would erase
their edges or separate the membrane from its supporting volume.

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

The 1.62.7 roster's 33 gzip files total 25,886,358 bytes; the runtime hide texture
adds 360,592 bytes. Assets load on demand but `sw.js` precaches the entire roster
for offline use. Keep actual assets, source scripts and `SHELL` aligned when
publishing. Intermediate triangle streams stay in the ignored `build/` directory.

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

The subsequent T-Rex-only pass uses the `rex93` anatomy branch and pattern 4
for the 1993 film references. Its joined skin uses 0.012 voxels, four smoothing
iterations and a 19,500 skin-triangle target, preserving separate limb regions.
Rebuild `trex.mesh.gz` and `trex.json` together after changing its landmarks.
Reference sources, comparisons and final measurements are recorded in
`docs/WEB_TREX_AUDIO_REVIEW.md`.

Blue's film-reference sculpt uses `blueFilm` and pattern 5. Rebuild only `blue`
with both commands above. Its export uses 0.010 voxels, three smoothing passes
at 0.60 and a 20,500 skin-triangle target. Material 6 preserves small dermal
scutes through remeshing and uses the runtime skin shader, including bind-space
pigment and weapon treatments. Keep it out of feather/membrane shader branches.
Blue's neck uses a swept centerline to preserve thickness through the steep
S-curve. Its shallow fold callback applies only to that sweep; retain the neck's
body/head blend and merge it with the body region, never with moving limbs.
When reshaping an uneven mouth, sample lip borders, gums, teeth and scutes from
the same dense interpolated profiles as the jaw/head lofts. Sparse landmark
interpolation can place those details off the finished curved surface. Keep
the chin contour independent of small lip undulations, and inspect fully closed
and open jaws from the front as well as both sides.
All other species retain their existing export settings except the later
Brachiosaurus pass below. References, measurements
and visual/test evidence are in `docs/WEB_BLUE_REVIEW.md`.

Brachiosaurus uses `brachio93` and pattern 6 for the film-puppet head. Rebuild
only `brachiosaurus` with both commands above. Its export uses 0.010 voxels,
three smoothing passes at 0.60 and a 20,500 skin-triangle target. Retained skin
material 6 preserves eyelids, nasal rims and fine lips. Nostril ellipses must
stay entirely on the nasal wall below the roof. Dense upper/lower lip profiles
and a broad closed palate keep the mouth seated in front views. See
`docs/WEB_BRACHIOSAURUS_REVIEW.md` for references, measurements and review limits.
