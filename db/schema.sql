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

-- account social collegati: 1 riga per account (= 1 profilo Upload-Post),
-- quanti se ne vogliono per piattaforma/progetto.
DROP TABLE IF EXISTS social_accounts;
CREATE TABLE social_accounts (
  id TEXT PRIMARY KEY,
  projectId TEXT NOT NULL,
  platform TEXT NOT NULL,            -- instagram | tiktok | x
  handle TEXT,
  providerProfile TEXT NOT NULL,     -- username Upload-Post
  status TEXT NOT NULL,              -- pending | connected
  connectedAt TEXT
);
CREATE INDEX IF NOT EXISTS accounts_by_project ON social_accounts (projectId);

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
