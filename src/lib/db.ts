import fs from "fs";
import path from "path";
import crypto from "crypto";
import {
  PROJECTS_DIR,
  ASSETS_INDEX,
  VAULT_FILE,
  LEDGER_FILE,
  SETTINGS_FILE,
  ensureDirs,
} from "./paths";
import {
  DEFAULT_SETTINGS,
  type AppSettings,
  type AssetRecord,
  type LedgerEntry,
  type Project,
  type VaultEntry,
} from "./types";

// Storage JSON su file: single-user locale, niente DB da installare.

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, data: unknown) {
  ensureDirs();
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

// ---- Projects ----

export function listProjects(): Project[] {
  ensureDirs();
  return fs
    .readdirSync(PROJECTS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => readJson<Project | null>(path.join(PROJECTS_DIR, f), null))
    .filter((p): p is Project => !!p)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getProject(id: string): Project | null {
  return readJson<Project | null>(path.join(PROJECTS_DIR, id + ".json"), null);
}

export function saveProject(p: Project) {
  p.updatedAt = new Date().toISOString();
  writeJson(path.join(PROJECTS_DIR, p.id + ".json"), p);
}

export function createProject(name: string, niche: string): Project {
  const now = new Date().toISOString();
  const p: Project = {
    id: crypto.randomUUID().slice(0, 8),
    name,
    niche,
    graph: { nodes: [], edges: [] },
    spentCents: 0,
    createdAt: now,
    updatedAt: now,
  };
  saveProject(p);
  return p;
}

export function deleteProject(id: string) {
  try {
    fs.unlinkSync(path.join(PROJECTS_DIR, id + ".json"));
  } catch {}
}

// ---- Assets (cache index) ----

export function getAssetIndex(): Record<string, AssetRecord> {
  return readJson<Record<string, AssetRecord>>(ASSETS_INDEX, {});
}

export function getAsset(key: string): AssetRecord | null {
  return getAssetIndex()[key] ?? null;
}

export function putAsset(rec: AssetRecord) {
  const idx = getAssetIndex();
  idx[rec.key] = rec;
  writeJson(ASSETS_INDEX, idx);
}

// ---- Vault ----

export function listVault(): VaultEntry[] {
  return readJson<VaultEntry[]>(VAULT_FILE, []);
}

export function addVaultEntry(e: Omit<VaultEntry, "id" | "createdAt">): VaultEntry {
  const entry: VaultEntry = {
    ...e,
    id: crypto.randomUUID().slice(0, 8),
    createdAt: new Date().toISOString(),
  };
  const all = listVault();
  all.unshift(entry);
  writeJson(VAULT_FILE, all);
  return entry;
}

export function deleteVaultEntry(id: string) {
  writeJson(VAULT_FILE, listVault().filter((e) => e.id !== id));
}

// ---- Ledger (storico costi) ----

export function listLedger(projectId?: string): LedgerEntry[] {
  const all = readJson<LedgerEntry[]>(LEDGER_FILE, []);
  return projectId ? all.filter((e) => e.projectId === projectId) : all;
}

export function addLedgerEntry(e: Omit<LedgerEntry, "id" | "createdAt">): LedgerEntry {
  const entry: LedgerEntry = {
    ...e,
    id: crypto.randomUUID().slice(0, 8),
    createdAt: new Date().toISOString(),
  };
  const all = readJson<LedgerEntry[]>(LEDGER_FILE, []);
  all.unshift(entry);
  writeJson(LEDGER_FILE, all);
  // aggiorna il contatore del progetto solo per spesa reale
  if (!e.cacheHit && e.costCents > 0) {
    const p = getProject(e.projectId);
    if (p) {
      p.spentCents += e.costCents;
      saveProject(p);
    }
  }
  return entry;
}

// ---- Settings ----

export function getSettings(): AppSettings {
  const s = readJson<Partial<AppSettings>>(SETTINGS_FILE, {});
  return { ...DEFAULT_SETTINGS, ...s, drive: { ...DEFAULT_SETTINGS.drive, ...s.drive } };
}

export function saveSettings(patch: Partial<AppSettings>): AppSettings {
  const cur = getSettings();
  const next: AppSettings = {
    ...cur,
    ...patch,
    drive: { ...cur.drive, ...patch.drive },
  };
  writeJson(SETTINGS_FILE, next);
  return next;
}
