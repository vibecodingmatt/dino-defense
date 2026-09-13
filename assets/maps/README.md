# Browser map environments

## Six sanctuary scenes

The six `*-sanctuary.webp` files are the Visitor Center, Aviary, River Delta,
Lockwood Estate, Proving Grounds and Mosasaur Lagoon backgrounds. Each was
authored with the built-in OpenAI image-generation tool on September 12, 2026,
using the previous map as a route-layout reference. The exact prompt set is in
[`art/browser-maps/prompts.json`](../../art/browser-maps/prompts.json).
The selected source plates are 1672 × 941 and encoded as WebP at 90% quality;
the six delivered images total 3,978,836 bytes. They are local game assets,
with no runtime image-generation service.

| Map | Environment | Live set pieces |
|---|---|---|
| Visitor Center | Amber-glass rotunda, golden gardens and fossil courtyard | Fountain jets, butterflies, water glints |
| Aviary | Fractured glass cathedral, karst cliffs and turquoise pools | Waterfall spray, mist, gliding silhouettes, pollen |
| River Delta | Flooded research outpost, grounded ferry and seaplane | Arriving/landing/departing helicopter, rotating antenna, rippling water |
| Lockwood | Moonlit manor, fossil pavilion and auction conservatory | Fountain, keeper's lantern, bats, restrained distant lightning |
| Proving Grounds | Helios containment array in a sandstone canyon | Pulsing induction coils, service carriage, calibration pulse |
| Lagoon | Coral sanctuary, glass observatory and luminous reef | Reef schools, water glints, bioluminescence and swaying feeding hook |

`js/sanctuary-scenes.js` bakes the plates into the existing 1280 × 720 world.
These are detailed painted environments with live Canvas set pieces, following
the same approach as Sector 7. Small image-space registration tables align the
painted walkways to the original gameplay routes; they never alter `LEVELS`,
pathfinding, placement eligibility, saved coordinates or difficulty. New set
piece anchors should use `anchor(art,x,y)` to share that registration.

The six scenes have no additional placement restrictions. A lightweight stone
or metal foundation makes each weapon's position readable over the detailed
terrain. The Proving Grounds retains the complete free-build maze grid.
Image loading refreshes the active terrain and menu thumbnail without resetting
the run, camera, scene clock or weapons. Until loading succeeds, the complete
existing procedural map remains playable. All six images and the scene module
are listed in the service worker for offline installation.

Animations are bounded analytic functions of the unaccelerated scenery clock.
They do not mutate gameplay or ambient particles, call sound effects, or consume
gameplay randomness. Pause freezes the scene; reduced motion holds every new
set piece still and suppresses lightning. The helicopter completes a 64-second
arrival, landing and departure cycle, with integrated rotor deceleration.

Run `node tests/sanctuary.cjs` for routes, real placement, combat, exact save
restoration, mobile layout, deterministic motion, reduced motion, missing/late
images and a genuine offline reload. `MAP_REVIEW_URL` selects a deployed base
URL, and `MAP_REVIEW_DIR` selects an evidence folder outside runtime assets.
The test also captures route overlays for manual visual alignment review and
measures desktop CPU drawing submission, not physical-phone GPU frame rates.

Source PNGs, local review captures and encoding utilities are retained outside
the repository in `C:/Users/burns/dev/dino-perimeter-review/maps1660/`.

## Sector 7 background

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
