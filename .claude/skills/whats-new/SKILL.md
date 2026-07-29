---
name: whats-new
description: Rules for the player-facing "📜 What's New" page (the CHANGELOG in js/data.js) and the ship checklist that goes with it. Use this WHENEVER a change is being shipped or released — bumping VERSION, adding or editing a changelog entry, writing release notes, or finishing any player-visible feature or fix. Also use when asked to clean up, shorten, audit, or re-date the What's New page. Triggers on "ship", "release", "version bump", "changelog", "what's new", "release notes", "update the page", or any request to publish a change to players.
---

# The What's New page

Players read this modal from the home screen (`v1.x.x · 📜 what's new`). It is a
**recap for kids and parents**, not a commit log. `CHANGELOG` in `js/data.js`
feeds it; `buildChangelog()` in `js/game.js` renders `v{v} · {date}` above each
entry's bullets.

Every past session that touched this page got the same two things wrong. Both
rules are non-negotiable.

## Rule 1 — one entry per day, and the date must be real

- **One entry per calendar DAY**, newest first. An entry is a *daily recap*, not
  a version. Two entries may never carry the same `date` string.
- **Shipping again on the same day**: edit that day's existing entry — fold the
  new items in and bump its `v` to the new version. Do **not** add a second
  entry, even for a different version number.
- **Shipping on a new day**: add one new entry at the top.
- **Check the actual calendar date** before writing it (today's date is in the
  session context; `date` at the shell also works). Never copy the date from the
  entry above — that is exactly how duplicates get created.
- Format is `Mon D, YYYY` — `Jul 28, 2026`.

## Rule 2 — ONE bullet per ENHANCEMENT

The unit is the **enhancement**, not the change and not the day. Four separate
things a player would care about get four bullets. But one thing that took
fifteen commits still gets **one** bullet.

This is the failure mode to watch for, because it is the one that keeps
happening:

> The Jul 28 release added a fence to the backdrop, a power cut, Tim Murphy's
> climb, and his landing as a heap of ash. That is **one** enhancement — a
> scene — and it gets **one** bullet. It was shipped as four.

**The test**: if two bullets name the same feature, scene, weapon, map, or
screen, they are one bullet. Merge them and keep whichever detail is the most
fun to read.

- **One short sentence per bullet.** The WHAT, not the HOW: "Fixed the map
  zooming mid-game", not the story of the top bar wrapping to an extra line.
- **Only what a player would care about.** Internal work, refactors, and tuning
  nobody can feel do not get a bullet at all.
- **Sweep up the small stuff** into a single `'🐛 Fixes: …'` bullet, or just
  `'🐛 Bug fixes and improvements.'` — a good, honest line. Reach for it rather
  than inventing detail to fill space.
- **Never**: internal numbers, formulas, colour codes, file or function names,
  or version numbers inside the text. Player-facing figures are fine
  ("from wave 1", "10× game speed").
- **Under ~120 characters** per bullet, so each reads at a glance.
- One emoji lead, then a space. Keep the playful voice — brief is not dry.

No hard cap: a release with nine genuine features gets nine bullets. But past
about eight, stop and re-check that you are not describing one enhancement
several times over.

Worked example — the Jul 28 release, which shipped as seven bullets and should
have been five, because the fence and Tim's climb are one scene, and the depth
sorting was part of the phone rework:

```js
{v: '1.59.1', date: 'Jul 28, 2026', items: [
  '⚡ A new home-screen scene: the power cuts out, and Tim Murphy makes a run at the electric fence.',
  '🚽 A tyrannosaur takes the front off the park outhouse and lifts the lawyer clean off the toilet.',
  '🎞️ Every visit now opens with the full cameo card in order, and the scenes never overlap.',
  '📱 The backdrop was rebuilt for phones, with bigger giants and scenery sized to the screen.',
  '🐛 Fixed frozen home-screen animation.',
]},
```

## A release with nothing player-facing gets no entry

Some ships are invisible from the outside — a refactor, a save-integrity or
security change, a fix no player could notice. Those get a `VERSION` and `CACHE`
bump and **no changelog entry at all**. An entry with nothing worth reading is
worse than no entry, and some changes are actively better left unannounced:
telling players that trophies are forfeited on edited saves also tells them
saves can be edited. In that case the audit's `TOP ENTRY v … != VERSION` line is
expected — it is a prompt to make the call, not a failure.

## Before you finish, audit the whole file

Do not only check the entry you just wrote — the point of the audit is to catch
drift that crept in earlier:

```bash
node -e "
const src=require('fs').readFileSync('js/data.js','utf8');
const {VERSION,CHANGELOG}=new Function(src+'; return {VERSION,CHANGELOG};')();
const STOP=new Set(['dinosaur','dinosaurs','weapon','weapons','screen','player','players','island','before','through','instead','without','better','around','little','across','banked','proper','properly','anything','everything']);
const seen=new Map();
for(const c of CHANGELOG) seen.has(c.date)?console.log('DUP DATE:',c.date):seen.set(c.date,1);
if(CHANGELOG[0].v!==VERSION) console.log('TOP ENTRY v',CHANGELOG[0].v,'!= VERSION',VERSION);
const key=i=>new Set((i.toLowerCase().match(/[a-z]{6,}/g)||[]).filter(w=>!STOP.has(w)));
for(const c of CHANGELOG){
  if(c.items.length>8) console.log('CHECK FOR SPLITS:',c.v,'has',c.items.length,'bullets');
  for(const i of c.items) if(i.length>120) console.log('TOO LONG:',c.v,i.length,i.slice(0,70)+'…');
  for(let a=0;a<c.items.length;a++) for(let b=a+1;b<c.items.length;b++){
    const kb=key(c.items[b]), sh=[...key(c.items[a])].filter(w=>kb.has(w));
    if(sh.length>=2) console.log('POSSIBLE SPLIT:',c.v,'share['+sh.join(', ')+']',c.items[a].slice(0,44),'||',c.items[b].slice(0,44));
  }
}
console.log('audit done —',CHANGELOG.length,'entries,',CHANGELOG.reduce((n,c)=>n+c.items.length,0),'bullets');
"
```

A clean run prints only the `audit done` line.

`POSSIBLE SPLIT` flags two bullets in the same entry sharing distinctive words,
which usually means one enhancement got written up twice. Read the pair and
judge — two features that merely share vocabulary are fine to keep.

**Do not treat a clean audit as proof.** The check only catches splits that
reuse the same *words*. Run against the Jul 28 entry as originally shipped, it
flagged the three backdrop bullets but missed the fence and Tim Murphy's climb
— the clearest split in the file — because between them they share only the
word "fence". Judgement is the real check here; this is a backstop. Reading the
entry and asking "how many separate things is this?" is the step that works.

`CHECK FOR SPLITS` on an entry over eight bullets is the same prompt by a
cruder measure. A long entry is not automatically wrong: the Jul 15 release
genuinely shipped ten distinct features and keeps ten bullets.

## Ship checklist

1. `VERSION` in `js/data.js`.
2. The `CHANGELOG` entry, per rules 1 and 2 above.
3. `CACHE` in `sw.js` — bump it or returning players get the stale precache.
4. Run the audit above.
5. Open the home screen and read the modal itself; the rendered bullets are what
   ships, not the source.
