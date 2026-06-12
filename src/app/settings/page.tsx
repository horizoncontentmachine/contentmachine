"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, CloudUpload, ExternalLink, KeyRound, Loader2, Plus, Trash2, Wallet } from "lucide-react";
import { getJson, postJson } from "@/lib/clientApi";
import { formatCents, QUALITY_LABEL } from "@/lib/costs";
import type { TopUp, UsageSummary } from "@/lib/types";

interface SettingsView {
  openai: { source: "env" | "saved" | "none"; configured: boolean; masked: string | null };
  topups: TopUp[];
  topupCents: number;
  drive: {
    credsPresent: boolean;
    connected: boolean;
    connectedEmail: string | null;
    rootFolderName: string;
    redirectUri: string;
  };
}

function Section({ icon, title, desc, children }: { icon: React.ReactNode; title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#26262b] bg-[#161619] p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[#2e2e34] bg-[#1f1f23] text-zinc-400">
          {icon}
        </span>
        <div>
          <h2 className="text-[14px] font-semibold tracking-tight text-zinc-100">{title}</h2>
          {desc && <p className="mt-0.5 text-[11.5px] leading-relaxed text-zinc-500">{desc}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

const inputCls =
  "h-9 w-full rounded-lg border border-[#2a2a30] bg-[#1d1d21] px-3 text-[12.5px] text-zinc-200 placeholder-zinc-600 outline-none transition focus:border-zinc-500";
const ghostBtn =
  "inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#2e2e34] bg-[#202024] px-3 text-[12px] font-medium text-zinc-300 transition hover:border-[#454550] hover:text-white disabled:opacity-40";
const whiteBtn =
  "inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-4 text-[12px] font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-40";

export default function SettingsPage() {
  const [s, setS] = useState<SettingsView | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [topup, setTopup] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [sv, us] = await Promise.all([getJson<SettingsView>("/api/settings"), getJson<UsageSummary>("/api/usage")]);
    setS(sv);
    setUsage(us);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const save = async (body: Record<string, unknown>, tag: string) => {
    setBusy(tag);
    try {
      await postJson("/api/settings", body);
      await reload();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="h-screen overflow-y-auto">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <div className="mb-8 flex items-center gap-3">
          <Link href="/" className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 transition hover:bg-[#222227] hover:text-zinc-200">
            <ArrowLeft size={15} />
          </Link>
          <h1 className="text-[20px] font-bold tracking-tight text-white">Impostazioni</h1>
        </div>

        <div className="space-y-4">
          {/* OpenAI */}
          <Section
            icon={<KeyRound size={15} />}
            title="OpenAI · GPT Image 2"
            desc="La chiave resta solo sul tuo computer e viaggia solo lato server, mai esposta al browser."
          >
            <div className="mb-3 flex items-center gap-2 text-[12px]">
              {s?.openai.configured ? (
                <>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-600/30 bg-emerald-600/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
                    <Check size={11} /> Collegata
                  </span>
                  <span className="font-mono text-zinc-500">{s.openai.masked}</span>
                  <span className="text-[10.5px] text-zinc-600">
                    ({s.openai.source === "env" ? "da .env.local" : "salvata qui"})
                  </span>
                </>
              ) : (
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-300">
                  Non collegata
                </span>
              )}
            </div>
            {s?.openai.source === "env" ? (
              <p className="text-[11.5px] leading-relaxed text-zinc-500">
                Stai usando la chiave da <span className="font-mono text-zinc-400">.env.local</span>. Per gestirla da qui,
                rimuovila dall&apos;env e incollala sotto.
              </p>
            ) : (
              <div className="flex gap-2">
                <input
                  className={inputCls}
                  type="password"
                  placeholder="sk-…"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                />
                <button
                  className={whiteBtn}
                  disabled={!keyInput.trim() || busy === "key"}
                  onClick={() => save({ openaiKey: keyInput }, "key").then(() => setKeyInput(""))}
                >
                  {busy === "key" ? <Loader2 size={13} className="animate-spin" /> : "Salva"}
                </button>
                {s?.openai.configured && (
                  <button className={ghostBtn} disabled={busy === "key"} onClick={() => save({ clearOpenaiKey: true }, "key")}>
                    Rimuovi
                  </button>
                )}
              </div>
            )}
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300"
            >
              Crea/gestisci la chiave su platform.openai.com <ExternalLink size={10} />
            </a>
          </Section>

          {/* Budget */}
          <Section
            icon={<Wallet size={15} />}
            title="Budget e saldo"
            desc="OpenAI non espone il saldo prepagato via API: registra qui le ricariche e l'app calcola saldo stimato e immagini rimaste in base a quanto generi."
          >
            <div className="grid grid-cols-3 gap-2.5">
              <div className="rounded-xl border border-[#26262b] bg-[#1d1d21] p-3">
                <div className="text-[10px] uppercase tracking-wide text-zinc-600">Saldo stimato</div>
                <div className="mt-0.5 text-[18px] font-bold text-white">{usage ? formatCents(usage.balanceCents) : "—"}</div>
              </div>
              <div className="rounded-xl border border-[#26262b] bg-[#1d1d21] p-3">
                <div className="text-[10px] uppercase tracking-wide text-zinc-600">Speso</div>
                <div className="mt-0.5 text-[18px] font-bold text-zinc-200">{usage ? formatCents(usage.spentCents) : "—"}</div>
              </div>
              <div className="rounded-xl border border-[#26262b] bg-[#1d1d21] p-3">
                <div className="text-[10px] uppercase tracking-wide text-zinc-600">Immagini fatte</div>
                <div className="mt-0.5 text-[18px] font-bold text-zinc-200">{usage?.imagesGenerated ?? "—"}</div>
              </div>
            </div>

            {usage && usage.topupCents > 0 && (
              <div className="mt-2.5 grid grid-cols-3 gap-2.5">
                {(["low", "medium", "high"] as const).map((q) => (
                  <div key={q} className="rounded-xl border border-[#26262b] bg-[#161619] px-3 py-2 text-center">
                    <div className="text-[15px] font-bold text-zinc-100">{usage.imagesRemaining[q].toLocaleString("it-IT")}</div>
                    <div className="text-[9px] text-zinc-500">img rimaste · {QUALITY_LABEL[q]}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12.5px] text-zinc-500">$</span>
                <input
                  className={inputCls + " pl-6"}
                  type="number"
                  step="1"
                  min="0"
                  placeholder="Quanto hai ricaricato (es. 20)"
                  value={topup}
                  onChange={(e) => setTopup(e.target.value)}
                />
              </div>
              <button
                className={whiteBtn}
                disabled={!Number(topup) || busy === "topup"}
                onClick={() => save({ addTopupCents: Math.round(Number(topup) * 100) }, "topup").then(() => setTopup(""))}
              >
                {busy === "topup" ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Registra ricarica
              </button>
            </div>

            {s && s.topups.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {s.topups.map((t) => (
                  <div key={t.at} className="flex items-center gap-3 rounded-lg border border-[#26262b] bg-[#1d1d21] px-3 py-2 text-[11.5px]">
                    <span className="font-semibold text-zinc-200">{formatCents(t.cents)}</span>
                    <span className="text-zinc-600">{new Date(t.at).toLocaleDateString("it-IT")}</span>
                    <div className="flex-1" />
                    <button
                      onClick={() => save({ removeTopupAt: t.at }, "rm" + t.at)}
                      className="grid h-6 w-6 place-items-center rounded-md text-zinc-600 hover:text-red-400"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Google Drive — rimandato sulla versione cloud */}
          <Section
            icon={<CloudUpload size={15} />}
            title="Google Drive"
            desc="Salvataggio dei caroselli direttamente su Drive (una cartella per variante)."
          >
            <div className="rounded-xl border border-[#26262b] bg-[#1d1d21] p-3 text-[11.5px] leading-relaxed text-zinc-400">
              Presto disponibile. Per ora scarichi i caroselli come ZIP dall&apos;area Output (immagini in ordine, una
              cartella per variante) e li carichi dove vuoi.
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
