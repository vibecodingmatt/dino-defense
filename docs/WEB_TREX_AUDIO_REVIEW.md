# T-Rex and effects pass — September 12, 2026

Published and verified: 1.65.1 / cache v60, commit
`025c1c60665463383140f3ae37313b45e8217bf9`,
[successful Pages run](https://github.com/vibecodingmatt/dino-defense/actions/runs/34730419282).
Live checks matched 73 pages/assets to committed bytes and exercised all 33
skins, audio-bank loading, death cues, phone layout and a real offline reload.

## Film references

The target is the original 1993 female, rather than the gaunter later-film
animal or the male from The Lost World. Seven reference images were downloaded
and visually inspected, alongside six baseline views of the actual joined
browser skin. Sources:

- [Stan Winston School's full-size T-Rex sculpt](https://www.stanwinstonschool.com/blog/jurassic-park-t-rex-sculpting-a-full-size-dinosaur): workshop close-up of the eye, cheek, lower jaw, teeth and scale sizes.
- [Original Stan Winston Studio paint-test head](https://www.icollector.com/JURASSIC-PARK-1993-Stan-Winston-Studio-Tyrannosaurus-Rex-Paint-Test-Head_i34305501): three photographs showing brow/nasal ridges, the recessed eye, broad temporal skull and warm coloration. Missing teeth, glue residue and drilled prop holes were not copied.
- [Daylight Gallimimus scene](https://www.romper.com/p/how-to-watch-the-original-jurassic-park-movies-because-jurassic-world-has-your-kids-dino-crazy-9419965): torso/neck mass and warm brown hide outside blue night lighting.
- [Original breakout still](https://naekranie.pl/aktualnosci/jurassic-world-powrot-oryginalnego-t-rexa-i-informacje-o-praktycznych-efektach-specjalnych): open jaws, teeth, arms and heavy silhouette.
- [Additional workshop head image](https://ca.pinterest.com/pin/314829830216977940/): corroborating painted-head detail, carrying the Stan Winston watermark; treated as a secondary reference.

Downloads, exact image URLs, baseline assets and comparisons are outside the
runtime tree in `C:/Users/burns/dev/dino-perimeter-review/trex93/`.
`references.json` identifies each image and source. `before-six-views.png` and
`pass2-body.png` show the before/after model at matching headings; `final-skull.png`,
`final-homepage.png` and `final-game.png` show the final export and live uses.

## Model decisions

The prior rounded skull was replaced with a broad temporal region, a recessed
orbit beneath a heavy brow, antorbital relief, a curved jugal edge and the
characteristic uneven upper tooth line. The lower jaw is deeper, the nose has
shallow irregular scutes and larger nostrils, and the amber eye has a rounder
pupil. Larger curved teeth remain seated within the jaw margins.

The chest and thighs carry more mass; the neck rises with folded skin, the
two-finger arms stay small, and a longer tapered tail balances the front half.
Warm muted brown, a cream jaw/throat and broken dark bars replace the uniform
khaki. The homepage now derives its fog palette from these species colors.
Shared mouth anchors continue to drive guest bites.

The `rex93` branch in `creature-species.js`/`creature-anatomy.js` owns the
sculpt. Pattern 4 in `creatures.js` owns bind-space pigmentation. Other species
retain their own proportions and pattern rules. Blender uses a T-Rex-only
0.012 voxel size, four smoothing iterations and 19,500 skin-triangle budget.
The final asset has 90,498 vertices, 19,542 skin triangles and is 1,009,807 bytes
compressed. Independent limb regions and their weight transfers remain intact.

This is a detailed stylized model built for the browser renderer, not a scan
or an exact replica of the film asset. Visual comparisons guided the sculpt;
passing geometry tests alone does not establish film likeness.

## Sound decisions and verification

See the [audio authoring pipeline](../art/browser-audio/README.md). Every weapon
has a distinct launch, with separate cryo, rocket and artillery impacts. The
previously silent flamethrower now has ignition and combustion; Tesla chain
hops have positional cracks. Death gags retain their timing with richer ice,
debris, hiss and resonant details. Build/upgrade mechanisms, alerts, jet flyby,
creature voices and celebration sounds also use the original sample bank.
The T-Rex has its own layered roar, a brief score dip and quiet heavy footfalls.

Passed locally: `creature-skin.cjs`, `creatures.cjs`, `tourists.cjs`,
`dino-fx.cjs`, `presentation.cjs`, `resume.cjs`, and `audio-fx.cjs`. Tests cover actual loaded
exports, heading/gait/jaw poses, all 33 skins, guest bites, all nine finishers,
render purity, fallback graphics, phone layout and offline loading. Audio
checks exercise real combat calls, global/per-weapon mute, gesture unlock with
Music off, source retirement, 24/18 voice limits and 12 MiB cache eviction.
The rendered battle sample peaks at 0.384 with RMS 0.039 and correct stereo
placement. Physical-device GPU performance and human listening quality still
need device/listener review; the agent cannot receive audio input.

## Follow-up: Gennaro proportions and death sounds

Gennaro's homepage body scale increased from 0.27 to 0.50 of the outhouse
height (about 85%). The seated, lifted and jaw-held poses share that scale;
the toilet seat follows the same hip anchor. Actual homepage animation captures
at 1500 x 1000 and 390 x 844 confirm the larger figure stays consistent through
the bite. Before/after captures are in the reference directory above, named
`before-gennaro-*` and `after-gennaro-*`.

Regular and boss deaths no longer trigger vocalizations, including Omega's
destruction. Ambient calls require a living dinosaur on the field. Weapon
impacts and physical finishers remain, as do living creature calls and T-Rex
entrance roars. The sound recipes and sample bank are unchanged.

Passed again: `audio-fx.cjs`, `tourists.cjs` and `presentation.cjs`, including
phone, Canvas fallback and offline paths. Audio regression coverage now kills
all 33 species and nine bosses through actual gameplay damage, asserts no
vocal cues, checks physical cryo finishers and excludes all-dead herd ambience.
