# Browser guest film reference review

Guest art pass: September 12, 2026, **1.63.0 / cache v57**.
This records the reference decisions behind the [shared tourist renderer](../js/tourists.js)
and [blood/debris effects](../js/tourist-fx.js).

Gennaro's later proportion fix is in [the T-Rex/audio follow-up](WEB_TREX_AUDIO_REVIEW.md).
His homepage body scale is shared through `look.size`; `LOO_SEAT` derives from
`LOO_MAN` so the toilet and seated hips agree. Scale changes must also be checked
while lifted and caught by the mouth, on desktop and phone.

## Reference method

Downloaded and visually inspected twelve film stills, including costume views,
face close-ups and the fence/toilet scenes. The images informed the geometry
and material colors; they are not runtime textures. Search-engine image captions
were unreliable, so the comparisons below use the visible stills themselves.
Colors are interpreted across daylight and night/rain lighting, not sampled as
if every frame used neutral studio lighting.

The external review directory is `C:/Users/burns/dev/dino-perimeter-review/`:

- `guest-film-references/` contains the twelve original reference images.
- `guest-film-references.json` records each source page and direct image URL.
- `guest-film-comparison.html` is a standalone, embedded-image comparison of
  the film stills with actual front/three-quarter game renders. It also links
  the source pages. `guest-film-comparison.png` captures the complete sheet.
- `tourists-guest-portraits.png` shows enlarged faces and costume details.
- `tourists-guest-headings.png` and `tourists-evacuation-cast.png` cover multiple
  headings and gaits. The tourist suite also captures real homepage bite scenes.

These review files are intentionally outside the game's offline/runtime assets.
The source URLs below remain useful when another checkout lacks local captures.

## Costume corrections

| Guest | Observed reference details and resulting model changes | Film references |
|---|---|---|
| Dennis Nedry | Full, clean-shaven face; dark, wet wavy hair; heavy torso; yellow hooded raincoat open over a blue collared layer and dark shirt. Removed the old moustache. Added folded hood, dark snaps, pocket seams and a small park patch. The can remains his carried prop. | [Raincoat still, SYFY](https://www.syfy.com/syfy-wire/jurassic-park-anniversary-barbasol-can-announcement), [hood-up close-up, IMDb](https://www.imdb.com/title/tt0107290/mediaviewer/rm3325322497/) |
| John Hammond | Rounded build; short-sleeved, untucked white four-pocket shirt with vertical pleats; round wire glasses; short white beard; natural straw hat with a pale ribbon; pale segmented cane with amber top. Replaced the long sleeves, dark hatband and smooth brown cane. | [Full costume film frame](https://www.thegreenhead.com/imgs/john-hammonds-cane-with-real-mosquito-jurassic-park-prop-replica-8.jpg), [face and glasses, SYFY](https://www.syfy.com/syfy-wire/jurassic-park-reddit-fans-spot-minor-john-hammond-detail) |
| Robert Muldoon | Leaner, taller build; stone safari shirt and shorts; tan open hunting vest with pockets; shaped, creased bush hat with curled brim, vents and side snaps; knee socks and dark boots. Replaced the wood-stock scoped rifle with a black SPAS-12 silhouette: folding stock, perforated heat shield, ribbed pump and sling. Carried and dropped versions agree. | [Costume page with film frames](https://www.jpmotorpool.com/reference/cosplay/muldoon.php), [vest and weapon still](https://www.jpmotorpool.com/reference/cosplay/muldoon/full.jpg), [hat close-up](https://www.jpmotorpool.com/reference/cosplay/muldoon/hat2.jpg) |
| Tim Murphy | Chestnut/light-brown wavy hair; blue open short-sleeved overshirt, striped cream tee and navy neckerchief; tan pleated shorts; slouch socks and tan high-top shoes. Fence frames establish muddy clothing and no backpack. Added dirt variation to the overshirt, shirt stripes, neckerchief and slimmer, longer child limbs. | [Original shorts auction and costume still](https://www.icollector.com/Jurassic-Park-Tim-Murphy-s-Shorts-Joseph-Mazzello_i23631705), [fence close view](https://www.jurassicworlduniverse.com/wordpress/wp-content/uploads/2021/07/jp1-still-235.jpg), [fence wide view](https://www.jurassicworlduniverse.com/wordpress/wp-content/uploads/2021/07/jp1-still-237.jpg) |
| Donald Gennaro | High, receding grey-brown hairline; narrow, longer face and prominent nose; fine vertical-striped long-sleeved shirt; patterned taupe tie. Removed the old glasses, dark full hair cap and plain red tie. His toilet cameo stays hatless. | [Film close-up, signed-photo auction](https://www.pristineauction.com/a7912666-Martin-Ferrero-Signed-Jurassic-Park-11x14-Photo-Inscribed-Donald-Gennaro-ACOA), [toilet scene still](https://www.slashfilm.com/img/gallery/jurassic-park-needed-some-bark-to-match-the-t-rexs-toilet-busting-bite/parkbox-exclusive-donald-gennaro-1654777769.jpg) |

## Implementation and review

`js/looks.js` owns deterministic cameo wardrobes and proportions. Only phase
varies between instances; unused random hat/bag colors are cleared so identical
guests can reuse cached geometry. `js/tourists.js` builds articulated bodies,
open clothing layers, sewn panels, cloth patterns, distinct hairlines, hats,
facial features and attached props. Costume material IDs support Tim's stripes
and dirt, Gennaro's fine stripes and patterned tie, and raincoat sheen.

Skin sockets, continuous facial contours, short beard surfaces and swept hair
were checked in enlarged front and side views. Shoulder caps and sock volumes
were refined after the first comparison exposed hard joints and skin patches.
The original Canvas pose fallback still works and now shares corrected palette,
hairline/accessory choices, sleeve lengths, running costume layers and shotgun.
Its simpler special-pose bodies are less detailed than the WebGL models.

The shared renderer covers all eight wave-one evacuation looks on all seven
maps, ordinary homepage tourists, all five homepage guests, and the existing
Muldoon wave-ten scene. Blood and torn clothing continue to use each visitor's
appearance; particle/decal ownership and scene timing remain in the simulation.

## Verification and limits

`node tests/tourists.cjs` verifies all seven introductory casts, twenty guest
heading/gait views, pure drawing, actual homepage and warden bite triggers,
blood/debris lifetime and budgets, mobile layout, WebGL loss and offline loading.
`node tests/presentation.cjs` verifies homepage feeding and local/public art-panel
behavior. The earlier resume suite remains applicable: no start/save logic was
changed by the film-reference pass.

The models are detailed stylized game characters, not actor scans or exact
facial replicas. Fine fabric and face details become small at normal homepage
scale; the larger review renders expose them for inspection. Nedry retains his
glasses for the earlier chase beat although the selected rain close-ups show
them lost. Hammond's shoes are a neutral wardrobe interpretation because these
selected costume frames do not establish footwear clearly. The toilet scene
retains the game's existing exaggerated seated/trouser staging. These are
deliberate limits, not details verified by the reference pictures.

The 24-model, 192-sprite and 4,194,304-pixel caps remain unchanged. Desktop Chrome
software-WebGL checks establish functionality and bounded allocation, not real
phone GPU frame rates; hardware performance still needs device testing.
