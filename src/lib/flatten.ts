import sharp from "sharp";
import fs from "fs";
import type { OverlaySpec } from "./types";
import { overlaySvg, CANVAS_W, CANVAS_H } from "./overlay";

// PNG trasparente 1080x1920 con solo il layer testo (per comporre su immagini o video).
export async function renderOverlayPng(spec: OverlaySpec): Promise<Buffer | null> {
  const svg = overlaySvg(spec, CANVAS_W, CANVAS_H);
  if (!svg) return null;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// Immagine normalizzata + overlay → PNG finale pronto per l'export.
export async function flattenSlide(normalizedPngPath: string, overlay?: OverlaySpec | null): Promise<Buffer> {
  const base = fs.readFileSync(normalizedPngPath);
  if (!overlay || !overlay.text?.trim()) return base;
  const ovl = await renderOverlayPng(overlay);
  if (!ovl) return base;
  return sharp(base)
    .composite([{ input: ovl, top: 0, left: 0 }])
    .png()
    .toBuffer();
}
