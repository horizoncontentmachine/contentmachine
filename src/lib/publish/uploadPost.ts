import type { Platform } from "../types";
import type { ProviderProfile, Publisher, PublishResult } from "./types";

// Adapter Upload-Post (https://docs.upload-post.com).
// Auth: header "Authorization: Apikey <key>". Base: https://api.upload-post.com/api
// Un profilo Upload-Post per ogni account collegato.

const BASE = "https://api.upload-post.com/api";

// Platform ShortFlow → identificatore Upload-Post
const TO_PROVIDER: Record<Platform, string> = { instagram: "instagram", tiktok: "tiktok", x: "x" };

interface RawProfile {
  username: string;
  social_accounts?: Record<string, string | { username?: string; display_name?: string; handle?: string } | null>;
}

function handleOf(entry: unknown): string | undefined {
  if (!entry) return undefined;
  if (typeof entry === "string") return entry;
  const e = entry as { username?: string; display_name?: string; handle?: string };
  return e.username || e.display_name || e.handle;
}

function normalize(p: RawProfile): ProviderProfile {
  const acc = p.social_accounts ?? {};
  const connected: ProviderProfile["connected"] = [];
  const checks: { platform: Platform; keys: string[] }[] = [
    { platform: "instagram", keys: ["instagram"] },
    { platform: "tiktok", keys: ["tiktok"] },
    { platform: "x", keys: ["x", "twitter"] },
  ];
  for (const c of checks) {
    for (const k of c.keys) {
      const entry = acc[k];
      const has = entry && (typeof entry === "string" ? entry : Object.keys(entry).length > 0);
      if (has) {
        connected.push({ platform: c.platform, handle: handleOf(entry) });
        break;
      }
    }
  }
  return { username: p.username, connected };
}

export function createUploadPostPublisher(apiKey: string): Publisher {
  const headers = { Authorization: `Apikey ${apiKey}` };

  async function getProfiles(): Promise<ProviderProfile[]> {
    const r = await fetch(`${BASE}/uploadposts/users`, { headers });
    if (!r.ok) throw new Error(`Upload-Post users ${r.status}: ${(await r.text()).slice(0, 300)}`);
    const j = (await r.json()) as { profiles?: RawProfile[] };
    return (j.profiles ?? []).map(normalize);
  }

  return {
    name: "upload-post",

    getProfiles,

    async ensureProfile(profile) {
      const exists = (await getProfiles()).some((p) => p.username === profile);
      if (exists) return;
      const r = await fetch(`${BASE}/uploadposts/users`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ username: profile }),
      });
      if (!r.ok && r.status !== 409) {
        throw new Error(`Upload-Post create profile ${r.status}: ${(await r.text()).slice(0, 300)}`);
      }
    },

    async connectUrl(profile, redirectUrl, platforms) {
      const body: Record<string, unknown> = { username: profile, redirect_url: redirectUrl };
      if (platforms?.length) body.platforms = platforms.map((p) => TO_PROVIDER[p]);
      const r = await fetch(`${BASE}/uploadposts/users/generate-jwt`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(`Upload-Post generate-jwt ${r.status}: ${(await r.text()).slice(0, 300)}`);
      const j = (await r.json()) as { access_url?: string };
      if (!j.access_url) throw new Error("Upload-Post: access_url mancante nella risposta");
      return j.access_url;
    },

    async publishPhotos({ profile, platforms, images, caption }): Promise<PublishResult> {
      const fd = new FormData();
      fd.append("user", profile);
      for (const p of platforms) fd.append("platform[]", TO_PROVIDER[p]);
      fd.append("title", caption || "");
      if (caption) fd.append("description", caption);
      for (const img of images) {
        fd.append("photos[]", new Blob([img.bytes as BlobPart], { type: img.type }), img.filename);
      }
      const r = await fetch(`${BASE}/upload_photos`, { method: "POST", headers, body: fd });
      const raw = await r.json().catch(() => ({}));
      if (!r.ok) return { ok: false, raw, error: `Upload-Post ${r.status}: ${JSON.stringify(raw).slice(0, 300)}` };
      const id = (raw as { request_id?: string; id?: string }).request_id || (raw as { id?: string }).id;
      return { ok: true, providerPostId: id, raw };
    },
  };
}
