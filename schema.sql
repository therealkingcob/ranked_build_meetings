-- Run this once in the Neon SQL Editor before using the tracker.

CREATE TABLE IF NOT EXISTS team_members (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name varchar(80) NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS meeting_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  member_id integer NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  meeting_date date NOT NULL,
  hours numeric(5, 2) NOT NULL CHECK (hours > 0 AND hours <= 24),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, meeting_date)
);

CREATE INDEX IF NOT EXISTS meeting_logs_member_date_idx
  ON meeting_logs (member_id, meeting_date DESC);

INSERT INTO team_members (name)
VALUES ('Rishi'), ('Claire'), ('Howell'), ('Cyrus'), ('Lino'), ('Shaan'), ('Tristan'), ('Lylia')
ON CONFLICT (name) DO NOTHING;
