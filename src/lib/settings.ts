import { cfEnv } from "./cf";
import { getSettings, listLedger, listProjects } from "./db";
import { IMAGE_COST_CENTS } from "./costs";
import type { UsageSummary } from "./types";

// La chiave OpenAI: env (precedenza) o salvata dalla UI in D1 (settings).
export async function resolveOpenAIKey(): Promise<string | null> {
  const env = (await cfEnv()).OPENAI_API_KEY?.trim();
  if (env) return env;
  const saved = (await getSettings()).openaiKey?.trim();
  return saved || null;
}

export async function openAIKeySource(): Promise<"env" | "saved" | "none"> {
  if ((await cfEnv()).OPENAI_API_KEY?.trim()) return "env";
  if ((await getSettings()).openaiKey?.trim()) return "saved";
  return "none";
}

// Chiave aggregatore di pubblicazione (Upload-Post): env o salvata dalla UI.
export async function resolveUploadPostKey(): Promise<string | null> {
  const env = (await cfEnv()).UPLOAD_POST_API_KEY?.trim();
  if (env) return env;
  const saved = (await getSettings()).uploadPostKey?.trim();
  return saved || null;
}

// Chiave DuoPlus (cloud phone): env o salvata dalla UI.
export async function resolveDuoplusKey(): Promise<string | null> {
  const env = (await cfEnv()).DUOPLUS_API_KEY?.trim();
  if (env) return env;
  const saved = (await getSettings()).duoplusKey?.trim();
  return saved || null;
}

export function maskKey(key?: string | null): string | null {
  if (!key) return null;
  if (key.length <= 10) return "•".repeat(key.length);
  return key.slice(0, 5) + "••••••" + key.slice(-4);
}

// Saldo = ricariche registrate − speso reale (dal ledger). OpenAI non espone il saldo via API.
export async function computeUsage(): Promise<UsageSummary> {
  const ledger = await listLedger();
  const real = ledger.filter((e) => !e.cacheHit && e.costCents > 0);
  const spentCents = real.reduce((a, e) => a + e.costCents, 0);
  const imagesGenerated = real.length;

  const topupCents = (await getSettings()).topups.reduce((a, t) => a + t.cents, 0);
  const balanceCents = Math.max(0, topupCents - spentCents);

  const imagesRemaining = {
    low: Math.floor(balanceCents / IMAGE_COST_CENTS.low),
    medium: Math.floor(balanceCents / IMAGE_COST_CENTS.medium),
    high: Math.floor(balanceCents / IMAGE_COST_CENTS.high),
  };

  const byProject = (await listProjects())
    .map((p) => ({ id: p.id, name: p.name, spentCents: p.spentCents }))
    .filter((p) => p.spentCents > 0)
    .sort((a, b) => b.spentCents - a.spentCents);

  return { spentCents, topupCents, balanceCents, imagesGenerated, imagesRemaining, byProject };
}
