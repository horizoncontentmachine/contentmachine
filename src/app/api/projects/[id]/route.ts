import { NextResponse } from "next/server";
import { deleteProject, getProject, saveProject } from "@/lib/db";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const p = getProject(id);
  if (!p) return NextResponse.json({ error: "Progetto non trovato" }, { status: 404 });
  return NextResponse.json(p);
}

export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  const p = getProject(id);
  if (!p) return NextResponse.json({ error: "Progetto non trovato" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  if (body.graph) p.graph = body.graph;
  if (typeof body.name === "string" && body.name.trim()) p.name = body.name.trim();
  if (typeof body.niche === "string") p.niche = body.niche.trim();
  saveProject(p);
  return NextResponse.json(p);
}

// alias di PUT: navigator.sendBeacon (flush alla chiusura) invia sempre in POST
export const POST = PUT;

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  deleteProject(id);
  return NextResponse.json({ ok: true });
}
