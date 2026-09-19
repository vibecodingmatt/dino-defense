# Browser experience update — 1.77.0

Local implementation on September 19, 2026. Not published. Production remains
the baseline recorded in WEB_ORIENTATION.md.

## Player experience

- Portrait play gives the battlefield the remaining screen height, with a
  compact horizontal armory and an expandable all-weapons/support view. The
  canvas retains its aspect ratio and crops horizontally; touch pan and the
  Overview button expose the entire map. Overview restores the previous camera
  when closed. A selected weapon opens in a scrollable bottom dock. Landscape
  and desktop retain their side armory and anchored upgrade panels.
- A new player's opening waits for an explicit first-wave start. A legal gold
  marker suggests a useful early Gatling location. Placement highlights the covered
  road and warns about illegal or ineffective positions. The last placement
  can be undone at full cost for eight real-time seconds, until it fires,
  upgrades, is sold, or another wave starts. Maze routing is rebuilt on undo.
- The first cleared wave offers upgrade guidance. Guidance can be skipped,
  and older/transferred wave-zero saves with existing weapons keep their
  automatic start. Existing save signatures and storage keys are unchanged.
- The mission rail shows the current chapter, boss objective and next threat
  on phones as well as desktop. Boss preparation waits before waves 10, 20,
  etc.; chapter breaks wait after each boss. These breaks are optional in
  Settings. Regular automatic waves retain their three-second countdown.
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
700 legal encounter queues, boss schedules, real breach/defeat reporting,
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
The release audit checks version 1.77.0, cache v76 and the offline asset list.

Balance sampling with a simple coverage-based automated purchaser used only
earned cash and normal combat. It reached wave 20 on Perimeter, wave 15 on
Aviary and wave 10 on Lagoon from fresh research. This is a limited strategy
sample, not an optimal-play or complete human difficulty assessment. Separate
leaderboard regressions cover full 100-wave normal combat with advanced
research. Browser tests and CPU render timings do not establish physical
iPhone/iPad GPU performance; those devices were not available for this review.
