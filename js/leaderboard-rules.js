'use strict';
// Shared by the browser and Worker. These are plausibility bounds, not combat
// estimates: upgraded weapons may destroy every spawn immediately at 10x.
globalThis.LeaderboardRules = Object.freeze({
  lifetime: 90 * 86400000,
  spawnCount(wave) {
    return Math.min(60, 8 + Math.floor(wave * 0.7))
      + (wave % 10 === 0 ? ([60, 80, 90].includes(wave) ? 2 : 1) : 0);
  },
  spawnTotal(from, through) {
    let n = 0;
    for (let w = from; w <= through; w++) n += this.spawnCount(w);
    return n;
  },
  minimumActiveMs(from, through) {
    let seconds = 0;
    for (let w = from; w <= through; w++) {
      const count = Math.min(60, 8 + Math.floor(w * 0.7));
      seconds += 1 + (count - 1) * Math.max(0.42, 0.85 - w * 0.004) * 0.8 * 0.55;
    }
    // Half the shortest ordinary spawn schedule. No combat, travel, boss,
    // inter-wave or setup time is assumed; a full run's floor is about 57s at 10x.
    return Math.floor(seconds * 1000 * 0.5);
  },
  compare(a, b) {
    return a.difficulty - b.difficulty || a.wave - b.wave
      || Number(a.cleared) - Number(b.cleared) || a.health - b.health;
  }
});
