import type { Platform } from "../types";
import type { Publisher, PublishImage, PublishResult } from "./types";

// Adapter Upload-Post (https://docs.upload-post.com).
// Auth: header "Authorization: Apikey <key>". Base: https://api.upload-post.com/api
// Un "profilo" Upload-Post per progetto ShortFlow (username = up_<projectId>).

const BASE = "https://api.upload-post.com/api";

function profileUsername(projectId: string): string {
  return `cm_${projectId}`;
}

export function createUploadPostPublisher(apiKey: string): Publisher {
  const headers = { Authorization: `Apikey ${apiKey}` };

  async function listProfilesRaw(): Promise<UploadPostProfile[]> {
    const r = await fetch(`${BASE}/uploadposts/users`, { headers });
    if (!r.ok) throw new Error(`Upload-Post users ${r.status}: ${(await r.text()).slice(0, 300)}`);
    const j = (await r.json()) as { success?: boolean; profiles?: UploadPostProfile[] };
    return j.profiles ?? [];
  }

  async function findProfile(projectId: string): Promise<UploadPostProfile | undefined> {
    const username = profileUsername(projectId);
    return (await listProfilesRaw()).find((p) => p.username === username);
  }

  return {
    name: "upload-post",

    async ensureProfile(projectId) {
      const username = profileUsername(projectId);
      if (await findProfile(projectId)) return;
      const r = await fetch(`${BASE}/uploadposts/users`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      // 409/200 entrambi ok (già esistente)
      if (!r.ok && r.status !== 409) {
        throw new Error(`Upload-Post create profile ${r.status}: ${(await r.text()).slice(0, 300)}`);
      }
    },

    async connectUrl(projectId, redirectUrl, platforms) {
      await this.ensureProfile(projectId);
      const body: Record<string, unknown> = { username: profileUsername(projectId), redirect_url: redirectUrl };
      if (platforms?.length) body.platforms = platforms;
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

    async listConnections(projectId) {
      const profile = await findProfile(projectId);
      if (!profile) return [];
      const acc = profile.social_accounts ?? {};
      const out: { platform: Platform; handle?: string }[] = [];
      for (const p of ["instagram", "tiktok"] as Platform[]) {
        const entry = acc[p];
        // un account collegato è un oggetto non vuoto (o stringa handle)
        if (entry && (typeof entry === "string" ? entry : Object.keys(entry).length > 0)) {
          const handle = typeof entry === "string" ? entry : entry.username || entry.display_name || entry.handle;
          out.push({ platform: p, handle });
        }
      }
      return out;
    },

    async publishPhotos({ projectId, platforms, images, caption }): Promise<PublishResult> {
      const fd = new FormData();
      fd.append("user", profileUsername(projectId));
      for (const p of platforms) fd.append("platform[]", p);
      fd.append("title", caption || "");
      if (caption) fd.append("description", caption);
      for (const img of images) {
        fd.append("photos[]", new Blob([img.bytes as BlobPart], { type: img.type }), img.filename);
      }
      const r = await fetch(`${BASE}/upload_photos`, { method: "POST", headers, body: fd });
      const raw = await r.json().catch(() => ({}));
      if (!r.ok) {
        return { ok: false, raw, error: `Upload-Post ${r.status}: ${JSON.stringify(raw).slice(0, 300)}` };
      }
      const id = (raw as { request_id?: string; id?: string }).request_id || (raw as { id?: string }).id;
      return { ok: true, providerPostId: id, raw };
    },
  };
}

interface UploadPostProfile {
  username: string;
  social_accounts?: Partial<Record<Platform, string | { username?: string; display_name?: string; handle?: string }>>;
}

export { profileUsername };
