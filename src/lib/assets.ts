import { blobs } from "./cf";
import { getAsset, putAsset } from "./db";
import type { AssetKind, AssetRecord } from "./types";

// Asset binari su KV (BLOBS); metadati nell'indice in D1. Niente normalizzazione server:
// il crop 9:16 e l'overlay avvengono nel browser (canvas) in preview ed export.
export async function storeAsset(args: {
  key: string;
  kind: AssetKind;
  bytes: Uint8Array | ArrayBuffer;
  ext: string;
  model?: string;
  prompt?: string;
  costCents: number;
}): Promise<AssetRecord> {
  const existing = await getAsset(args.key);
  if (existing) return existing;

  const kv = await blobs();
  const body = args.bytes instanceof Uint8Array ? args.bytes : new Uint8Array(args.bytes);
  await kv.put(args.key, body, { metadata: { ext: args.ext, kind: args.kind } });

  const rec: AssetRecord = {
    key: args.key,
    kind: args.kind,
    file: `${args.key}.${args.ext}`,
    model: args.model,
    prompt: args.prompt,
    costCents: args.costCents,
    createdAt: new Date().toISOString(),
  };
  await putAsset(rec);
  return rec;
}

export interface LoadedAsset {
  bytes: ArrayBuffer;
  ext: string;
}

export async function readAsset(key: string): Promise<LoadedAsset | null> {
  const kv = await blobs();
  const res = await kv.getWithMetadata(key, { type: "arrayBuffer" });
  if (!res.value) return null;
  const ext = (res.metadata as { ext?: string } | null)?.ext || "png";
  return { bytes: res.value, ext };
}
