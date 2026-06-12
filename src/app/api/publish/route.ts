import { NextResponse } from "next/server";
import { getPublisher } from "@/lib/publish";
import { createPost, uidLong } from "@/lib/db";
import type { Platform, PostRecord, SlideInput } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

// Pubblica ora: riceve i PNG già "flattenati" dal browser (multipart) + meta,
// li inoltra al provider (chiave server-side) e registra il post nello Storico.
export async function POST(req: Request) {
  try {
    const fd = await req.formData();
    const projectId = String(fd.get("projectId") || "");
    const caption = String(fd.get("caption") || "");
    const platforms = String(fd.get("platforms") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean) as Platform[];
    const slides: SlideInput[] = JSON.parse(String(fd.get("slides") || "[]"));
    const files = fd.getAll("photos").filter((f): f is File => f instanceof File);

    if (!projectId || !platforms.length || !files.length) {
      return NextResponse.json({ error: "Dati mancanti (progetto, piattaforme o immagini)" }, { status: 400 });
    }

    const publisher = await getPublisher();
    if (!publisher) {
      return NextResponse.json({ error: "Collega Upload-Post in Impostazioni" }, { status: 400 });
    }

    const images = await Promise.all(
      files.map(async (f, i) => ({
        filename: f.name || `slide_${i + 1}.png`,
        bytes: new Uint8Array(await f.arrayBuffer()),
        type: f.type || "image/png",
      }))
    );

    const id = uidLong();
    const now = new Date().toISOString();
    await publisher.ensureProfile(projectId);
    const res = await publisher.publishPhotos({ projectId, platforms, images, caption });

    const post: PostRecord = {
      id,
      projectId,
      createdAt: now,
      scheduledAt: null,
      status: res.ok ? "published" : "failed",
      platforms,
      caption,
      slides,
      result: res.ok ? res.raw : res.error,
    };
    await createPost(post);

    if (!res.ok) return NextResponse.json({ error: res.error, postId: id }, { status: 502 });
    return NextResponse.json({ ok: true, postId: id, providerPostId: res.providerPostId });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
