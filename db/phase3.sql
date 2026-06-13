-- Migrazione Fase 3 (analytics). Eseguire UNA volta (local + remote).

-- metriche per post pubblicato, per account (ultimo snapshot)
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

-- storico follower/reach per account (uno per giorno) → crescita nel tempo
CREATE TABLE IF NOT EXISTS follower_history (
  accountId TEXT NOT NULL,
  projectId TEXT NOT NULL,
  platform TEXT NOT NULL,
  date TEXT NOT NULL,
  followers INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  PRIMARY KEY (accountId, date)
);
