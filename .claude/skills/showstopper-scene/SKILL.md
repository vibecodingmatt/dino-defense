---
name: showstopper-scene
description: Build or modify a home-screen "showstopper" set piece — the cinematic Jurassic Park cameos that play in the menu backdrop (Tim on the electric fence, Blue and Muldoon, the lawyer in the outhouse, Hammond, Nedry). Use when adding a new scene, changing an existing one, adjusting how often they run or in what order, or touching the menu backdrop's scenery, depth sorting or scheduler. Triggers on "showstopper", "home screen scene", "menu backdrop", "cameo", "set piece", or naming any of the cameo characters.
---

# Home-screen showstopper scenes

The menu backdrop (`#menuDinos` canvas, behind the whole home screen) runs an
ambient diorama: giant bosses roaming a fog horizon, visitors fleeing, and a
handful of **set pieces** — scripted film cameos. This is how they are built.

Everything lives in three files. There is no build step; open `index.html`.

| file | what it holds |
|---|---|
| `js/looks.js` | `*Look()` factories for every human, and `MENU_LINES` (their speech-bubble text) |
| `js/draw.js` | tourist **poses** (`drawTourist`, `drawTouristSeated`, `drawTouristClimb`, …) and all procedural art |
| `js/game.js` | backdrop scenery, scene state machines, the scheduler, and `menuScene()` |

## Anatomy of a scene

Copy the fence (`menuTimmy`) or the outhouse (`menuLoo`) — they are the two
worked examples. Every scene needs six pieces:

1. **A look** — `js/looks.js`, e.g. `gennaroLook(size)`. Start from
   `randomTouristLook(size, true)` (the `true` suppresses the random kid roll),
   then `Object.assign` the character on top. Add a line to `MENU_LINES` keyed
   by the same `hero` string.
2. **A pose** (only if no existing one fits) — `js/draw.js`. Conventions:
   unit space, facing `+x`, **origin on the ground under the hips**, caller
   translates/flips/scales. Never reference `clamp`/`rand` in `draw.js` — the
   lab pages load it without `game.js`.
3. **Scenery**, if the scene needs a structure — a `menuXAt(w, h)` geometry
   function plus a `drawMenuX()` painter. See below for the rules.
4. **State + machine** — `let menuX = null`, an `updateMenuX(dt, w, h, geom)`
   with named stages, and an `endMenuX()` that is safe to call at any moment.
5. **Scheduling** — a name in `menuCard`, a weight in `MENU_ODDS`, a branch in
   `spawnMenuDino`, and a clause in `menuStageBusy()`.
6. **A preview harness** — `?menuX=SECONDS`, modelled on `?menufence` /
   `?menuloo`.

## The scheduler

```
menuCard   = ['timmy','blue','lawyer','hammond','nedry']   // opening order, per page load
MENU_ODDS  = {timmy: .24, blue: .20, lawyer: .18}          // the weighted draw after that
```

- `spawnMenuDino(w, h, forcedKey, forceScene)` picks the scene: the card first,
  then a **weighted draw over scenes that can actually run right now**, with an
  ordinary pack taking the remainder. `forceScene` is a scene NAME, not a flag.
- `menuStageBusy()` gates spawning so two set pieces never overlap. It must
  return true for the **whole** scene, *including the walk-on before the scene
  object exists* — check the pending `d.toWhatever` flag on the dinosaur, or the
  next scene slips in during that window.
- A scene that can't take its turn must **not** spend its card slot.

## Traps that have already cost a session each

- **`G.time` does not advance on the menu.** It only ticks inside `render()`,
  which never runs while the menu is up. Use **`menuT`**. Anything keyed to
  `G.time` in backdrop code is frozen at zero and simply will not animate.
- **`menuScene()` is called inside a `try{}catch{}`** in the main loop. A throw
  silently blanks the backdrop instead of erroring. Preview harnesses therefore
  call `menuScene()` **directly** so exceptions surface.
- **Scene state must not outlive its gate release.** While the state object
  exists the scheduler treats that scene as spoken for, so lingering debris
  parked inside it quietly bars the scene from the next draw *every time it
  runs*. Hand leftovers (ash, wreckage) to standalone backdrop state and end the
  scene. This silently skewed the fence's frequency for a whole version.
- **Never use a fixed fallback in the weighted draw.** Pointing every refused
  turn at one scene makes that scene the most common thing on the backdrop.
  Re-roll proportionally over what's available.
- **Depth**: the backdrop draws in two bands split at the scenery's ground line
  (`menuGround`). Structures must sit **partway down** the roaming band or
  nothing is ever behind them and the sorting has nothing to sort. Actors are
  banded by their **dinosaur's** footing, not their own, so a chase can't
  straddle a structure.
- **Hidden-then-revealed actors**: keep them `tr.hidden` until the reveal.
  That's what lets the intact structure be drawn *before* the front band without
  a third draw pass.
- **Handing an actor to the eat timeline**: set `tr.caught = true; d.eat = {t:0, tr}`
  and let the shipping animation do the lift/thrash/gulp — do not reimplement it.
  Position the dinosaur off `menuMouthReach(d)`, not its body size, or it stops a
  head short and reads as losing interest.
- **Dropped props** settle to `p.restRot`; without it they inherit the rifle's
  `1.62` and planks stand on end.
- **Narrow screens**: scenery scaled strictly proportionally is unreadable on a
  phone. Clamp against **width as well as height**, and give menu actors a high
  size floor. Do *not* lift the roaming band on tall layouts — everything above
  the dock is the title block, so it trades a tile for the wordmark.

## Verifying

Screenshots alone are not enough; these are long state machines. There is no
test runner — drive the real page with Playwright (`playwright-core` + the
Chromium already in `~/AppData/Local/ms-playwright`, served over a tiny static
`http.createServer`). Two harness shapes, both worth rebuilding:

- **Soak** — reset the stage, force the scene, step `menuScene(1/60)` to
  completion, ~25 runs per viewport at 390x844 / 820x1180 / 1400x900 / 1920x1080.
  Assert: every stage fires **in order**, the scene always clears, no orphaned
  actors (`menuTourists.filter(hero===…)` is empty), and no page errors.
- **Schedule** — one long uninterrupted run; assert the opening order, count
  frames where two set pieces are live at once (must be 0), and tally the
  post-card mix against `MENU_ODDS`.

Harness gotchas: seed `Math.random` while staging or two staged times are two
different scenes; and **wait on a condition, not the clock** — the page makes its
own first spawn 1.2 s after load and any fixed sleep races it (this produced
flaky results twice).

## Shipping checklist

- `VERSION` in `js/data.js`, plus the `CHANGELOG` entry — **follow the
  `whats-new` skill**, which owns the one-entry-per-day and brevity rules and
  the audit that catches violations.
- Bump `CACHE` in `sw.js` to force a clean re-precache.
- Confirm the other harnesses still pass: `?test=1&menudino=1`, `&menuhunt=`,
  `&menueat=`, `&clevertest=1`, `&mazecheck=1`, and all three lab pages.
