import { readAsset } from "@/lib/assets";

export const runtime = "nodejs";

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
};

export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const a = await readAsset(key);
  if (!a) return new Response("Not found", { status: 404 });
  return new Response(a.bytes, {
    headers: {
      "Content-Type": MIME[a.ext] || "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
