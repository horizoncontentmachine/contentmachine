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
