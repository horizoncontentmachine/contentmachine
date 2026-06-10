export type AssetKind = "image" | "video" | "audio";

export interface AssetRecord {
  key: string; // cache key (sha256 di modello+prompt+refs+settings, o content-hash per upload)
  kind: AssetKind;
  file: string; // nome file originale dentro data/assets/files
  normFile?: string; // versione 1080x1920 (solo immagini)
  model?: string;
  prompt?: string;
  costCents: number; // costo pagato alla generazione (0 per upload e cache-hit)
  width?: number;
  height?: number;
  durationSec?: number;
  createdAt: string;
}

// "bar" = testo su barra/pillola scura · "outline" = testo con contorno (stile TikTok classico)
export type OverlayStyle = "bar" | "outline";

export interface OverlaySpec {
  text: string;
  fontSizePx: number; // riferito a larghezza 1080
  yPct: number; // centro verticale del blocco testo, 0..100
  style?: OverlayStyle; // assente = "bar" (retrocompatibile)
  barOpacity: number; // 0..1 (solo per "bar")
  strokePx?: number; // spessore contorno a 1080 (solo per "outline")
  textColor: string; // riempimento del testo
  barColor: string; // colore barra ("bar") o colore contorno ("outline")
  maxWidthPct: number; // larghezza max blocco testo in % della canvas
}

export const DEFAULT_OVERLAY: OverlaySpec = {
  text: "",
  fontSizePx: 58,
  yPct: 14,
  style: "bar",
  barOpacity: 0.72,
  strokePx: 9,
  textColor: "#FFFFFF",
  barColor: "#000000",
  maxWidthPct: 84,
};

export type SlideRole = "HOOK" | "BODY" | "CTA";

export interface SlideInput {
  role: SlideRole;
  assetKey: string;
  overlay?: OverlaySpec | null;
}

export interface Project {
  id: string;
  name: string;
  niche: string;
  graph: { nodes: unknown[]; edges: unknown[]; viewport?: unknown };
  spentCents: number;
  createdAt: string;
  updatedAt: string;
}

export type VaultType = "image" | "hook";

export interface VaultEntry {
  id: string;
  niche: string;
  type: VaultType;
  text: string;
  createdAt: string;
}

export interface LedgerEntry {
  id: string;
  projectId: string;
  model: string;
  label: string;
  costCents: number;
  cacheHit: boolean;
  createdAt: string;
}

export interface VariantOptions {
  hookTexts: string[];
  shuffleBody: boolean;
  lockedBodyIndexes: number[]; // indici BODY (0-based) che non vanno mai spostati
  maxVariants: number;
  seed: number;
}

// ---- Settings / saldo / Drive ----

export interface TopUp {
  cents: number; // ricarica registrata manualmente
  at: string;
  note?: string;
}

export interface DriveConfig {
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  rootFolderId?: string; // cartella radice in Drive (default: creata "ShortFlow")
  rootFolderName?: string;
  connectedEmail?: string;
}

export interface AppSettings {
  openaiKey?: string; // salvata dalla UI; l'env OPENAI_API_KEY ha precedenza
  topups: TopUp[];
  drive: DriveConfig;
}

export const DEFAULT_SETTINGS: AppSettings = {
  topups: [],
  drive: {},
};

export interface UsageSummary {
  spentCents: number; // somma reale dal ledger (no cache hit)
  topupCents: number; // somma ricariche registrate
  balanceCents: number; // topup - spent (stima)
  imagesGenerated: number;
  imagesRemaining: { low: number; medium: number; high: number };
  byProject: { id: string; name: string; spentCents: number }[];
}
