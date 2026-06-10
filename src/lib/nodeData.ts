import type { OverlaySpec } from "./types";

// Shape dei dati dentro node.data per ogni tipo di blocco.
// Ogni blocco ha `n`: numero progressivo per tipo, mostrato nel titolo ("Immagine #3").

export interface GenResult {
  key: string;
  kind: "image";
  costCents?: number;
  cached?: boolean;
}

export interface PromptData {
  text: string;
  n: number;
  [k: string]: unknown;
}

export interface ImageGenData {
  quality: "low" | "medium" | "high";
  results: GenResult[]; // history: ogni generazione si accoda, il pager sfoglia
  activeIndex: number;
  n: number;
  [k: string]: unknown;
}

export interface UploadData {
  result: GenResult | null;
  fileName?: string;
  n: number;
  [k: string]: unknown;
}

export interface OverlayData {
  overlay: OverlaySpec;
  n: number;
  [k: string]: unknown;
}

export interface ExportInfo {
  zipUrl?: string;
  dirUrl?: string;
  count?: number;
  at: string;
}

export interface CarouselData {
  bodyCount: number;
  lastExport: ExportInfo | null;
  n: number;
  [k: string]: unknown;
}

export interface VariantsData {
  hookTexts: string;
  shuffleBody: boolean;
  locked: string; // es. "1,3" = primo e terzo slot BODY bloccati (1-based)
  maxVariants: number;
  seed: number;
  lastExport: ExportInfo | null;
  n: number;
  [k: string]: unknown;
}

export type NodeKind = "prompt" | "imageGen" | "upload" | "overlay" | "carousel" | "variants";

export function activeResult(d: ImageGenData): GenResult | null {
  return d.results[d.activeIndex] ?? d.results[d.results.length - 1] ?? null;
}
