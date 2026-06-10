import fs from "fs";
import path from "path";
import { EXPORTS_DIR } from "@/lib/paths";

export const runtime = "nodejs";

const MIME: Record<string, string> = {
  png: "image/png",
  mp4: "video/mp4",
  zip: "application/zip",
};

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await params;
  const rel = parts.map(decodeURIComponent).join(path.sep);
  const abs = path.resolve(EXPORTS_DIR, rel);
  if (!abs.startsWith(path.resolve(EXPORTS_DIR))) return new Response("Forbidden", { status: 403 });
  if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) {
    // directory: lista file scaricabili
    if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
      const list = fs.readdirSync(abs, { recursive: true }) as string[];
      return Response.json(list);
    }
    return new Response("Not found", { status: 404 });
  }
  const ext = abs.split(".").pop()!.toLowerCase();
  const buf = fs.readFileSync(abs);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${path.basename(abs)}"`,
    },
  });
}
