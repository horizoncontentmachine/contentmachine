// Layout del text overlay stile TikTok: testo bold bianco su "pillole" scure, una per riga.
// Isomorfo: usato sia dal preview nel browser sia dal flatten server-side (stesso wrapping,
// stessa geometria), così quello che vedi è quello che esporti.

import type { OverlaySpec } from "./types";

export const CANVAS_W = 1080;
export const CANVAS_H = 1920;

// Stima larghezza media carattere per font bold sans (wrapping deterministico senza metriche reali)
const CHAR_W = 0.62;

export interface OverlayLayout {
  fontSize: number;
  lines: { text: string; pillW: number }[];
  pillH: number;
  gap: number;
  padX: number;
  radius: number;
  blockTop: number; // y del bordo superiore della prima pillola
  lineAdvance: number; // pillH + gap
}

export function layoutOverlay(spec: OverlaySpec, canvasW = CANVAS_W, canvasH = CANVAS_H): OverlayLayout | null {
  const text = (spec.text ?? "").trim();
  if (!text) return null;
  const scale = canvasW / CANVAS_W;
  const fontSize = spec.fontSizePx * scale;
  const padX = fontSize * 0.45;
  const padY = fontSize * 0.3;
  const pillH = fontSize + padY * 2;
  const gap = fontSize * 0.16;
  const maxTextW = canvasW * (spec.maxWidthPct / 100) - padX * 2;

  const lines: { text: string; pillW: number }[] = [];
  for (const rawLine of text.split("\n")) {
    const words = rawLine.split(/\s+/).filter(Boolean);
    if (!words.length) continue;
    let cur = "";
    for (const w of words) {
      const cand = cur ? cur + " " + w : w;
      if (estWidth(cand, fontSize) > maxTextW && cur) {
        lines.push(mkLine(cur, fontSize, padX));
        cur = w;
      } else {
        cur = cand;
      }
    }
    if (cur) lines.push(mkLine(cur, fontSize, padX));
  }
  if (!lines.length) return null;

  const totalH = lines.length * pillH + (lines.length - 1) * gap;
  const blockTop = (spec.yPct / 100) * canvasH - totalH / 2;

  return {
    fontSize,
    lines,
    pillH,
    gap,
    padX,
    radius: fontSize * 0.24,
    blockTop,
    lineAdvance: pillH + gap,
  };
}

function estWidth(s: string, fontSize: number): number {
  return s.length * fontSize * CHAR_W;
}

function mkLine(text: string, fontSize: number, padX: number) {
  return { text, pillW: estWidth(text, fontSize) + padX * 2 };
}

const FONT_STACK = "Helvetica Neue, Helvetica, Arial, sans-serif";

export function overlaySvg(spec: OverlaySpec, canvasW = CANVAS_W, canvasH = CANVAS_H): string | null {
  const lay = layoutOverlay(spec, canvasW, canvasH);
  if (!lay) return null;
  const scale = canvasW / CANVAS_W;
  const outline = spec.style === "outline";
  const strokeW = (spec.strokePx ?? 9) * scale;
  const cx = canvasW / 2;
  let parts = "";
  lay.lines.forEach((line, i) => {
    const top = lay.blockTop + i * lay.lineAdvance;
    const x = cx - line.pillW / 2;
    // baseline ~ top + padY + 80% del font size
    const baseline = top + (lay.pillH - lay.fontSize) / 2 + lay.fontSize * 0.8;
    const common = `x="${n(cx)}" y="${n(baseline)}" text-anchor="middle" font-family="${FONT_STACK}" font-weight="800" font-size="${n(lay.fontSize)}"`;
    if (outline) {
      // paint-order=stroke: il contorno sta sotto, il riempimento resta nitido
      parts += `<text ${common} fill="${esc(spec.textColor)}" stroke="${esc(spec.barColor)}" stroke-width="${n(strokeW)}" stroke-linejoin="round" paint-order="stroke">${esc(line.text)}</text>`;
    } else {
      parts += `<rect x="${n(x)}" y="${n(top)}" width="${n(line.pillW)}" height="${n(lay.pillH)}" rx="${n(lay.radius)}" fill="${esc(spec.barColor)}" fill-opacity="${spec.barOpacity}"/>`;
      parts += `<text ${common} fill="${esc(spec.textColor)}">${esc(line.text)}</text>`;
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasW}" height="${canvasH}" viewBox="0 0 ${canvasW} ${canvasH}">${parts}</svg>`;
}

function n(v: number): string {
  return v.toFixed(1);
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
