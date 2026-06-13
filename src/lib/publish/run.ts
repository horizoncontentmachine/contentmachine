import { getPublisher } from "./index";
import { getAccount, updatePostStatus } from "../db";
import { getBlob, delBlob } from "../assets";
import { PLATFORM_FORMAT } from "../formats";
import type { Platform, PostRecord } from "../types";

export interface AccountPublishResult {
  accountId: string;
  platform: Platform;
  handle?: string;
  ok: boolean;
  error?: string;
  providerPostId?: string; // request_id Upload-Post → per le metriche
}

// Pubblica un post già programmato: legge le immagini dal KV e pubblica su ogni account.
export async function runScheduledPost(post: PostRecord): Promise<{ status: "published" | "failed"; results: AccountPublishResult[] }> {
  const publisher = await getPublisher();
  if (!publisher) {
    const r = [{ accountId: "", platform: "instagram" as Platform, ok: false, error: "Upload-Post non collegato" }];
    await updatePostStatus(post.id, "failed", r);
    return { status: "failed", results: r };
  }

  // carica le immagini flattenizzate dal KV
  const images: { filename: string; bytes: Uint8Array; type: string }[] = [];
  for (let i = 0; i < (post.mediaKeys?.length ?? 0); i++) {
    const bytes = await getBlob(post.mediaKeys![i]);
    if (bytes) images.push({ filename: `${String(i + 1).padStart(2, "0")}.png`, bytes, type: "image/png" });
  }
  if (!images.length) {
    const r = [{ accountId: "", platform: "instagram" as Platform, ok: false, error: "Immagini non trovate" }];
    await updatePostStatus(post.id, "failed", r);
    return { status: "failed", results: r };
  }

  const results: AccountPublishResult[] = [];
  for (const accId of post.accountIds ?? []) {
    const a = await getAccount(accId);
    if (!a) {
      results.push({ accountId: accId, platform: "instagram", ok: false, error: "account non trovato" });
      continue;
    }
    const imgs = images.slice(0, PLATFORM_FORMAT[a.platform].maxImages);
    const res = await publisher.publishPhotos({
      profile: a.providerProfile,
      platforms: [a.platform],
      images: imgs,
      caption: post.caption ?? "",
    });
    results.push({ accountId: accId, platform: a.platform, handle: a.handle, ok: res.ok, error: res.error, providerPostId: res.providerPostId });
  }

  const anyOk = results.some((r) => r.ok);
  await updatePostStatus(post.id, anyOk ? "published" : "failed", results);

  // libera lo storage delle immagini se almeno una pubblicazione è andata
  if (anyOk) for (const k of post.mediaKeys ?? []) await delBlob(k);

  return { status: anyOk ? "published" : "failed", results };
}
