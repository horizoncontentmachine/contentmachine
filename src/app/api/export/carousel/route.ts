import { NextResponse } from "next/server";
import path from "path";
import { exportCarouselPngs, exportUrl, newBatchDir, zipDir } from "@/lib/exporter";
import type { SlideInput } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const projectId: string = body.projectId;
    const slides: SlideInput[] = body.slides;
    if (!Array.isArray(slides) || !slides.length) {
      return NextResponse.json({ error: "Nessuna slide collegata" }, { status: 400 });
    }
    const dir = newBatchDir(projectId, body.name ?? "carousel");
    const files = await exportCarouselPngs(slides, dir);
    const zipPath = dir + ".zip";
    await zipDir(dir, zipPath);
    return NextResponse.json({
      files: files.map(exportUrl),
      zipUrl: exportUrl(zipPath),
      dir: path.basename(dir),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
