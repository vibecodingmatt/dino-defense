# 🦖 Dino Defense — Containment Breach

A browser-based dinosaur tower defense. No installs, no build step — just open
`index.html` in any modern browser (double-click it, or right-click → Open With → Chrome).

## The goal
Dinosaurs have breached containment and are marching on your bunker. Build weapons
along the path, survive **100 waves** to secure a zone, and unlock the next of
**5 zones** across the island. A boss dinosaur attacks every 10th wave —
Blue, T-Rex, Spinosaurus, Indominus Rex, Indoraptor, and finally Giganotosaurus.

## Two currencies
- **$ Cash** — earned per kill and per wave, spent *during* a run on building and
  upgrading weapons (damage / fire rate / range, 5 levels each). Resets each run.
- **🧬 DNA** — banked *permanently* every wave you clear (even if you lose!).
  Spend it in the **Research Lab** on the menu for lasting upgrades: global damage,
  range, starting cash, base health, bounties, and ammo research for each weapon.

## Controls
| Input | Action |
|---|---|
| Click weapon card (or keys **1–8**) then click map | Build a weapon |
| **Shift**+click | Place several in a row |
| Right-click / **Esc** | Cancel placement or deselect |
| Click a placed weapon | Upgrade (2–3 levels max) / change targeting / sell (70% refund) |
| **Space** | Start next wave, or pause mid-wave |
| 1× / 2× / 4× | Game speed |

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
