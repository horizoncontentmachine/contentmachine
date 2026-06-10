import { getAsset } from "@/lib/db";
import { assetFilePath } from "@/lib/assets";
import fs from "fs";

export const runtime = "nodejs";

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
  mp4: "video/mp4",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
};

export async function GET(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const rec = getAsset(key);
  if (!rec) return new Response("Not found", { status: 404 });
  const norm = new URL(req.url).searchParams.get("norm") === "1";
  const file = assetFilePath(rec, norm);
  if (!fs.existsSync(file)) return new Response("File missing", { status: 404 });
  const ext = file.split(".").pop()!.toLowerCase();
  const buf = fs.readFileSync(file);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
