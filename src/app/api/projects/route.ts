import { NextResponse } from "next/server";
import { createProject, listProjects, saveProject } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(await listProjects());
}

export async function POST(req: Request) {
  const body = await req.json();
  const name = (body.name ?? "").trim() || "Nuovo progetto";
  const niche = (body.niche ?? "").trim() || "general";
  const p = await createProject(name, niche);
  // duplicazione: copia i workflow del progetto sorgente
  if (Array.isArray(body.workflows) && body.workflows.length) {
    p.workflows = body.workflows;
    await saveProject(p);
  }
  return NextResponse.json(p);
}
