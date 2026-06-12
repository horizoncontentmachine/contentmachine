-- Schema D1 per ShortFlow / contentmachine.
-- Approccio JSON-blob: minimo SQL, i dati restano negli stessi shape del codice.

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  updatedAt TEXT NOT NULL,
  data TEXT NOT NULL
);

-- store generico chiave/valore (vault, ledger, settings, indice asset)
CREATE TABLE IF NOT EXISTS kv (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL
);

-- account social collegati, per progetto (mirror dello stato su Upload-Post)
CREATE TABLE IF NOT EXISTS social_accounts (
  projectId TEXT NOT NULL,
  platform TEXT NOT NULL,            -- instagram | tiktok
  handle TEXT,
  status TEXT NOT NULL,              -- connected
  connectedAt TEXT,
  PRIMARY KEY (projectId, platform)
);

-- post pubblicati / programmati (Storico + futuro scheduling)
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  projectId TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  scheduledAt TEXT,                  -- null = pubblicato subito
  status TEXT NOT NULL,             -- queued | publishing | published | failed
  platforms TEXT NOT NULL,          -- json array
  caption TEXT,
  slides TEXT,                      -- json SlideInput[] (per anteprime nello Storico)
  result TEXT                       -- json: risposta provider o errore
);
CREATE INDEX IF NOT EXISTS posts_by_project ON posts (projectId, createdAt);
