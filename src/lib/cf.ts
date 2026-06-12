import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database, KVNamespace } from "@cloudflare/workers-types";

// Accesso ai binding Cloudflare (D1 + KV) dalle route server.
// Funziona sia su Workers sia in `next dev` (grazie a initOpenNextCloudflareForDev in next.config).
export interface CFEnv {
  DB: D1Database;
  BLOBS: KVNamespace;
  OPENAI_API_KEY?: string;
  OPENAI_IMAGE_MODEL?: string;
  UPLOAD_POST_API_KEY?: string;
  APP_USER?: string;
  APP_PASSWORD?: string;
  APP_URL?: string;
}

export async function cfEnv(): Promise<CFEnv> {
  const { env } = await getCloudflareContext({ async: true });
  return env as unknown as CFEnv;
}

export async function db(): Promise<D1Database> {
  return (await cfEnv()).DB;
}

export async function blobs(): Promise<KVNamespace> {
  return (await cfEnv()).BLOBS;
}
