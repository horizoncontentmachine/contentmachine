// Stime di costo in CENTESIMI di dollaro. Aggiorna qui se i listini cambiano.
// Fonte: pricing OpenAI gpt-image-2 a 1024x1536.

export type ImageQuality = "low" | "medium" | "high";

export const IMAGE_COST_CENTS: Record<ImageQuality, number> = {
  low: 0.6, // bozze / varianti
  medium: 6,
  high: 21, // solo finale
};

export const QUALITY_LABEL: Record<ImageQuality, string> = {
  low: "Bozza",
  medium: "Media",
  high: "Alta",
};

export function estimateImageCents(quality: ImageQuality): number {
  return IMAGE_COST_CENTS[quality];
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(cents < 10 ? 3 : 2)}`;
}
