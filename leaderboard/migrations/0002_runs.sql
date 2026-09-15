CREATE TABLE runs (
  run_id TEXT PRIMARY KEY,
  player TEXT NOT NULL,
  map INTEGER NOT NULL CHECK (map BETWEEN 0 AND 6),
  difficulty INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 1000),
  started INTEGER NOT NULL,
  submitted_health INTEGER CHECK (submitted_health BETWEEN 0 AND 100)
);
CREATE INDEX runs_expiration ON runs(started);
