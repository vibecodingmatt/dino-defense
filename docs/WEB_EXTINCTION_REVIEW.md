# Extinction Cannon — 1.74.0

The tenth placeable weapon is an original containment-tech design: a miniature
star held inside a mechanical accelerator, with copper conductors, cooling
banks, hydraulic supports and four, six or eight opening focusing petals.
The concept fits the park's industrial arsenal without using film assets.

## Combat and economy

Available before wave 40; keyboard `0` selects it. All values below are before
Research Lab bonuses. Damage is the armor-piercing impact-core damage per shot.

| Tier | Purchase / upgrade cost | Damage | Charge | Reload | Blast radius |
| --- | ---: | ---: | ---: | ---: | ---: |
| Prometheus | $2,600 | 900 | 0.85 s | 5.56 s | 86 |
| Sunbreaker | $3,120 | 1,485 | 0.76 s | 4.44 s | 98.9 |
| Extinction Engine | $5,200 | 2,450.25 | 0.68 s | 3.56 s | 111.8 |

The first fully upgraded cannon costs $10,920. Additional copies increase their
base purchase price by $1,300 for each existing cannon. Standard resale,
mastery, saves, Research Lab bonuses and upgrade economics apply.

Range is 125, minimum range 26, with three squares on Proving Grounds. Damage
is full in the inner 22% of the blast and falls linearly to 35% at its edge;
collision allows for dinosaur body size. Ground and aquatic targets qualify;
flyers, concealed creatures and invulnerable scripted actors do not. The shot
locks a ground point at launch, with modest path leading, so it can miss.
Slowing a herd improves its effectiveness. Losing all targets cancels ignition.

Survivors receive a 2.4-second thermal fracture: subsequent damage is multiplied
by 1.20 after ordinary armor subtraction. Repeated hits refresh the duration;
the multiplier does not stack. No slow or stun is added. Dedicated boss finales
remain intact. Range, charge delay, reload and price keep support and anti-air
weapons useful.

An actual 60-second stationary-target simulation delivered 9,000 base cannon
damage versus 3,600 base mortar damage: 2.5 times the damage for 2.6 times the
purchase price. Core sustained rates including charge are about 140.5, 285.3
and 578.5 damage/second. These are controlled comparisons, not a claim that
every late-game map or difficulty is solved by this weapon.

## Presentation and ownership

`js/extinction.js` owns charge, projectile and impact behavior and their pure
painters. `js/arsenal.js` owns the three hardware tiers and five opening poses.
Ignition draws particles inward around a growing core. The launched star has
plasma ribbons and a luminous trail; impact briefly contracts, blooms into a
gold-white fireball, then sends out shock sheets and incandescent debris.
Dark impact glass and glowing radial seams fade with the smoke over 2.65 seconds.

`js/creatures.js` binds thermal fractures to the actual posed dinosaur skin.
`js/dino-fx.js` adds surface embers and the Sunfall finisher: the defeated animal
glows, rises slightly and dissolves into at most 64 skin-anchored embers.
Canvas fallback retains the weapon, blast, warm body glow and fading finisher.
All ages advance in simulation, including a dedicated tower clock and fracture
clock. Paused redraws cannot move the core, age effects, deal damage or emit sound.

Extinction hardware alone uses 384-pixel raster tiles. The sprite LRU enforces
both count and actual byte limits, including the larger tiles: about 56.6 MB
desktop / 28.3 MB touch for turret sprites, plus the small base cache. Six
charging cannons and six simultaneous blasts submitted in roughly 5–6 ms at
the 95th percentile in headless desktop Chrome. This is CPU submission timing,
not physical-phone GPU performance.

Three original sound recipes (`novaCharge`, `novaLaunch`, `novaImpact`) share
the existing gesture unlock, per-weapon mute, spatial mix and voice budgets.
The rebuilt audio bank contains 45 cues / 135 performances. Audio is triggered
only by simulation. No creature death vocalization was added.

## Verification and evidence

`node tests/extinction.cjs` exercises real mouse/touch shop placement, all
three charge-to-impact flows, falloff, armor, targeting exclusions, vulnerability
expiry, unique kill/reward credit, cancellation, minimum range, actual upgrades,
hotkeys, duplicate pricing, all seven maps and upgraded save restoration.
It also checks redraw purity, pause, bounded caches, desktop, 390/320-pixel phones,
short landscape, Canvas fallback and a real offline reload including the bank.
Use `EXTINCTION_REVIEW_URL` and `EXTINCTION_REVIEW_DIR` for production verification.

Arsenal, dinosaur effects, creature rendering, audio, presentation and resume
suites additionally cover the shared integrations. The release verifier now
unlocks the complete armory, uses key `0` for slot ten and advances real charge
time before checking its live finisher. The new module is in both `index.html`
and the service-worker shell, cache v71.

Local evidence: `C:/Users/burns/dev/dino-perimeter-review/extinction/local/`.
`extinction-demo.webm` in its parent directory records eleven seconds of actual
game simulation and the authored sound mix, with three kills and two survivors.
Charge and impact frames and all three hardware tiers were visually reviewed.
Production evidence is recorded separately in `production/` and
`production-release/` after publication.
