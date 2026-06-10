import fs from "fs";
import path from "path";
import archiver from "archiver";
import { EXPORTS_DIR, ensureDirs } from "./paths";
import { getAsset } from "./db";
import { assetFilePath } from "./assets";
import { flattenSlide } from "./flatten";
import type { SlideInput } from "./types";

function safeName(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 60) || "export";
}

export function newBatchDir(projectId: string, name: string): string {
  ensureDirs();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dir = path.join(EXPORTS_DIR, projectId, `${stamp}_${safeName(name)}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function exportUrl(absPath: string): string {
  // url servita da /api/exports/[...path]
  const rel = path.relative(EXPORTS_DIR, absPath);
  return "/api/exports/" + rel.split(path.sep).map(encodeURIComponent).join("/");
}

// Carosello immagini → PNG flattenati numerati per ruolo.
export async function exportCarouselPngs(slides: SlideInput[], outDir: string): Promise<string[]> {
  const files: string[] = [];
  for (let i = 0; i < slides.length; i++) {
    const s = slides[i];
    const rec = getAsset(s.assetKey);
    if (!rec) throw new Error(`Asset mancante: ${s.assetKey}`);
    const buf = await flattenSlide(assetFilePath(rec, true), s.overlay);
    const file = path.join(outDir, `${String(i + 1).padStart(2, "0")}_${s.role}.png`);
    fs.writeFileSync(file, buf);
    files.push(file);
  }
  return files;
}

export function zipDir(dir: string, zipPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 6 } });
    output.on("close", () => resolve());
    archive.on("error", reject);
    archive.pipe(output);
    archive.directory(dir, false);
    archive.finalize();
  });
}
