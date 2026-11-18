-- spec-lab2 §3: схема БД

CREATE TABLE teams (
  id    uuid PRIMARY KEY,
  name  text NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  city  text NOT NULL DEFAULT ''
);

CREATE TABLE players (
  id         uuid PRIMARY KEY,
  team_id    uuid NOT NULL REFERENCES teams (id),
  full_name  text NOT NULL,
  number     smallint NOT NULL CHECK (number BETWEEN 1 AND 99),
  UNIQUE (team_id, number)
);

CREATE TABLE tournaments (
  id            uuid PRIMARY KEY,
  name          text NOT NULL,
  starts_on     date NOT NULL,
  status        text NOT NULL DEFAULT 'registration'
                CHECK (status IN ('registration', 'in_progress', 'finished')),
  organizer_id  text NOT NULL
);

CREATE TABLE tournament_entries (
  tournament_id  uuid NOT NULL REFERENCES tournaments (id),
  team_id        uuid NOT NULL REFERENCES teams (id),
  registered_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tournament_id, team_id)
);

CREATE TABLE matches (
  id             uuid PRIMARY KEY,
  tournament_id  uuid NOT NULL REFERENCES tournaments (id),
  round          smallint NOT NULL CHECK (round >= 1),
  home_team_id   uuid NOT NULL REFERENCES teams (id),
  away_team_id   uuid NOT NULL REFERENCES teams (id),
  status         text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'finished')),
  home_goals     smallint CHECK (home_goals >= 0),
  away_goals     smallint CHECK (away_goals >= 0),
  CHECK (home_team_id <> away_team_id),
  CHECK ((status = 'finished') = (home_goals IS NOT NULL AND away_goals IS NOT NULL)),
  -- друга лінія захисту від подвійного розкладу (AC9)
  UNIQUE (tournament_id, home_team_id, away_team_id)
);

CREATE INDEX matches_tournament_idx ON matches (tournament_id, round);
