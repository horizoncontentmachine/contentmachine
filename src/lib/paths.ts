import fs from "fs";
import path from "path";

export const DATA_ROOT = path.join(process.cwd(), "data");
export const PROJECTS_DIR = path.join(DATA_ROOT, "projects");
export const ASSETS_DIR = path.join(DATA_ROOT, "assets", "files");
export const ASSETS_INDEX = path.join(DATA_ROOT, "assets", "index.json");
export const VAULT_FILE = path.join(DATA_ROOT, "vault.json");
export const LEDGER_FILE = path.join(DATA_ROOT, "ledger.json");
export const SETTINGS_FILE = path.join(DATA_ROOT, "settings.json");
export const EXPORTS_DIR = path.join(DATA_ROOT, "exports");
export const TMP_DIR = path.join(DATA_ROOT, "tmp");

export function ensureDirs() {
  for (const d of [DATA_ROOT, PROJECTS_DIR, ASSETS_DIR, EXPORTS_DIR, TMP_DIR]) {
    fs.mkdirSync(d, { recursive: true });
  }
}

export function assetPath(file: string) {
  return path.join(ASSETS_DIR, file);
}
