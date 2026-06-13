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
  type Workflow,
} from "./types";

// Storage su Cloudflare D1 (JSON-blob): projects in tabella dedicata, il resto in tabella kv.
// Tutte le funzioni sono async.

function uid(): string {
  return crypto.randomUUID().slice(0, 8);
}

// I 3 workflow standard di un progetto (IG/TikTok/X), opzionalmente con un grafo iniziale su TikTok.
function defaultWorkflows(legacy?: { nodes: unknown[]; edges: unknown[] }): Workflow[] {
  const empty = () => ({ nodes: [], edges: [] });
  return [
    { id: uid(), name: "Instagram", platform: "instagram" as Platform, graph: empty() },
    { id: uid(), name: "TikTok", platform: "tiktok" as Platform, graph: legacy ?? empty() },
    { id: uid(), name: "X", platform: "x" as Platform, graph: empty() },
  ];
}

// Migrazione: i progetti vecchi hanno `graph` singolo → diventa il workflow TikTok.
function migrate(p: Project): Project {
  if (p.workflows && p.workflows.length) return p;
  const { graph, ...rest } = p;
  return { ...rest, workflows: defaultWorkflows(graph as { nodes: unknown[]; edges: unknown[] } | undefined) };
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
  return (results ?? []).map((r) => migrate(JSON.parse(r.data) as Project));
}

export async function getProject(id: string): Promise<Project | null> {
  const row = await (await db()).prepare("SELECT data FROM projects WHERE id=?").bind(id).first<{ data: string }>();
  return row ? migrate(JSON.parse(row.data) as Project) : null;
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
    workflows: defaultWorkflows(),
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

// ---- Social accounts (1 riga = 1 account = 1 profilo Upload-Post) ----

export async function listAccounts(projectId: string): Promise<SocialAccount[]> {
  const { results } = await (await db())
    .prepare("SELECT id, projectId, platform, handle, providerProfile, status, connectedAt FROM social_accounts WHERE projectId=? ORDER BY platform, connectedAt")
    .bind(projectId)
    .all<SocialAccount>();
  return results ?? [];
}

export async function getAccount(id: string): Promise<SocialAccount | null> {
  return (await db())
    .prepare("SELECT id, projectId, platform, handle, providerProfile, status, connectedAt FROM social_accounts WHERE id=?")
    .bind(id)
    .first<SocialAccount>();
}

export async function createAccount(a: SocialAccount): Promise<void> {
  await (await db())
    .prepare("INSERT INTO social_accounts (id,projectId,platform,handle,providerProfile,status,connectedAt) VALUES (?,?,?,?,?,?,?)")
    .bind(a.id, a.projectId, a.platform, a.handle ?? null, a.providerProfile, a.status, a.connectedAt ?? null)
    .run();
}

export async function updateAccount(id: string, patch: { handle?: string; status?: SocialAccount["status"]; connectedAt?: string }): Promise<void> {
  await (await db())
    .prepare("UPDATE social_accounts SET handle=COALESCE(?,handle), status=COALESCE(?,status), connectedAt=COALESCE(?,connectedAt) WHERE id=?")
    .bind(patch.handle ?? null, patch.status ?? null, patch.connectedAt ?? null, id)
    .run();
}

export async function removeAccount(id: string): Promise<void> {
  await (await db()).prepare("DELETE FROM social_accounts WHERE id=?").bind(id).run();
}

// ---- Posts (storico / coda) ----

interface PostRow {
  id: string;
  projectId: string;
  createdAt: string;
  scheduledAt: string | null;
  status: string;
  platforms: string;
  accountIds: string | null;
  mediaKeys: string | null;
  caption: string | null;
  slides: string | null;
  result: string | null;
}

function rowToPost(r: PostRow): PostRecord {
  return {
    id: r.id,
    projectId: r.projectId,
    createdAt: r.createdAt,
    scheduledAt: r.scheduledAt,
    status: r.status as PostRecord["status"],
    platforms: JSON.parse(r.platforms) as Platform[],
    accountIds: r.accountIds ? JSON.parse(r.accountIds) : undefined,
    mediaKeys: r.mediaKeys ? JSON.parse(r.mediaKeys) : undefined,
    caption: r.caption ?? undefined,
    slides: r.slides ? JSON.parse(r.slides) : undefined,
    result: r.result ? JSON.parse(r.result) : undefined,
  };
}

export async function listPosts(projectId: string): Promise<PostRecord[]> {
  const { results } = await (await db())
    .prepare("SELECT * FROM posts WHERE projectId=? ORDER BY COALESCE(scheduledAt, createdAt) DESC LIMIT 300")
    .bind(projectId)
    .all<PostRow>();
  return (results ?? []).map(rowToPost);
}

// post programmati ormai dovuti (per il cron), su tutti i progetti
export async function getDuePosts(nowISO: string, limit = 50): Promise<PostRecord[]> {
  const { results } = await (await db())
    .prepare("SELECT * FROM posts WHERE status='queued' AND scheduledAt IS NOT NULL AND scheduledAt <= ? ORDER BY scheduledAt LIMIT ?")
    .bind(nowISO, limit)
    .all<PostRow>();
  return (results ?? []).map(rowToPost);
}

export async function createPost(p: PostRecord): Promise<void> {
  await (await db())
    .prepare(
      "INSERT INTO posts (id,projectId,createdAt,scheduledAt,status,platforms,accountIds,mediaKeys,caption,slides,result) VALUES (?,?,?,?,?,?,?,?,?,?,?)"
    )
    .bind(
      p.id,
      p.projectId,
      p.createdAt,
      p.scheduledAt ?? null,
      p.status,
      JSON.stringify(p.platforms),
      p.accountIds ? JSON.stringify(p.accountIds) : null,
      p.mediaKeys ? JSON.stringify(p.mediaKeys) : null,
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

export async function getPost(id: string): Promise<PostRecord | null> {
  const r = await (await db()).prepare("SELECT * FROM posts WHERE id=?").bind(id).first<PostRow>();
  return r ? rowToPost(r) : null;
}

export async function deletePost(id: string): Promise<void> {
  await (await db()).prepare("DELETE FROM posts WHERE id=?").bind(id).run();
}

export async function reschedulePost(id: string, scheduledAt: string): Promise<void> {
  await (await db()).prepare("UPDATE posts SET scheduledAt=?, status='queued' WHERE id=?").bind(scheduledAt, id).run();
}

// rimette in coda i post bloccati in "publishing" da troppo tempo (crash a metà).
// Usa scheduledAt: un post pubblicato bene è già "published"; resta "publishing" solo se è crashato.
export async function requeueStuck(beforeISO: string): Promise<void> {
  await (await db())
    .prepare("UPDATE posts SET status='queued' WHERE status='publishing' AND scheduledAt IS NOT NULL AND scheduledAt < ?")
    .bind(beforeISO)
    .run();
}

export function uidLong(): string {
  return crypto.randomUUID();
}

// ---- Slot di pubblicazione (per progetto) ----

const PROJECT_SLOT = "_project";

export async function getSlots(projectId: string): Promise<{ days: number[]; times: string[]; timezone?: string } | null> {
  const r = await (await db())
    .prepare("SELECT days, times, timezone FROM posting_slots WHERE projectId=? AND accountId=?")
    .bind(projectId, PROJECT_SLOT)
    .first<{ days: string; times: string; timezone: string | null }>();
  if (!r) return null;
  return { days: JSON.parse(r.days), times: JSON.parse(r.times), timezone: r.timezone ?? undefined };
}

export async function saveSlots(projectId: string, days: number[], times: string[], timezone?: string): Promise<void> {
  await (await db())
    .prepare(
      "INSERT INTO posting_slots (projectId,accountId,days,times,timezone) VALUES (?,?,?,?,?) " +
        "ON CONFLICT(projectId,accountId) DO UPDATE SET days=excluded.days, times=excluded.times, timezone=excluded.timezone"
    )
    .bind(projectId, PROJECT_SLOT, JSON.stringify(days), JSON.stringify(times), timezone ?? null)
    .run();
}
