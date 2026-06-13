import { NextResponse } from "next/server";
import { stableHash } from "@/lib/hash";
import { generateImage, imageModel, DEFAULT_IMAGE_SIZE } from "@/lib/openaiImages";
import { storeAsset, readAsset } from "@/lib/assets";
import { addLedgerEntry, getAsset } from "@/lib/db";
import { estimateImageCents, type ImageQuality } from "@/lib/costs";
import { PLATFORM_FORMAT } from "@/lib/formats";
import type { Platform } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const projectId: string = body.projectId;
    const prompt: string = (body.prompt ?? "").trim();
    const quality: ImageQuality = ["low", "medium", "high"].includes(body.quality) ? body.quality : "low";
    const refKeys: string[] = Array.isArray(body.refKeys) ? body.refKeys : [];
    const platform = body.platform as Platform | undefined;
    const size = platform && PLATFORM_FORMAT[platform] ? PLATFORM_FORMAT[platform].openaiSize : DEFAULT_IMAGE_SIZE;
    if (!prompt) return NextResponse.json({ error: "Prompt vuoto" }, { status: 400 });

    const model = await imageModel();
    const key = "img_" + (await stableHash({ model, size, prompt, quality, refKeys }));

    const cached = await getAsset(key);
    if (cached) {
      await addLedgerEntry({ projectId, model, label: prompt.slice(0, 80), costCents: 0, cacheHit: true });
      return NextResponse.json({ asset: cached, cacheHit: true, costCents: 0 });
    }

    const refs: Uint8Array[] = [];
    for (const k of refKeys) {
      const a = await readAsset(k);
      if (a) refs.push(new Uint8Array(a.bytes));
    }

    const bytes = await generateImage({ prompt, quality, size, refs });
    const costCents = estimateImageCents(quality);
    const rec = await storeAsset({ key, kind: "image", bytes, ext: "png", model, prompt, costCents });
    await addLedgerEntry({ projectId, model, label: prompt.slice(0, 80), costCents, cacheHit: false });
    return NextResponse.json({ asset: rec, cacheHit: false, costCents });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
