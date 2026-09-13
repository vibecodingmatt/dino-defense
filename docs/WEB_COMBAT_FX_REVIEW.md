# Browser combat effects

Release implementation: **1.64.0**, cache **v58**, September 12, 2026. Deployment
status is recorded separately in the browser orientation.

The weapon update had routed every ordinary kill through one generic fall,
making the original weapon-specific branches unreachable. `js/dino-fx.js`
replaces that route with nine sequences using the current species' exported
skin, anatomical part masks and rig. Bosses retain their bespoke finales.

| Weapon | Restored sequence |
|---|---|
| Gatling | Bullet holes, sputtering deflation, fluttering empty hide |
| Flamethrower | Charred statue, two blinks, ash crumbling from the feet upward |
| Sniper | Double backflip, upside-down knockout, eyes and orbiting stars |
| Cryo | Frosted model inside cracked ice, teeter, crystal shatter and vapor |
| Tesla | Anatomical rib/limb skeleton and skull, falling bones, residual current |
| Sonic | Vibrating model echoes dissolve into drifting musical notes |
| Missiles | Actual head, tail and limb fragments, blood streaks and debris |
| Mortar | High spinning launch, incoming whistle, inverted crater landing |
| Gas | Green collapse with the victim's translucent spirit rising above it |

## Runtime ownership

- `Creatures.effectFrame` samples at most 96 real mesh vertices and 14 dorsal
  fire attachment sites. The same blended bone matrices, view and heading used
  by the WebGL shader project these points. Loaded skins invalidate samples of
  the procedural fallback.
- Skin treatments use bind coordinates for scorch, scale frost, poison tint,
  electrical light, ash dissolution and bullet holes. Live atlas and snapshot
  keys include quantized treatment values, so a status cannot contaminate an
  untreated preview or persist after its timer expires.
- `DinoFX.status` draws turbulent density sprites, smoke, sparks, small faceted
  crystals, low vapor and thin electrical branches at those animated points.
  Tesla impact and chain links now meet the body rather than the path anchor.
- `WeaponFX` delegates death drawing and updating to `DinoFX`. The existing
  combat loop owns lifetime, sound beats and per-weapon muting. Drawing does
  not age effects, emit particles or call audio. Muted beats are consumed once.
- The normal red boss aura is removed. The blue temporary invulnerability
  indicator, health bars, entrances and boss death scenes remain.
- `index.html` loads the new module after `creatures.js`; `sw.js` includes it
  in the offline shell. The local armory preview allows each long finisher to
  complete before its next demonstration.
- The `TOWERS` catalog follows ascending base purchase prices, from Gatling
  ($180) through Mortar ($1,000). Mason's Gas ($240) is third. Shop cards, guide
  lists and number-key shortcuts share that order; prices, stats and unlocks
  are unchanged. Costs earned through later progress do not reorder the cards.

The density texture cache is capped at 40 tiles / 1 MiB. Creature snapshots keep
their existing 96-desktop / 48-touch limits. Finishers use one bounded effect
descriptor each and deterministic debris trajectories. No additional downloads
or rebuilt mesh assets are needed. Unavailable WebGL uses the native Canvas
creatures with the same sequence transforms and simplified material tints.

The 1.69.0 missile follow-up increases the blood burst from 22 thin streaks to
72 larger ballistic droplets and the small flesh debris from 14 to 24 pieces.
Blood originates at the sampled body center, settles into individual splashes
and irregular pools, and fades with the extended 2.8-second finisher. The effect
still owns one bounded descriptor; seeded redraws do not emit particles or age
state. Boss finales and damage/kill credit retain their existing behavior.
`node tests/missile-gore.cjs` exercises a real missile with two splash kills and
a surviving target, checks visible airborne/landed blood and complete cleanup,
and captures desktop, phone and Canvas fallback views. `FX_REVIEW_URL` selects
production and `FX_REVIEW_DIR` selects an external evidence directory.

## Verification and visual evidence

`node tests/dino-fx.cjs` covers all 27 weapon configurations, burn/gas kill credit,
Tesla body contact, boss finales, once-only sound beats, muting, rendering purity,
status cache invalidation, cloak suppression, the removed red ring, retained
invulnerability cue, Canvas fallback, phone rendering and offline loading.
It checks 264 animated attachment poses and 1,188 finisher beats over all 33
loaded joined skins. A 24-dinosaur / nine-finisher scene stayed within the cache
caps; measured headless CPU submission p95 was 4.6 ms. That is not a physical
mobile GPU frame-rate measurement.

The arsenal, creature, presentation and tourist suites also passed. Creature checks
include 396 headings, the 60-animal moving herd, every boss finale, homepage
palettes, frill animation, touch inspection and offline skins. Geometry and
weights were not edited, so mesh export/topology rebuilds are outside this change.

External review artifacts in `C:/Users/burns/dev/dino-perimeter-review/`:

- `dino-status-review.png`: clean/fire/frost/Tesla/gas comparisons on five body types.
- `dino-fx-roster-0.png` through `-2.png`: all 33 species with all three main
  statuses, viewed across three headings and gait phases.
- `dino-finishers-review.png`: three beats from each of the nine finishers.
- `dino-fx-game-desktop.png`, `dino-fx-game-phone.png`: effects on the actual map.
- `dino-fx-verification.json`: regression results and measured cache/timing data.

These are stylized game effects that preserve the original visual jokes. Ice
and bones use budgeted projected geometry; they are not fluid simulation,
anatomically complete excavated skeletons or physically simulated ragdolls.
