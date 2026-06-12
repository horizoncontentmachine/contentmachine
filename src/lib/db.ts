import { db } from "./cf";
import {
  DEFAULT_SETTINGS,
  type AppSettings,
  type AssetRecord,
  type LedgerEntry,
  type Platform,
  type PostRecord,
  type Project,
  type SocialAccount,
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

// ---- Social accounts (mirror dello stato del provider) ----

export async function listAccounts(projectId: string): Promise<SocialAccount[]> {
  const { results } = await (await db())
    .prepare("SELECT projectId, platform, handle, status, connectedAt FROM social_accounts WHERE projectId=?")
    .bind(projectId)
    .all<SocialAccount>();
  return results ?? [];
}

export async function upsertAccount(a: SocialAccount): Promise<void> {
  await (await db())
    .prepare(
      "INSERT INTO social_accounts (projectId,platform,handle,status,connectedAt) VALUES (?,?,?,?,?) " +
        "ON CONFLICT(projectId,platform) DO UPDATE SET handle=excluded.handle, status=excluded.status, connectedAt=excluded.connectedAt"
    )
    .bind(a.projectId, a.platform, a.handle ?? null, a.status, a.connectedAt ?? new Date().toISOString())
    .run();
}

export async function removeAccount(projectId: string, platform: Platform): Promise<void> {
  await (await db()).prepare("DELETE FROM social_accounts WHERE projectId=? AND platform=?").bind(projectId, platform).run();
}

// Sostituisce lo stato account del progetto con l'insieme attualmente connesso.
export async function syncAccounts(projectId: string, connected: Platform[], handles: Partial<Record<Platform, string>>): Promise<void> {
  await (await db()).prepare("DELETE FROM social_accounts WHERE projectId=?").bind(projectId).run();
  for (const p of connected) {
    await upsertAccount({ projectId, platform: p, handle: handles[p], status: "connected", connectedAt: new Date().toISOString() });
  }
}

// ---- Posts (storico / coda) ----

export async function listPosts(projectId: string): Promise<PostRecord[]> {
  const { results } = await (await db())
    .prepare("SELECT * FROM posts WHERE projectId=? ORDER BY createdAt DESC LIMIT 200")
    .bind(projectId)
    .all<{ id: string; projectId: string; createdAt: string; scheduledAt: string | null; status: string; platforms: string; caption: string | null; slides: string | null; result: string | null }>();
  return (results ?? []).map((r) => ({
    id: r.id,
    projectId: r.projectId,
    createdAt: r.createdAt,
    scheduledAt: r.scheduledAt,
    status: r.status as PostRecord["status"],
    platforms: JSON.parse(r.platforms) as Platform[],
    caption: r.caption ?? undefined,
    slides: r.slides ? JSON.parse(r.slides) : undefined,
    result: r.result ? JSON.parse(r.result) : undefined,
  }));
}

export async function createPost(p: PostRecord): Promise<void> {
  await (await db())
    .prepare(
      "INSERT INTO posts (id,projectId,createdAt,scheduledAt,status,platforms,caption,slides,result) VALUES (?,?,?,?,?,?,?,?,?)"
    )
    .bind(
      p.id,
      p.projectId,
      p.createdAt,
      p.scheduledAt ?? null,
      p.status,
      JSON.stringify(p.platforms),
      p.caption ?? null,
      p.slides ? JSON.stringify(p.slides) : null,
      p.result ? JSON.stringify(p.result) : null
    )
    .run();
}

export async function updatePostStatus(id: string, status: PostRecord["status"], result?: unknown): Promise<void> {
  await (await db())
    .prepare("UPDATE posts SET status=?, result=? WHERE id=?")
    .bind(status, result !== undefined ? JSON.stringify(result) : null, id)
    .run();
}

export function uidLong(): string {
  return crypto.randomUUID();
}
