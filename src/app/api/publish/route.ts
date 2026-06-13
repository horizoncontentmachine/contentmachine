import { NextResponse } from "next/server";
import { getPublisher } from "@/lib/publish";
import { createPost, getAccount, uidLong } from "@/lib/db";
import { PLATFORM_FORMAT } from "@/lib/formats";
import type { Platform, PostRecord, SlideInput } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

// Pubblica ora: riceve i PNG flattenati dal browser + gli account scelti,
// pubblica su ciascun account (1 profilo Upload-Post a testa) e registra nello Storico.
export async function POST(req: Request) {
  try {
    const fd = await req.formData();
    const projectId = String(fd.get("projectId") || "");
    const caption = String(fd.get("caption") || "");
    const accountIds = String(fd.get("accountIds") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const slides: SlideInput[] = JSON.parse(String(fd.get("slides") || "[]"));
    const files = fd.getAll("photos").filter((f): f is File => f instanceof File);

    if (!projectId || !accountIds.length || !files.length) {
      return NextResponse.json({ error: "Dati mancanti (account o immagini)" }, { status: 400 });
    }

    const publisher = await getPublisher();
    if (!publisher) return NextResponse.json({ error: "Collega Upload-Post in Impostazioni" }, { status: 400 });

    const images = await Promise.all(
      files.map(async (f, i) => ({
        filename: f.name || `slide_${i + 1}.png`,
        bytes: new Uint8Array(await f.arrayBuffer()),
        type: f.type || "image/png",
      }))
    );

    const results: { accountId: string; platform: Platform; handle?: string; ok: boolean; error?: string; providerPostId?: string }[] = [];
    const platforms = new Set<Platform>();
    for (const accId of accountIds) {
      const a = await getAccount(accId);
      if (!a || a.projectId !== projectId) {
        results.push({ accountId: accId, platform: "instagram", ok: false, error: "account non trovato" });
        continue;
      }
      platforms.add(a.platform);
      const max = PLATFORM_FORMAT[a.platform].maxImages;
      const imgs = images.slice(0, max); // rispetta il limite della piattaforma (es. X = 4)
      const res = await publisher.publishPhotos({ profile: a.providerProfile, platforms: [a.platform], images: imgs, caption });
      results.push({ accountId: accId, platform: a.platform, handle: a.handle, ok: res.ok, error: res.error, providerPostId: res.providerPostId });
    }

    const anyOk = results.some((r) => r.ok);
    const allOk = results.every((r) => r.ok);
    const post: PostRecord = {
      id: uidLong(),
      projectId,
      createdAt: new Date().toISOString(),
      scheduledAt: null,
      status: allOk ? "published" : anyOk ? "published" : "failed",
      platforms: [...platforms],
      caption,
      slides,
      result: results,
    };
    await createPost(post);

    if (!anyOk) {
      return NextResponse.json({ error: results.map((r) => r.error).filter(Boolean).join(" · ") || "Pubblicazione fallita", results }, { status: 502 });
    }
    return NextResponse.json({ ok: true, results });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
