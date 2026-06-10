import { NextResponse } from "next/server";
import { getAsset } from "@/lib/db";
import { assetFilePath } from "@/lib/assets";
import { flattenSlide } from "@/lib/flatten";
import { driveConnected, pushGroupsToDrive, type DriveGroup } from "@/lib/drive";
import type { SlideInput } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

interface PushBody {
  projectName: string;
  groups: { label: string; slides: SlideInput[] }[];
}

// Flatten lato server (stessa pipeline dell'export) e carica su Drive in cartelle ordinate.
export async function POST(req: Request) {
  try {
    if (!driveConnected()) {
      return NextResponse.json({ error: "Google Drive non collegato", needsAuth: true }, { status: 400 });
    }
    const body = (await req.json()) as PushBody;
    if (!body.groups?.length) {
      return NextResponse.json({ error: "Niente da caricare" }, { status: 400 });
    }

    const groups: DriveGroup[] = [];
    for (const g of body.groups) {
      const files: { name: string; buf: Buffer }[] = [];
      for (let i = 0; i < g.slides.length; i++) {
        const s = g.slides[i];
        const rec = getAsset(s.assetKey);
        if (!rec) throw new Error(`Asset mancante: ${s.assetKey}`);
        const buf = await flattenSlide(assetFilePath(rec, true), s.overlay);
        files.push({ name: `${String(i + 1).padStart(2, "0")}_${s.role}.png`, buf });
      }
      groups.push({ label: g.label, files });
    }

    const { folderUrl } = await pushGroupsToDrive(body.projectName || "Progetto", groups);
    return NextResponse.json({ ok: true, folderUrl, count: groups.length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
