import type { Platform } from "./types";

// Formato ottimale per piattaforma. Larghezza sempre 1080; cambia l'altezza (e quindi il rapporto).
export interface PlatformFormat {
  platform: Platform;
  label: string; // nome breve formato (es. 9:16)
  ratio: string;
  w: number;
  h: number;
  maxImages: number;
}

export const PLATFORM_FORMAT: Record<Platform, PlatformFormat> = {
  tiktok: { platform: "tiktok", label: "TikTok", ratio: "9:16", w: 1080, h: 1920, maxImages: 35 },
  instagram: { platform: "instagram", label: "Instagram", ratio: "4:5", w: 1080, h: 1350, maxImages: 20 },
  x: { platform: "x", label: "X", ratio: "1:1", w: 1080, h: 1080, maxImages: 4 },
};

export const CANVAS_WIDTH = 1080;

export function formatFor(platform: Platform): PlatformFormat {
  return PLATFORM_FORMAT[platform];
}

// altezza in px del formato per una data larghezza di preview
export function previewHeight(platform: Platform, width: number): number {
  const f = PLATFORM_FORMAT[platform];
  return (width * f.h) / f.w;
}
