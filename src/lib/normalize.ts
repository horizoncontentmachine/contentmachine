import sharp from "sharp";
import { CANVAS_W, CANVAS_H } from "./overlay";

// Tutto il prodotto è 9:16 1080x1920: ogni immagine viene portata lì con cover-crop centrale.
export async function normalizeImageTo916(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .resize(CANVAS_W, CANVAS_H, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();
}

export async function imageMeta(buf: Buffer): Promise<{ width?: number; height?: number }> {
  const m = await sharp(buf).metadata();
  return { width: m.width, height: m.height };
}
