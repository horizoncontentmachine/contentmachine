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

-- post pubblicati / programmati (Storico + scheduling)
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  projectId TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  scheduledAt TEXT,                  -- null = pubblicato subito
  status TEXT NOT NULL,             -- queued | publishing | published | failed
  platforms TEXT NOT NULL,          -- json array
  accountIds TEXT,                  -- json array di account target
  mediaKeys TEXT,                   -- json array di chiavi KV delle immagini già flattenizzate
  caption TEXT,
  slides TEXT,                      -- json SlideInput[] (per anteprime nello Storico)
  result TEXT                       -- json: risposta provider o errore
);
CREATE INDEX IF NOT EXISTS posts_by_project ON posts (projectId, createdAt);
CREATE INDEX IF NOT EXISTS posts_due ON posts (status, scheduledAt);

-- slot ricorrenti per la programmazione automatica (Fase 2b)
CREATE TABLE IF NOT EXISTS posting_slots (
  projectId TEXT NOT NULL,
  accountId TEXT NOT NULL,
  days TEXT NOT NULL,
  times TEXT NOT NULL,
  timezone TEXT,
  PRIMARY KEY (projectId, accountId)
);

-- metriche analytics (Fase 3)
CREATE TABLE IF NOT EXISTS post_metrics (
  postId TEXT NOT NULL,
  accountId TEXT NOT NULL,
  platform TEXT NOT NULL,
  requestId TEXT,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  postUrl TEXT,
  fetchedAt TEXT,
  PRIMARY KEY (postId, accountId)
);
CREATE TABLE IF NOT EXISTS follower_history (
  accountId TEXT NOT NULL,
  projectId TEXT NOT NULL,
  platform TEXT NOT NULL,
  date TEXT NOT NULL,
  followers INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  PRIMARY KEY (accountId, date)
);
