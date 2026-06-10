import fs from "fs";
import { assetPath, ensureDirs } from "./paths";
import { getAsset, putAsset } from "./db";
import { normalizeImageTo916, imageMeta } from "./normalize";
import type { AssetKind, AssetRecord } from "./types";

// Scrive su disco originale (+ normalizzato 1080x1920 per le immagini) e registra nell'indice.
export async function storeAsset(args: {
  key: string;
  kind: AssetKind;
  buf: Buffer;
  ext: string; // "png" | "mp4" | "mp3" ...
  model?: string;
  prompt?: string;
  costCents: number;
  durationSec?: number;
}): Promise<AssetRecord> {
  ensureDirs();
  const existing = getAsset(args.key);
  if (existing) return existing;

  const file = `${args.key}.${args.ext}`;
  fs.writeFileSync(assetPath(file), args.buf);

  let normFile: string | undefined;
  let width: number | undefined;
  let height: number | undefined;
  if (args.kind === "image") {
    const norm = await normalizeImageTo916(args.buf);
    normFile = `${args.key}_norm.png`;
    fs.writeFileSync(assetPath(normFile), norm);
    const m = await imageMeta(args.buf);
    width = m.width;
    height = m.height;
  }

  const rec: AssetRecord = {
    key: args.key,
    kind: args.kind,
    file,
    normFile,
    model: args.model,
    prompt: args.prompt,
    costCents: args.costCents,
    width,
    height,
    durationSec: args.durationSec,
    createdAt: new Date().toISOString(),
  };
  putAsset(rec);
  return rec;
}

export function readAssetFile(rec: AssetRecord, normalized = false): Buffer {
  const file = normalized && rec.normFile ? rec.normFile : rec.file;
  return fs.readFileSync(assetPath(file));
}

export function assetFilePath(rec: AssetRecord, normalized = false): string {
  return assetPath(normalized && rec.normFile ? rec.normFile : rec.file);
}
