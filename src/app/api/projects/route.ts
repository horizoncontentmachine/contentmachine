import { NextResponse } from "next/server";
import { createProject, listProjects, saveProject } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(listProjects());
}

export async function POST(req: Request) {
  const body = await req.json();
  const name = (body.name ?? "").trim() || "Nuovo progetto";
  const niche = (body.niche ?? "").trim() || "general";
  const p = createProject(name, niche);
  // duplicazione: riusa il grafo di un progetto esistente come template
  if (body.graph) {
    p.graph = body.graph;
    saveProject(p);
  }
  return NextResponse.json(p);
}
