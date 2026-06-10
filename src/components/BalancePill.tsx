"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight, Wallet } from "lucide-react";
import { getJson } from "@/lib/clientApi";
import { formatCents, QUALITY_LABEL } from "@/lib/costs";
import type { UsageSummary } from "@/lib/types";

// Pill del saldo (in alto a destra): clic → popover con saldo stimato e immagini rimaste.
export function BalancePill() {
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = () => getJson<UsageSummary>("/api/usage").then(setUsage).catch(() => {});

  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (open) load();
  }, [open]);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const low = usage && usage.topupCents > 0 && usage.balanceCents <= usage.topupCents * 0.15;
  const noBudget = !usage || usage.topupCents === 0;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] transition ${
          low ? "border-amber-500/40 bg-amber-500/10 text-amber-300" : "border-[#2a2a30] bg-[#1d1d21] text-zinc-300 hover:border-[#3c3c44]"
        }`}
      >
        {low ? <AlertTriangle size={12} /> : <Wallet size={12} className="text-zinc-500" />}
        {noBudget ? (
          <span className="text-zinc-400">Saldo —</span>
        ) : (
          <>
            <span className="font-semibold text-white">{formatCents(usage!.balanceCents)}</span>
            <span className="text-zinc-500">·</span>
            <span className="text-zinc-400">{usage!.imagesRemaining.high.toLocaleString("it-IT")} img alta</span>
          </>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[280px] overflow-hidden rounded-2xl border border-[#2a2a30] bg-[#161619] shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
          <div className="border-b border-[#222227] px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-600">Saldo stimato</div>
            <div className="mt-0.5 text-[22px] font-bold tracking-tight text-white">
              {usage ? formatCents(usage.balanceCents) : "—"}
            </div>
            {usage && (
              <div className="mt-0.5 text-[10.5px] text-zinc-500">
                {formatCents(usage.spentCents)} spesi · {formatCents(usage.topupCents)} caricati
              </div>
            )}
          </div>

          <div className="px-4 py-3">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-600">Immagini rimaste</div>
            {noBudget ? (
              <p className="text-[11px] leading-relaxed text-zinc-500">
                Registra quanto hai caricato su OpenAI in Impostazioni per vedere saldo e immagini rimaste.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {(["low", "medium", "high"] as const).map((q) => (
                  <div key={q} className="rounded-xl border border-[#26262b] bg-[#1d1d21] px-2 py-2 text-center">
                    <div className="text-[15px] font-bold text-zinc-100">
                      {usage!.imagesRemaining[q].toLocaleString("it-IT")}
                    </div>
                    <div className="text-[9px] text-zinc-500">{QUALITY_LABEL[q]}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Link
            href="/settings"
            className="flex items-center gap-2 border-t border-[#222227] px-4 py-2.5 text-[11px] font-medium text-zinc-300 transition hover:bg-white/[0.03]"
          >
            <Wallet size={13} className="text-zinc-500" />
            Gestisci budget e API key
            <ChevronRight size={13} className="ml-auto text-zinc-600" />
          </Link>
        </div>
      )}
    </div>
  );
}
