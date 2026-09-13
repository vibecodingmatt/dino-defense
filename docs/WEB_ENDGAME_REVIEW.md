# Browser endgame presentation

The 1.70.0 follow-up rebuilds the D-Rex death and the wave-100 victory reward.
`js/endgame-fx.js` owns deterministic painting and the cue timelines;
`js/game.js` owns simulation, rewards, scene transitions and sound dispatch.

The D-Rex buckles, inflates in pulses, and develops fractures sampled from its
actual torso skin. Its rupture at 2.85 seconds scatters the existing head, tail
and limb meshes, 148 ballistic blood droplets, torn hide/tissue, and exposed
ribs. Ground splashes, vapor, sparks and the crater fade through a 9.6-second
sequence. Canvas fallback remains supported, and reduced motion removes the
inflation tremor, lowers the particle count and softens the central glow.
There is no full-screen flash or death vocalization. Existing authored pressure,
impact, shatter and heartbeat sounds play once as simulation crosses each cue.
No mesh or audio-bank rebuild is needed.

The final corpse still holds victory until it expires. `victory()` grants the
existing rewards once, then starts a separate real-time ceremony. A full-screen
Canvas sky stages rising shells, chrysanthemums, long falling trails, crossing
searchlights and confetti above a jungle silhouette. HTML/SVG supply a gold
containment medal, the "YOU HELD THE LINE" title, the map/difficulty and actual
run highlights. The 10.8-second show respects the whole viewport, including
portrait phones; a compact two-column composition supports short landscape
screens. It has 21 authored firework launches and a bounded canvas (at most
1600 pixels per side). Reduced motion uses a still award scene for five seconds.

The ceremony's update runs in `frame()` after combat stepping, so 10x game speed
does not accelerate it. Hidden tabs do not age it. Draws never advance clocks,
spend random numbers or trigger audio. View results, Escape and the automatic
ending share one dismissal path; dialog focus moves into the existing results.
Menu entry and a new run retire the overlay. Achievement toasts are visually
suppressed while the ceremony is visible so they do not obscure the award.

Boss entrance/roar, footfall, sever and death cues no longer apply camera shake.
Large ordinary dinosaurs and Omega also keep their footstep dust without camera
motion. Base damage and other existing combat impact effects remain separate.

`node tests/endgame.cjs` exercises all nine boss entrances/walks, real D-Rex
kill credit, real-time final-corpse holds, once-only rewards/cues, redraw purity,
the real frame loop at 10x combat speed, hidden-tab retirement, keyboard/touch
dismissal, focus, responsive layout, Canvas fallback and offline loading.
`ENDGAME_REVIEW_URL` selects the live base URL; `ENDGAME_REVIEW_DIR` selects an
external evidence directory. The creature, audio, combat-effects, homepage,
presentation and resume suites cover the surrounding systems. Browser captures
and CPU submission checks do not establish physical phone GPU frame rates.

Local before/after captures and production evidence are kept outside the game
at `C:/Users/burns/dev/dino-perimeter-review/endgame1700/`.
