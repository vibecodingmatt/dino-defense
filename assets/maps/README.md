# Sector 7 background

`sector7-facility.webp` is the production Perimeter Fence scene (633,952 bytes).
It was generated for this game with OpenAI imagegen on September 12, 2026,
using a screenshot of the procedural scene as the layout reference, then
encoded as WebP at 90% quality. No runtime image service or network dependency
is needed. The original PNG and review captures are retained in the local
`dino-perimeter-review` workspace outside this repository.

The renderer uses a fixed 1280 × 720 coordinate system. All seven road
waypoints, enemy routing, wave balance and save data remain in `js/data.js`
and `js/game.js`. If revising the image, preserve the exact route centerlines
and widths. Keep animals and the feeding cable out of the static artwork.

`js/perimeter.js` supplies the live raptors, hook, searchlights, mist,
electrical fault and foreground occlusion. The front catwalk and side foliage
are drawn again from the same plate, in front of the animals. Art is baked
once per load; only these small moving elements render each frame. A
deterministic procedural scene is available immediately if the image is slow
or unavailable. A completed image load refreshes the scene and menu thumbnail
without restarting the run.

The paddock, transformer yard and control building reject new towers with a
`RESTRICTED FACILITY` placement message. Existing saved towers are preserved
at their exact positions, with a steel mount if inside a new reserved area.
Scenery uses a separate clock that pauses with gameplay and does not accelerate
with wave speed. Reduced-motion preference holds the scene still and disables
electrical sparks. Rain streaks and repeating splash rings were removed.

`js/paddock-raptors.js` builds articulated 3D residents and projects lit poses
into a lazy sprite atlas (32 headings, 16 walk poses plus a standing pose,
under 27 MB). Rounded patrols determine facing and distance-based stride;
feet move backward relative to the torso only during their planted stance.
Turns rotate the actual body volume rather than shrinking a flat drawing.

Browser verification: `node tests/perimeter.cjs` with `playwright-core`
available, or set `PLAYWRIGHT_MODULE` to its local directory. `CHROME_PATH`
can override the installed Chrome executable. Captures go to
`PERIMETER_REVIEW_DIR`, or the sibling `dino-perimeter-review` directory.
