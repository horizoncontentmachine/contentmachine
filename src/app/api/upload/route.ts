import { NextResponse } from "next/server";
import { bufferHash } from "@/lib/hash";
import { storeAsset } from "@/lib/assets";
import { getAsset } from "@/lib/db";
import type { AssetKind } from "@/lib/types";

export const runtime = "nodejs";

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-m4a": "m4a",
  "audio/mp4": "m4a",
};

export async function POST(req: Request) {
  try {
    const fd = await req.formData();
    const file = fd.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Nessun file" }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const mime = file.type || "application/octet-stream";
    const kind: AssetKind = mime.startsWith("video/")
      ? "video"
      : mime.startsWith("audio/")
        ? "audio"
        : "image";
    const ext = EXT_BY_MIME[mime] || (file.name.split(".").pop() ?? "bin").toLowerCase();
    const key = "up_" + bufferHash(buf);

    const cached = getAsset(key);
    if (cached) return NextResponse.json({ asset: cached, cacheHit: true });

    const rec = await storeAsset({ key, kind, buf, ext, costCents: 0, prompt: file.name });
    return NextResponse.json({ asset: rec, cacheHit: false });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
