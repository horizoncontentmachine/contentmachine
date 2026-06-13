"use client";

import { zipSync } from "fflate";
import { layoutOverlay, CANVAS_W, CANVAS_H } from "./overlay";
import type { OverlaySpec, SlideInput } from "./types";

// Export 100% lato browser: <canvas> compone immagine (cover-crop 9:16) + overlay,
// poi fflate fa lo zip. Stesso layout di OverlayPreview → WYSIWYG. Nessun costo, nessun server.

const FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';

function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || "").trim());
  if (!m) return `rgba(0,0,0,${alpha})`;
  const v = parseInt(m[1], 16);
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${alpha})`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("immagine non caricata: " + src));
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawOverlay(ctx: CanvasRenderingContext2D, h: number, spec?: OverlaySpec | null) {
  if (!spec || !spec.text?.trim()) return;
  const lay = layoutOverlay(spec, CANVAS_W, h);
  if (!lay) return;
  const cx = CANVAS_W / 2;
  const outline = spec.style === "outline";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = `800 ${lay.fontSize}px ${FONT}`;

  lay.lines.forEach((line, i) => {
    const top = lay.blockTop + i * lay.lineAdvance;
    const baseline = top + (lay.pillH - lay.fontSize) / 2 + lay.fontSize * 0.8;
    if (outline) {
      ctx.lineJoin = "round";
      ctx.strokeStyle = spec.barColor;
      ctx.lineWidth = spec.strokePx ?? 9;
      ctx.strokeText(line.text, cx, baseline);
      ctx.fillStyle = spec.textColor;
      ctx.fillText(line.text, cx, baseline);
    } else {
      const x = cx - line.pillW / 2;
      ctx.fillStyle = hexToRgba(spec.barColor, spec.barOpacity);
      roundRect(ctx, x, top, line.pillW, lay.pillH, lay.radius);
      ctx.fill();
      ctx.fillStyle = spec.textColor;
      ctx.fillText(line.text, cx, baseline);
    }
  });
}

async function renderSlideBlob(slide: SlideInput, fmtH: number): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_W;
  canvas.height = fmtH;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, CANVAS_W, fmtH);

  const img = await loadImage(`/api/assets/${slide.assetKey}`);
  const scale = Math.max(CANVAS_W / img.width, fmtH / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (CANVAS_W - w) / 2, (fmtH - h) / 2, w, h);

  drawOverlay(ctx, fmtH, slide.overlay);

  return new Promise((res) => canvas.toBlob((b) => res(b!), "image/png"));
}

async function renderSlidePng(slide: SlideInput, fmtH: number): Promise<Uint8Array> {
  return new Uint8Array(await (await renderSlideBlob(slide, fmtH)).arrayBuffer());
}

// PNG finali (con overlay) pronti per la pubblicazione, nel formato della piattaforma.
export async function renderSlideBlobs(slides: SlideInput[], fmtH: number = CANVAS_H): Promise<Blob[]> {
  const out: Blob[] = [];
  for (const s of slides) out.push(await renderSlideBlob(s, fmtH));
  return out;
}

function triggerDownload(bytes: Uint8Array, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function safe(s: string): string {
  return (s || "export").replace(/[^a-zA-Z0-9_.-]+/g, "_").slice(0, 60);
}

// nome cartella leggibile dall'hook (es. "POV la tua colazione" → "pov-la-tua-colazione")
function hookSlug(hook?: string): string {
  if (!hook) return "";
  const s = hook
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return s ? ` - ${s}` : "";
}

// Un singolo carosello → zip di PNG numerati, nel formato dato.
export async function downloadCarousel(name: string, slides: SlideInput[], fmtH: number = CANVAS_H): Promise<void> {
  const files: Record<string, Uint8Array> = {};
  for (let i = 0; i < slides.length; i++) {
    files[`${String(i + 1).padStart(2, "0")}_${slides[i].role}.png`] = await renderSlidePng(slides[i], fmtH);
  }
  triggerDownload(zipSync(files), `${safe(name)}.zip`, "application/zip");
}

// Più varianti → zip con una cartella per variante, nominata con l'hook (es. "C1.0 - pov-la-tua-colazione/").
export async function downloadGroups(
  name: string,
  groups: { label: string; hook?: string; slides: SlideInput[] }[],
  fmtH: number = CANVAS_H
): Promise<number> {
  const files: Record<string, Uint8Array> = {};
  for (const g of groups) {
    const folder = safe(`${g.label}${hookSlug(g.hook)}`);
    for (let i = 0; i < g.slides.length; i++) {
      files[`${folder}/${String(i + 1).padStart(2, "0")}_${g.slides[i].role}.png`] = await renderSlidePng(g.slides[i], fmtH);
    }
  }
  triggerDownload(zipSync(files), `${safe(name)}.zip`, "application/zip");
  return groups.length;
}
