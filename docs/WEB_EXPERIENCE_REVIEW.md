# Browser experience update — 1.77.2

Published September 19, 2026 as runtime commit
`a293a828da2d5f3eb5c884ddac02ec9c902ead99`.
[Pages run 35478494515 succeeded](https://github.com/vibecodingmatt/dino-defense/actions/runs/35478494515).
The production baseline and verification are recorded in WEB_ORIENTATION.md.

## Player experience

- Portrait play gives the battlefield the remaining screen height, with a
  compact horizontal armory and an expandable all-weapons/support view. The
  canvas retains its aspect ratio and crops horizontally; touch pan and the
  Overview button expose the entire map. Overview restores the previous camera
  when closed. A selected weapon opens in a scrollable bottom dock. Landscape
  uses a narrow weapon rail and side upgrade dock; desktop keeps its side armory
  and anchored upgrade panels.
- A new player's opening waits for an explicit first-wave start. A legal gold
  marker suggests a useful early Gatling location. Placement highlights the covered
  road and warns about illegal or ineffective positions. The last placement
  can be undone at full cost for eight real-time seconds, until it fires,
  upgrades, is sold, or another wave starts. Maze routing is rebuilt on undo.
- Opening guidance can be skipped, and older/transferred wave-zero saves with existing weapons keep their
  automatic start. Existing save signatures and storage keys are unchanged.
- The mission rail shows the current chapter, boss objective and next threat
  on phones as well as desktop. Every cleared wave keeps the normal three-second
  autoplay countdown, including the guided opening and both sides of boss/chapter
  boundaries. Players can pause whenever they want; the existing Auto-start waves
  preference remains available. The removed preparation-break preference in older
  saves has no effect.
- The first 20 encounters have authored species combinations. Later encounters
  alternate fast packs, herds, flyers, armor, map pressure and mixed assaults.
  Aviary pressure favors flyers; maps with water introduce aquatic pressure.
  Species unlock waves, legal routes, boss schedules, spawn counts and the
  leaderboard's timing bounds remain intact. Saved placements are unchanged.
- Weapon cards identify their combat role. Upgrade panels show current/next
  damage and firing rate, actual damage dealt and kills in this run.
- The Research Lab sorts affordable upgrades first, highlights the next
  affordable purchase, shows progress toward it and groups expensive permanent
  range/selling goals in an expandable section. No research prices changed.
- Defeat reports show the main escaped species, the busiest breached route,
  damage/kill contribution, practical counter advice and a research shortcut.
  Completed waves are distinguished from the wave on which the player fell.
- The combat interface uses the homepage's charcoal/amber styling. Essential
  labels are the default; Full labels restore per-hit damage and ordinary cash
  pickups. Physical effects, enemy statuses and boss moments are retained.

## Landscape follow-up — 1.77.1

Short landscape screens and landscape devices with a coarse pointer use a
dedicated layout. A 96 px scrolling weapon rail leaves the map most of the
screen; its sticky Armory control opens all weapons and support. The HUD and
threat row take 72 px together, with 40 px primary controls. Upgrades replace
the rail in a scrolling side dock and leave the remaining map unobstructed.
Safe-area insets and dynamic viewport height account for mobile browser chrome.

The canvas fills the available stage without stretching, cropping the excess
along either axis. Panning and pinch zoom expose the rest; Overview fits the
entire route and restores the previous view when closed. Camera bounds include
both crop axes, and dock resizing/rotation keeps the selected tower visible.
Portrait retains its bottom armory and upgrade dock; desktop retains its layout.

At 844 × 390 the battlefield grows from approximately 536 × 302 visible pixels
to 748 × 318: about 47% more visible map area, or 72% of the screen. This is a
layout measurement, not a frame-rate claim.

`node tests/landscape.cjs` checks six touch layouts from 568 × 320 to 1366 × 1024,
real rail scrolling, support access, map pan/pinch, Overview, touch placement,
upgrade branches, rotation with a selected tower, desktop isolation and offline
loading. `LANDSCAPE_REVIEW_URL` and `LANDSCAPE_REVIEW_DIR` select the live target
and external evidence directory. Local evidence is under
`C:/Users/burns/dev/dino-perimeter-review/landscape1771/`.
The landscape, experience, weapon-info, homepage, Extinction and endgame suites
passed locally. The touch lifecycle check also caught and fixed a cancelled
weapon hold clicking a homepage button after a scene change. Browser emulation
does not establish physical iOS/Safari behavior or GPU performance.
The full live release verifier and six-layout landscape suite passed with zero
browser errors, including actual offline reload under cache v77. Live captures
and reports are in `production-release/` and `production-landscape/` beneath
the landscape evidence directory above; all 92 deployed assets matched Git.

## Autoplay follow-up — 1.77.2

The upgrade/boss/chapter preparation pauses and their setting were removed.
Opening guidance only waits before the very first wave; each subsequent clear
retains the existing three-second automatic countdown. The player's manual pause
and Auto-start waves preference remain available. Old `chapterBreaks` values are
ignored. No save migration is needed.

The experience and resume suites passed locally. Production passed the full
release verifier and five-layout experience suite, including actual next-wave
starts, manual pause/resume, opening and boss/chapter boundaries, old saved
preferences and offline cache v78, with zero browser errors. All 92 live assets
matched the committed release. Evidence is under
`C:/Users/burns/dev/dino-perimeter-review/autoplay1772/production-release/`
and `production-experience/`.

## Specializations

Optional, free, permanent for that tower, available after its first hardware
upgrade. Existing towers keep their original behavior until a branch is chosen.

| Weapon | Choice | Tradeoff |
| --- | --- | --- |
| Gatling | Skywatch | 45% more damage to flyers, 20% less to other targets; initially selects flyers-first targeting |
| Gatling | Suppressor | 25% more damage to non-flyers, 20% less to flyers |
| Cryo | Deep Freeze | 68% slow, 30% smaller blast radius |
| Cryo | Blizzard | 35% slow, 40% larger blast radius |

Branches preserve the hardware tiers, firing ports, cash upgrade prices and
range rules. A weaker Cryo hit cannot overwrite an active stronger slow.
Branch IDs and tower contribution totals survive run saves/export/import.
Run evidence is bounded by the weapon roster, dinosaur roster and route count;
damage counts actual health removed rather than overkill. Escaped-health totals
are capped at health actually remaining. Defeat stops further same-frame leaks.

## Ownership and verification

`js/experience.js` owns encounter selection, guidance, specializations, evidence
and the new UI hooks. `experience.css` owns its presentation. `js/game.js`
connects those hooks to authoritative combat, saves, placement, lifecycle and
camera transforms. `js/extinction.js` marks an actual firing event to expire
placement undo. Both new runtime files are in the service-worker shell.

`node tests/experience.cjs` checks actual desktop/touch controls at five layouts,
horizontal tray swipes, first placement and full-refund undo, manual starts
and a first kill within eight simulated seconds at the recommended opening,
branches and their real hit/slow tradeoffs, all seven legal guided starts,
700 legal encounter queues, boss schedules, automatic progression through the
opening/boss/chapter boundaries, manual pause, real breach/defeat reporting,
research purchase, legacy saves, setting opt-outs and offline loading.
`EXPERIENCE_REVIEW_URL` selects the public site for the same checks in isolated
browser storage; `EXPERIENCE_REVIEW_DIR` selects the evidence folder. External
analytics and leaderboard requests are blocked by this suite.

The existing resume, homepage, arsenal, weapon-info, Extinction, endgame,
presentation, Perimeter, sanctuary and leaderboard suites passed. Map suites
can select the unassisted opening; fixed world-coordinate touch tests use the
public Overview control. Touch placement accounts for the current camera.
Leaderboard tests use Node 22 and a disposable local Miniflare database;
they must not submit review scores to the production service.

Evidence: `C:/Users/burns/dev/dino-perimeter-review/experience1770/`, with
existing suites' output also retained in their normal evidence directories.
The current release audit checks version 1.77.2, cache v78 and the offline asset list.
Live verification passed exact committed hashes for all 92 assets and the full
release gameplay, mobile, saved-game and offline checks. The experience suite
also passed against production at all five layouts with zero browser errors;
captures are in `production-release/` and `production-experience/` under the
evidence directory above. No review scores were submitted to the leaderboard.

Balance sampling with a simple coverage-based automated purchaser used only
earned cash and normal combat. It reached wave 20 on Perimeter, wave 15 on
Aviary and wave 10 on Lagoon from fresh research. This is a limited strategy
sample, not an optimal-play or complete human difficulty assessment. Separate
leaderboard regressions cover full 100-wave normal combat with advanced
research. Browser tests and CPU render timings do not establish physical
iPhone/iPad GPU performance; those devices were not available for this review.
