import { NextResponse } from "next/server";
import { bufferHash } from "@/lib/hash";
import { storeAsset } from "@/lib/assets";
import { getAsset } from "@/lib/db";

export const runtime = "nodejs";

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export async function POST(req: Request) {
  try {
    const fd = await req.formData();
    const file = fd.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Nessun file" }, { status: 400 });
    if (!file.type.startsWith("image/")) return NextResponse.json({ error: "Carica un'immagine" }, { status: 400 });

    const bytes = new Uint8Array(await file.arrayBuffer());
    const ext = EXT_BY_MIME[file.type] || (file.name.split(".").pop() ?? "png").toLowerCase();
    const key = "up_" + (await bufferHash(bytes));

    const cached = await getAsset(key);
    if (cached) return NextResponse.json({ asset: cached, cacheHit: true });

    const rec = await storeAsset({ key, kind: "image", bytes, ext, costCents: 0, prompt: file.name });
    return NextResponse.json({ asset: rec, cacheHit: false });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
