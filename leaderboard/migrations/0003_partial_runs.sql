ALTER TABLE scores ADD COLUMN wave INTEGER NOT NULL DEFAULT 100 CHECK (wave BETWEEN 1 AND 100);
ALTER TABLE scores ADD COLUMN cleared INTEGER NOT NULL DEFAULT 1 CHECK (cleared IN (0, 1));
ALTER TABLE runs ADD COLUMN start_wave INTEGER NOT NULL DEFAULT 1 CHECK (start_wave BETWEEN 1 AND 100);
ALTER TABLE runs ADD COLUMN submitted_wave INTEGER CHECK (submitted_wave BETWEEN 1 AND 100);
ALTER TABLE runs ADD COLUMN submitted_cleared INTEGER CHECK (submitted_cleared IN (0, 1));
UPDATE runs SET submitted_wave = 100, submitted_cleared = 1 WHERE submitted_health IS NOT NULL;
DROP INDEX scores_ranking;
CREATE INDEX scores_ranking ON scores(map, difficulty DESC, wave DESC, cleared DESC, health DESC, achieved ASC, player ASC);
