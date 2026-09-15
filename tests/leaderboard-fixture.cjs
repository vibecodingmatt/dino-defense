'use strict';
// Test-only combat accelerator. Exercise the real wave generator, spawn queue,
// death accounting, checkpoints and victory hook; never add a production bypass.
// The browser clock advances with the simulated 10x gameplay. Service tests
// must separately allow that much real server time (or age their isolated DB).
exports.installClock = async page => page.evaluate(() => {
  if (window.leaderboardTestClock !== undefined) return;
  window.leaderboardTestClock = 0;
  const now = performance.now.bind(performance);
  Object.defineProperty(performance, 'now', {value: () => now() + window.leaderboardTestClock});
});
exports.advanceWaves = async (page, through = 100, combat = false) => page.evaluate(({through, combat}) => {
  G.paused = true;
  let steps = 0;
  while (G.wave < through || G.waveActive) {
    if (!G.waveActive) startWave();
    G.speed = 10;
    window.leaderboardTestClock += 5;
    step(.05);
    for (const d of combat ? [] : G.dinos) {
      d.noHurt = false; d.cloaked = false;
      damage(d, Number.MAX_VALUE, true, null);
    }
    // Rendering/audio are covered by other suites. Keep this run focused on
    // gameplay accounting rather than retaining thousands of visual effects.
    G.fx = []; G.texts = []; G.corpses = []; G.decals = [];
    if (!combat) G.clever = null;
    G.tourists = []; G.snatch = null;
    if (++steps > 200000) throw Error('Wave simulation stalled at ' + G.wave);
  }
  if (through === 100 && !G.over) victory();
  return {steps, progress: Leaderboards.saveProgress()};
}, {through, combat});

exports.loseNextWave = async page => page.evaluate(() => {
  G.paused = true; startWave();
  for (let i = 0; i < 200 && !G.dinos.length; i++) { leaderboardTestClock += 5; G.speed = 10; step(.05); }
  if (!G.dinos.length) throw Error('No dino spawned for defeat fixture');
  G.lives = 1;
  const d = G.dinos[0]; d.entranceT = 0; d.dist = G.paths[d.pathI].len + 10;
  leaderboardTestClock += 5; step(.05);
  if (!G.over || G.lives !== 0) throw Error('Dinosaur did not break through');
  return {wave: G.wave, progress: Leaderboards.saveProgress()};
});
