import { resolveUploadPostKey } from "../settings";
import { createUploadPostPublisher } from "./uploadPost";
import type { Publisher } from "./types";

// Ritorna il provider configurato, o null se manca la chiave.
export async function getPublisher(): Promise<Publisher | null> {
  const key = await resolveUploadPostKey();
  if (!key) return null;
  return createUploadPostPublisher(key);
}

export type { Publisher } from "./types";
