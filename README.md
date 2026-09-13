# 🦖 Dino Defense — Containment Breach

A browser-based dinosaur tower defense. Play at
[Dino Defense](https://vibecodingmatt.github.io/dino-defense/), or serve this
directory over local HTTP for development. No app build step is required.
Direct `file:` previews can use fallback art when fetched assets are unavailable.

For maintenance, start with [the browser orientation](docs/WEB_ORIENTATION.md).

## The goal
Dinosaurs have breached containment and are marching on your bunker. Build weapons
along the path, survive **100 waves** to secure a zone, and unlock the next of
**7 zones** across the island. The roster has 33 dinosaurs, including nine bosses
such as Blue, T-Rex, D-Rex, the White Pteranodon and Mosasaurus.

## Two currencies
- **$ Cash** — earned per kill and per wave, spent *during* a run on building and
  upgrading nine weapons with 1–3 hardware upgrades each. Resets each run.
- **🧬 DNA** — banked *permanently* every wave you clear (even if you lose!).
  Spend it in the **Research Lab** on the menu for lasting upgrades: global damage,
  range, starting cash, base health, bounties, and ammo research for each weapon.

## Controls
| Input | Action |
|---|---|
| Click weapon card (or keys **1–9**) then click map | Build a weapon |
| **Shift**+click | Place several in a row |
| Right-click / **Esc** | Cancel placement or deselect |
| Click a placed weapon | Upgrade / change targeting / sell (70% refund) |
| **Space** | Start next wave, or pause mid-wave |
| 1× / 2× / 4× / 10× | Game speed |

**On phones/tablets:** the layout stacks (map on top, armory below). Tap a weapon,
tap the map to preview placement, then tap the same spot again to build.

## Tips
- 🔥 Flame Throwers and other ground weapons **can't hit flyers** (Pteranodons,
  Dimorphodons, Quetzalcoatlus) — keep some air coverage.
- The Indominus Rex **camouflages**. A 📡 Sonic Emitter reveals it.
- Armored dinos (Ankylosaurus, Triceratops) shrug off weak hits — 🎯 Snipers pierce armor.
- Losing isn't wasted: DNA persists. Research in the Lab, then try the zone again.
- 🚀 Missile Batteries fire **an extra rocket per upgrade** (1 → 2 → 3).
- 💣 The Mortar devastates herds at long range but can't hit flyers or anything
  too close — cover its blind spot.
- **Testing / sandbox:** Settings → 🛡 **Invincibility** (escaped dinos deal no damage).

Progress saves automatically in your browser (localStorage + an IndexedDB backup).
Use Settings → **Copy save code** to back up progress or move it between devices.

*An affectionate homage to a certain dinosaur park that spared no expense.*

## Local art inspection

The browser's weapon and dinosaur inspection panels are local art tools. They
appear on `localhost`, its subdomains, loopback IP addresses, and `file:` previews.
Public hosts keep the buttons hidden and do not initialize the panels, including
when a URL has `?test=1`. Gameplay still uses the updated models and weapons.
Run `node tests/presentation.cjs` to check local/public behavior and homepage art.
