import { NextResponse } from "next/server";
import { listPosts, getPost, deletePost, reschedulePost, updatePostCaption } from "@/lib/db";
import { delBlob } from "@/lib/assets";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  return NextResponse.json(await listPosts(id));
}

// gestione post programmati: elimina / riprogramma
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const post = body.postId ? await getPost(body.postId) : null;
  if (!post || post.projectId !== id) {
    return NextResponse.json({ error: "Post non trovato" }, { status: 404 });
  }

  if (body.action === "delete") {
    for (const k of post.mediaKeys ?? []) await delBlob(k);
    await deletePost(post.id);
    return NextResponse.json({ ok: true });
  }
  if (body.action === "reschedule" && body.scheduledAt && !isNaN(Date.parse(body.scheduledAt))) {
    await reschedulePost(post.id, new Date(body.scheduledAt).toISOString());
    return NextResponse.json({ ok: true });
  }
  if (body.action === "edit" && typeof body.caption === "string") {
    await updatePostCaption(post.id, body.caption);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Azione non valida" }, { status: 400 });
}
