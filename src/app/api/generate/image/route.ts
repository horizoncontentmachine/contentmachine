import { NextResponse } from "next/server";
import { stableHash } from "@/lib/hash";
import { generateImage, OPENAI_IMAGE_MODEL, OPENAI_IMAGE_SIZE } from "@/lib/openaiImages";
import { storeAsset, readAssetFile } from "@/lib/assets";
import { addLedgerEntry, getAsset } from "@/lib/db";
import { estimateImageCents, type ImageQuality } from "@/lib/costs";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const projectId: string = body.projectId;
    const prompt: string = (body.prompt ?? "").trim();
    const quality: ImageQuality = ["low", "medium", "high"].includes(body.quality)
      ? body.quality
      : "low";
    const refKeys: string[] = Array.isArray(body.refKeys) ? body.refKeys : [];
    if (!prompt) return NextResponse.json({ error: "Prompt vuoto" }, { status: 400 });

    const key =
      "img_" +
      stableHash({ model: OPENAI_IMAGE_MODEL, size: OPENAI_IMAGE_SIZE, prompt, quality, refKeys });

    // cache per hash: stesso modello+prompt+refs+settings → riusa, costo zero
    const cached = getAsset(key);
    if (cached) {
      addLedgerEntry({
        projectId,
        model: OPENAI_IMAGE_MODEL,
        label: prompt.slice(0, 80),
        costCents: 0,
        cacheHit: true,
      });
      return NextResponse.json({ asset: cached, cacheHit: true, costCents: 0 });
    }

    const refs = refKeys.map((k) => {
      const rec = getAsset(k);
      if (!rec || rec.kind !== "image") throw new Error(`Reference mancante: ${k}`);
      return readAssetFile(rec, true);
    });

    const buf = await generateImage({ prompt, quality, refs });
    const costCents = estimateImageCents(quality);
    const rec = await storeAsset({
      key,
      kind: "image",
      buf,
      ext: "png",
      model: OPENAI_IMAGE_MODEL,
      prompt,
      costCents,
    });
    addLedgerEntry({
      projectId,
      model: OPENAI_IMAGE_MODEL,
      label: prompt.slice(0, 80),
      costCents,
      cacheHit: false,
    });
    return NextResponse.json({ asset: rec, cacheHit: false, costCents });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
