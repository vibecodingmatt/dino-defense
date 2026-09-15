CREATE TABLE scores (
  player TEXT NOT NULL,
  map INTEGER NOT NULL CHECK(map BETWEEN 0 AND 6),
  initials TEXT NOT NULL CHECK(length(initials) = 3 AND initials NOT GLOB '*[^A-Z0-9]*'),
  difficulty INTEGER NOT NULL CHECK(difficulty BETWEEN 1 AND 1000),
  health INTEGER NOT NULL CHECK(health BETWEEN 0 AND 100),
  achieved INTEGER NOT NULL,
  run_id TEXT NOT NULL,
  version TEXT NOT NULL,
  PRIMARY KEY (player, map)
);
CREATE INDEX scores_ranking ON scores(map, difficulty DESC, health DESC, achieved ASC, player ASC);
