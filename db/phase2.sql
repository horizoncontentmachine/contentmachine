-- Migrazione Fase 2 (scheduling). Eseguire UNA volta (local + remote).
ALTER TABLE posts ADD COLUMN accountIds TEXT;
ALTER TABLE posts ADD COLUMN mediaKeys TEXT;

CREATE TABLE IF NOT EXISTS posting_slots (
  projectId TEXT NOT NULL,
  accountId TEXT NOT NULL,
  days TEXT NOT NULL,       -- json: giorni [0..6] (0=domenica)
  times TEXT NOT NULL,      -- json: orari ["09:00","13:00"]
  timezone TEXT,
  PRIMARY KEY (projectId, accountId)
);
