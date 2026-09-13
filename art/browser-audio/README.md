# Browser sound effects

`js/audio-fx.js` authors 42 original effects, each with three deterministic
performances. `js/game.js` owns the simulation triggers, gesture unlock, score
ducking, camera-relative stereo and global/per-weapon controls. Music retains
its existing instruments and separate hall.

Rebuild the bank after changing sound recipes. Trigger-only changes in
`js/game.js` do not need a new bank. Inspect callers first when a cue is unwanted;
legacy recipes can remain unused without affecting gameplay.

```powershell
node art/browser-audio/export-bank.cjs
node tests/audio-fx.cjs
```

The game routes its nine launches to `shot`, `flame`, `gas`, `snipe`, `cryo`,
`zap`, `pulse`, `missile` and `thoomp`. Cryo impact is `frost`, artillery impact
is `shellImpact`, and Tesla chain hops use `arc`. Finishers dispatch through
`WeaponFX.update` during simulation. Preserve the position, weapon and upgrade
options passed into `SFX`; they control stereo, timbre and per-weapon muting.

`assets/audio/effects-v1.bank.gz` contains a little-endian four-byte JSON-header
length, the UTF-8 header, then signed 16-bit mono PCM at 32 kHz. Header offsets
refer to the PCM payload. It contains 126 performances: 8,037,120 PCM bytes,
5,928,222 bytes compressed. The authored source is also the fallback if fetch or
decompression fails. No recordings or samples from the films are used.

The bank loads asynchronously without opening an AudioContext. A real gesture
unlocks sound, including when Music is off. Playback copies the selected PCM
into an LRU cache capped at 12 MiB; conversion of the entire bank took 16 ms in
headless desktop Chrome. The encoded bank also occupies about 8 MiB in memory.
Cache misses decode existing PCM; synthesis is normally confined to authoring.

Each voice uses one buffer source, gain and stereo panner. Dry output and two
short filtered outdoor reflections feed a high-pass, low-pass and compressor.
Combat has a per-cue clock and a cap of 24 active voices (18 on touch devices),
with four reserved slots for important cues. Replaced sources fade for 12 ms
and disconnect on completion; a brief fade can overlap its replacement.
Upgrades deepen playback slightly, and all three performances rotate to keep
repeated gunfire from playing the same sample. Game-speed changes do not pitch
up the audio or queue old shots for later playback.

The global mute fades the shared output and stops active effects. Per-weapon
mute stops that weapon's active voices and blocks its launches, impacts and
finishers. Pause, leaving the match and hiding the tab retire active effects.
Rendering never starts sound. Boss roars briefly lower the music; its existing
toggle still controls both the score and its reverb return.

Dinosaur deaths do not trigger creature vocalizations. Physical weapon impacts
and finishers still play; living creature ambience and entrance roars remain.
Ambient calls require at least one living dinosaur on the field.
Perimeter Fence disables that unrelated random snarl/bellow timer entirely;
the decorative paddock raptors are silent. Intentional boss entrances and
scripted encounters retain their sound cues. The six sanctuary scenes also
emit no additional sound effects.

The test checks bank integrity, audible signal/headroom, distinct variations,
actual firing and impact routes for all nine weapons, deaths of all 33 species
and nine bosses without vocal cues, physical cryo finishers, full-cache eviction,
priority voice replacement, source cleanup, offline stereo rendering, mutes,
gesture handling, mobile budget, missing-bank fallback and offline reload.
Listening artifacts and signal reports live outside the repository under
`C:/Users/burns/dev/dino-perimeter-review/audio1650/`. Automated signal checks
do not establish subjective listening quality; audition the renders when audio
playback is available. `battle-mix.wav` is rendered through the actual mix graph,
while `sound-palette.mp3` presents the authored samples in isolation.
