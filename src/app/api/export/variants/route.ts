import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { exportCarouselPngs, exportUrl, newBatchDir, zipDir } from "@/lib/exporter";
import { expandVariants } from "@/lib/variants";
import type { SlideInput, VariantOptions } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

// Variant engine: nessuna chiamata AI. Solo flatten delle stesse immagini cached.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const projectId: string = body.projectId;
    const base: SlideInput[] = body.slides;
    const opts: VariantOptions = {
      hookTexts: body.options?.hookTexts ?? [],
      shuffleBody: !!body.options?.shuffleBody,
      lockedBodyIndexes: body.options?.lockedBodyIndexes ?? [],
      maxVariants: Math.min(Number(body.options?.maxVariants) || 10, 100),
      seed: Number(body.options?.seed) || 42,
    };
    if (!Array.isArray(base) || !base.length) {
      return NextResponse.json({ error: "Carosello base vuoto" }, { status: 400 });
    }

    const variants = expandVariants(base, opts);
    const batch = newBatchDir(projectId, body.name ?? "variants");
    const made: string[] = [];

    for (const v of variants) {
      const dir = path.join(batch, v.name);
      fs.mkdirSync(dir, { recursive: true });
      await exportCarouselPngs(v.slides, dir);
      made.push(v.name);
    }

    const zipPath = batch + ".zip";
    await zipDir(batch, zipPath);

    return NextResponse.json({
      count: made.length,
      variants: made,
      zipUrl: exportUrl(zipPath),
      dirUrl: exportUrl(batch),
      dir: path.basename(batch),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
