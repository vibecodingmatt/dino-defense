# Homepage and social presentation

The 1.67.0 homepage preserves the animated dinosaur/guest scenes. The interface
uses charcoal surfaces, warm ivory text, amber primary actions and a small fence
shield brand. `home.css` owns the homepage and common dialog presentation;
`style.css` retains the game HUD and background scenery. `js/home.js` owns
sharing, focus management and the saved home-animation preference. Game/save
entry and map thumbnails remain in `js/game.js`.

Play starts the Perimeter at the selected difficulty; an existing save changes
it to Continue and shows its zone, wave and difficulty. All seven map buttons
still launch their respective zones. Choosing a new zone retains the existing
saved-run confirmation. The native difficulty disclosure clamps to unlocked
levels. Research, collections, studio and achievements share a progress area;
help and settings live in the header. Phone controls have accessible names,
and common dialogs trap focus, close with Escape and restore their opener.
Background animation follows reduced motion until the player chooses an
explicit preference in Settings. Advanced settings retain the existing password
gate within a collapsed disclosure.

## Scenery follow-up (1.68.0)

`js/home-scenery.js` paints the weathered outhouse, broken shell, roof/door
fragments and electric fence. Five bounded Canvas tiles cache timber grain,
roof panels, porcelain, concrete/steel pylons, cable insulators and hardware.
The scene uses fewer than one million cached pixels after both cameos. No new
external artwork, packages or WebGL feature is needed for these structures.

Electric arcs use the actual contact point set by Tim's animation and stable
noise derived from the scene clock. Drawing does not consume simulation random
numbers or emit particles. Sparks have short directional trails; dust and smoke
have soft radial falloff. The door and roof separate as recognizable pieces,
bounce once, settle flat and expire. Gennaro's seat and actor still share
`LOO_MAN`, `LOO_SEAT` and `LOO_SEAT_X`; the existing seated lift/bite timing stays
intact. Tim's landing remains the existing exaggerated cartoon ash gag.

The outhouse moves into the open right-hand scene area on wide screens. Portrait
phones reserve a strip below Play and above the progress hub, with the scenery
ground capped inside the viewport. This gives the cameos room without moving
the primary action below the fold. The expanded pylon feet remain on-screen.

The saved/reduced-motion preference freezes both the scene clock and Tim's
smoke emission. Smoke emission is time-based rather than render-frame-based.
Original scene ordering, guest/dinosaur models, audio and gameplay are retained.

## Social image and metadata

`assets/social/containment-breach-v1.jpg` is a 1200 x 630 JPEG, about 215 KiB.
It is original promotional illustration made with the built-in image generation
tool, not a gameplay capture. The selected output is stored in the repository;
the large source stays in the external review folder. The SVG fence brand and
interface symbols are authored vectors. PWA PNG icons are rasterized from that
brand with a safe margin.

The title, description, canonical URL, Open Graph properties, large-image
Twitter card and VideoGame JSON-LD are present in the HTML head, so crawlers
need no JavaScript. Image URLs are absolute HTTPS URLs with an explicit version
in the filename. No external fonts, icon packages or framework are required.
The social JPEG is fetched by crawlers and is not a gameplay/offline dependency.
All new interface files are in the service-worker shell.

The [Open Graph specification](https://ogp.me/) defines the title, type, image,
URL and structured image dimensions/type/alt properties used here.
Native sharing falls back to copying the canonical URL, then to a selectable
link if clipboard access is unavailable. Cancelling native sharing stays quiet.
Actual social networks control their own cropping and cache refresh; the tests
establish crawler-readable markup and image delivery, not an authenticated
Facebook, X or messaging-app preview.

Final built-in image prompt:

> Use case: ads-marketing. Asset type: wide 1200 by 630 social sharing banner for the browser tower defense game DINO DEFENSE. Create a polished cinematic illustrated game key art poster. Dark charcoal and deep jungle teal atmosphere, warm amber warning lights. A highly detailed and imposing Tyrannosaurus rex on the RIGHT half emerging through a breached electrified jungle fence, wet textured brown scales, beautiful amber eye, parted jaws with convincing teeth, strong readable silhouette, mist and a few sparks, distant searchlights. Slight low camera angle, suspense and adventure, no gore and no people, high-end game illustration rather than claiming a gameplay screenshot. LEFT half has intentional nearly black negative space for bold immaculate typography. Exact text: small restrained top-left brand 'DINO DEFENSE'; very large ivory condensed bold headline on left across three short lines 'THE FENCES' / 'ARE DOWN.' / 'NOW WHAT?'; small warm amber bottom-left line 'BUILD. UPGRADE. SURVIVE.'; small ivory subline 'Play free in your browser'. Strong typographic hierarchy, flat clean text without glow, plenty of margin, all essential content inside centered safe area. Dinosaur head is the dominant visual on the right, no logos from existing film franchises, no UI mockup, no watermarks. Wide landscape approximately 1.91:1.

## Verification

Run `node tests/homepage.cjs` for seven desktop/tablet/phone dimensions, visible
Play, touch targets, keyboard navigation and dialogs, new/resumed game entry,
save-discard cancellation, sharing/clipboard failure paths, reduced motion,
no-JavaScript metadata/image checks and offline interface loading.

`HOME_REVIEW_URL` accepts the ordinary production URL for the same checks.
`HOME_REVIEW_DIR` chooses an external output directory. Tests use disposable
browser storage and never read or change the owner's saved game. Run the
presentation and resume suites too when changing their shared contracts.

For scenery, run `node tests/home-scenery.cjs` plus the presentation and tourist
suites. `SCENERY_REVIEW_URL` accepts production; `SCENERY_REVIEW_DIR` selects an
external capture folder. The focused suite steps through the actual scenes on
desktop, 390 px and 320 px phones, including breakup, seated attachment, bite,
cleanup, climb, warning, contact arcs and ash landing. It also checks redraw
purity, paused particle state, bounded caches, Canvas fallback and offline loading.
CPU submission timing is recorded on a 1440 x 1000 canvas; this is not a phone
GPU frame-rate benchmark. Evidence is under `dino-perimeter-review/scenery1680/`.

The daily release recap retains ten separate enhancements: tourists, dinosaur
anatomy, Therizinosaurus, homepage, sharing, arsenal/finishers, audio, Sector 7,
six other maps, and fixes. Earlier long days are also distinct enhancements;
the audit's long-entry prompts were reviewed rather than mechanically truncated.
The 1.68.0 scenery update is folded into the homepage enhancement. The scanner's
shared-word prompt with the audio item is coincidental: visual fence arcs and
the previously released sound bank are separate work.
