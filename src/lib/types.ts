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

export interface Graph {
  nodes: unknown[];
  edges: unknown[];
  viewport?: unknown;
}

// Un workflow = una canvas dedicata a una piattaforma (con il suo formato).
export interface Workflow {
  id: string;
  name: string;
  platform: Platform;
  graph: Graph;
}

export interface Project {
  id: string;
  name: string;
  niche: string;
  workflows: Workflow[];
  graph?: Graph; // legacy (pre-workflow): migrato in workflows alla lettura
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
  uploadPostKey?: string; // chiave aggregatore di pubblicazione (Upload-Post)
  topups: TopUp[];
  drive: DriveConfig;
}

export const DEFAULT_SETTINGS: AppSettings = {
  topups: [],
  drive: {},
};

// ---- Distribuzione / pubblicazione ----

export type Platform = "instagram" | "tiktok" | "x";

export const PLATFORM_LABEL: Record<Platform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  x: "X",
};

// Un account = un profilo Upload-Post dedicato → quanti account vuoi per piattaforma/progetto.
export interface SocialAccount {
  id: string;
  projectId: string;
  platform: Platform;
  handle?: string;
  providerProfile: string; // username Upload-Post
  status: "pending" | "connected";
  connectedAt?: string;
}

export type PostStatus = "queued" | "publishing" | "published" | "failed";

export interface PostRecord {
  id: string;
  projectId: string;
  createdAt: string;
  scheduledAt?: string | null; // null = pubblicato subito
  status: PostStatus;
  platforms: Platform[];
  accountIds?: string[]; // account target
  mediaKeys?: string[]; // chiavi KV immagini già flattenizzate (per il cron)
  caption?: string;
  slides?: SlideInput[]; // per anteprime nello Storico
  result?: unknown;
}

export interface PostingSlot {
  projectId: string;
  accountId: string;
  days: number[]; // 0=domenica .. 6=sabato
  times: string[]; // "09:00"
  timezone?: string;
}

export interface UsageSummary {
  spentCents: number; // somma reale dal ledger (no cache hit)
  topupCents: number; // somma ricariche registrate
  balanceCents: number; // topup - spent (stima)
  imagesGenerated: number;
  imagesRemaining: { low: number; medium: number; high: number };
  byProject: { id: string; name: string; spentCents: number }[];
}
