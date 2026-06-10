import { getSettings, listLedger, listProjects } from "./db";
import { IMAGE_COST_CENTS } from "./costs";
import type { UsageSummary } from "./types";

// La chiave OpenAI può venire dall'env (precedenza) o essere salvata dalla UI in settings.json.
export function resolveOpenAIKey(): string | null {
  const env = process.env.OPENAI_API_KEY?.trim();
  if (env) return env;
  const saved = getSettings().openaiKey?.trim();
  return saved || null;
}

export function openAIKeySource(): "env" | "saved" | "none" {
  if (process.env.OPENAI_API_KEY?.trim()) return "env";
  if (getSettings().openaiKey?.trim()) return "saved";
  return "none";
}

export function maskKey(key?: string | null): string | null {
  if (!key) return null;
  if (key.length <= 10) return "•".repeat(key.length);
  return key.slice(0, 5) + "••••••" + key.slice(-4);
}

// Saldo = ricariche registrate − speso reale (dal ledger). OpenAI non espone il saldo
// prepagato via API key, quindi è una stima basata su quanto l'utente dichiara di aver caricato.
export function computeUsage(): UsageSummary {
  const ledger = listLedger();
  const spentCents = ledger
    .filter((e) => !e.cacheHit && e.costCents > 0)
    .reduce((a, e) => a + e.costCents, 0);
  const imagesGenerated = ledger.filter((e) => !e.cacheHit && e.costCents > 0).length;

  const topupCents = getSettings().topups.reduce((a, t) => a + t.cents, 0);
  const balanceCents = Math.max(0, topupCents - spentCents);

  const imagesRemaining = {
    low: Math.floor(balanceCents / IMAGE_COST_CENTS.low),
    medium: Math.floor(balanceCents / IMAGE_COST_CENTS.medium),
    high: Math.floor(balanceCents / IMAGE_COST_CENTS.high),
  };

  const byProject = listProjects()
    .map((p) => ({ id: p.id, name: p.name, spentCents: p.spentCents }))
    .filter((p) => p.spentCents > 0)
    .sort((a, b) => b.spentCents - a.spentCents);

  return { spentCents, topupCents, balanceCents, imagesGenerated, imagesRemaining, byProject };
}
