import { NextResponse } from "next/server";
import { createPost, getAccount, uidLong } from "@/lib/db";
import { putBlob } from "@/lib/assets";
import type { Platform, PostRecord, SlideInput } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

// Programma un post: riceve i PNG già flattenizzati dal browser, li salva nel KV
// e crea un post "queued" con data/ora. Il cron poi lo pubblicherà.
export async function POST(req: Request) {
  try {
    const fd = await req.formData();
    const projectId = String(fd.get("projectId") || "");
    const caption = String(fd.get("caption") || "");
    const scheduledAt = String(fd.get("scheduledAt") || "");
    const accountIds = String(fd.get("accountIds") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const slides: SlideInput[] = JSON.parse(String(fd.get("slides") || "[]"));
    const files = fd.getAll("photos").filter((f): f is File => f instanceof File);

    if (!projectId || !accountIds.length || !files.length || !scheduledAt) {
      return NextResponse.json({ error: "Dati mancanti (account, immagini o data)" }, { status: 400 });
    }
    if (isNaN(Date.parse(scheduledAt))) {
      return NextResponse.json({ error: "Data non valida" }, { status: 400 });
    }

    const id = uidLong();

    // salva le immagini flattenizzate nel KV
    const mediaKeys: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const key = `sched_${id}_${i}`;
      await putBlob(key, new Uint8Array(await files[i].arrayBuffer()));
      mediaKeys.push(key);
    }

    // piattaforme dai target
    const platforms = new Set<Platform>();
    for (const accId of accountIds) {
      const a = await getAccount(accId);
      if (a) platforms.add(a.platform);
    }

    const post: PostRecord = {
      id,
      projectId,
      createdAt: new Date().toISOString(),
      scheduledAt: new Date(scheduledAt).toISOString(),
      status: "queued",
      platforms: [...platforms],
      accountIds,
      mediaKeys,
      caption,
      slides,
    };
    await createPost(post);
    return NextResponse.json({ ok: true, postId: id, scheduledAt: post.scheduledAt });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
