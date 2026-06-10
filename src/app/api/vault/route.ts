import { NextResponse } from "next/server";
import { addVaultEntry, deleteVaultEntry, listVault } from "@/lib/db";
import type { VaultType } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const niche = url.searchParams.get("niche");
  let all = listVault();
  if (niche) all = all.filter((e) => e.niche === niche || e.niche === "general");
  return NextResponse.json(all);
}

export async function POST(req: Request) {
  const body = await req.json();
  const type: VaultType = ["image", "hook"].includes(body.type) ? body.type : "image";
  const text = (body.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "Testo vuoto" }, { status: 400 });
  const entry = addVaultEntry({ niche: (body.niche ?? "general").trim() || "general", type, text });
  return NextResponse.json(entry);
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (id) deleteVaultEntry(id);
  return NextResponse.json({ ok: true });
}
