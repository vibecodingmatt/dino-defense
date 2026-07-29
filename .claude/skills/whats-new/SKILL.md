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

## Rule 2 — ONE LINE per entry. Never a list.

`items` holds exactly **one** string. Not two, not "just a couple for a big
release" — one. The purpose of this page is to tell players updates are
happening and roughly what changed, not to itemise the release.

- **One sentence, high level.** Name the one thing a player would notice. If a
  release did five things, the line covers the headline and the rest go
  unmentioned — they are not missing, they are *summarised*.
- **`'🐛 Bug fixes and improvements.'` is a perfectly good line** when nothing
  is headline-worthy. Reach for it often. It is not filler here; it is the
  honest answer, and it beats inventing detail to fill space.
- **Never enumerate.** No sub-features, no per-weapon or per-map breakdowns, no
  "plus A, B, C and D". If the line needs a semicolon or a second clause list,
  it is trying to be three items.
- **The WHAT, not the HOW.** "Fixed the map zooming mid-game" — not the story of
  the top bar wrapping to an extra line.
- **Never**: internal numbers, formulas, colour codes, file or function names,
  or version numbers inside the text. Player-facing figures are fine
  ("from wave 1", "10× game speed").
- **Under ~120 characters**, so it reads at a glance.
- One emoji lead, then a space. Keep the playful voice — brief is not dry.

Worked example. A release that added an electric fence set piece, a Tim Murphy
climb, an outhouse scene, a cameo scheduler, depth sorting, a phone layout pass
and an animation fix becomes, in full:

```js
{v: '1.59.1', date: 'Jul 28, 2026', items: [
  '🎬 New film cameos on the home screen, and a backdrop rebuilt for phones.',
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
const seen=new Map();
for(const c of CHANGELOG) seen.has(c.date)?console.log('DUP DATE:',c.date):seen.set(c.date,1);
if(CHANGELOG[0].v!==VERSION) console.log('TOP ENTRY v',CHANGELOG[0].v,'!= VERSION',VERSION);
for(const c of CHANGELOG){
  if(c.items.length!==1) console.log('NOT ONE LINE:',c.v,'has',c.items.length,'items');
  for(const i of c.items) if(i.length>120) console.log('TOO LONG:',c.v,i.length,i.slice(0,70)+'…');
}
console.log('audit done —',CHANGELOG.length,'entries,',CHANGELOG.reduce((n,c)=>n+c.items.length,0),'items');
"
```

A clean run prints only the `audit done` line, and `entries` and `items` must be
**the same number** — that is the whole rule in one glance. `NOT ONE LINE` means
someone started itemising again; collapse it back to a single summary sentence.

## Ship checklist

1. `VERSION` in `js/data.js`.
2. The `CHANGELOG` entry, per rules 1 and 2 above.
3. `CACHE` in `sw.js` — bump it or returning players get the stale precache.
4. Run the audit above.
5. Open the home screen and read the modal itself; the rendered bullets are what
   ships, not the source.
