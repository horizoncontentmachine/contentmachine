import { db } from "./cf";
import {
  DEFAULT_SETTINGS,
  type AppSettings,
  type AssetRecord,
  type LedgerEntry,
  type Project,
  type VaultEntry,
} from "./types";

// Storage su Cloudflare D1 (JSON-blob): projects in tabella dedicata, il resto in tabella kv.
// Tutte le funzioni sono async.

function uid(): string {
  return crypto.randomUUID().slice(0, 8);
}

// ---- kv generico ----

async function kvGet<T>(key: string, fallback: T): Promise<T> {
  const row = await (await db()).prepare("SELECT v FROM kv WHERE k=?").bind(key).first<{ v: string }>();
  return row ? (JSON.parse(row.v) as T) : fallback;
}

async function kvPut(key: string, val: unknown): Promise<void> {
  await (await db())
    .prepare("INSERT INTO kv (k,v) VALUES (?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v")
    .bind(key, JSON.stringify(val))
    .run();
}

// ---- Projects ----

export async function listProjects(): Promise<Project[]> {
  const { results } = await (await db())
    .prepare("SELECT data FROM projects ORDER BY updatedAt DESC")
    .all<{ data: string }>();
  return (results ?? []).map((r) => JSON.parse(r.data) as Project);
}

export async function getProject(id: string): Promise<Project | null> {
  const row = await (await db()).prepare("SELECT data FROM projects WHERE id=?").bind(id).first<{ data: string }>();
  return row ? (JSON.parse(row.data) as Project) : null;
}

export async function saveProject(p: Project): Promise<void> {
  p.updatedAt = new Date().toISOString();
  await (await db())
    .prepare(
      "INSERT INTO projects (id,updatedAt,data) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET updatedAt=excluded.updatedAt, data=excluded.data"
    )
    .bind(p.id, p.updatedAt, JSON.stringify(p))
    .run();
}

export async function createProject(name: string, niche: string): Promise<Project> {
  const now = new Date().toISOString();
  const p: Project = {
    id: uid(),
    name,
    niche,
    graph: { nodes: [], edges: [] },
    spentCents: 0,
    createdAt: now,
    updatedAt: now,
  };
  await saveProject(p);
  return p;
}

export async function deleteProject(id: string): Promise<void> {
  await (await db()).prepare("DELETE FROM projects WHERE id=?").bind(id).run();
}

// ---- Assets (indice cache) ----

export async function getAssetIndex(): Promise<Record<string, AssetRecord>> {
  return kvGet<Record<string, AssetRecord>>("assets_index", {});
}

export async function getAsset(key: string): Promise<AssetRecord | null> {
  const idx = await getAssetIndex();
  return idx[key] ?? null;
}

export async function putAsset(rec: AssetRecord): Promise<void> {
  const idx = await getAssetIndex();
  idx[rec.key] = rec;
  await kvPut("assets_index", idx);
}

// ---- Vault ----

export async function listVault(): Promise<VaultEntry[]> {
  return kvGet<VaultEntry[]>("vault", []);
}

export async function addVaultEntry(e: Omit<VaultEntry, "id" | "createdAt">): Promise<VaultEntry> {
  const entry: VaultEntry = { ...e, id: uid(), createdAt: new Date().toISOString() };
  const all = await listVault();
  all.unshift(entry);
  await kvPut("vault", all);
  return entry;
}

export async function deleteVaultEntry(id: string): Promise<void> {
  await kvPut("vault", (await listVault()).filter((e) => e.id !== id));
}

// ---- Ledger ----

export async function listLedger(projectId?: string): Promise<LedgerEntry[]> {
  const all = await kvGet<LedgerEntry[]>("ledger", []);
  return projectId ? all.filter((e) => e.projectId === projectId) : all;
}

export async function addLedgerEntry(e: Omit<LedgerEntry, "id" | "createdAt">): Promise<LedgerEntry> {
  const entry: LedgerEntry = { ...e, id: uid(), createdAt: new Date().toISOString() };
  const all = await kvGet<LedgerEntry[]>("ledger", []);
  all.unshift(entry);
  await kvPut("ledger", all);
  if (!e.cacheHit && e.costCents > 0) {
    const p = await getProject(e.projectId);
    if (p) {
      p.spentCents += e.costCents;
      await saveProject(p);
    }
  }
  return entry;
}

// ---- Settings ----

export async function getSettings(): Promise<AppSettings> {
  const s = await kvGet<Partial<AppSettings>>("settings", {});
  return { ...DEFAULT_SETTINGS, ...s, drive: { ...DEFAULT_SETTINGS.drive, ...s.drive } };
}

export async function saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const cur = await getSettings();
  const next: AppSettings = { ...cur, ...patch, drive: { ...cur.drive, ...patch.drive } };
  await kvPut("settings", next);
  return next;
}
