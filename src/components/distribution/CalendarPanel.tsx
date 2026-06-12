"use client";

import { CalendarClock } from "lucide-react";

export function CalendarPanel() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <h2 className="text-[16px] font-semibold tracking-tight text-zinc-100">Calendario</h2>
      <p className="mt-0.5 text-[12px] text-zinc-500">Programmazione automatica 2-3 post/giorno per account.</p>
      <div className="mt-6 grid place-items-center rounded-2xl border border-dashed border-[#2a2a30] p-12 text-center">
        <CalendarClock size={28} className="mb-3 text-zinc-600" />
        <div className="text-[13px] font-medium text-zinc-300">In arrivo (Fase 2)</div>
        <p className="mt-1 max-w-sm text-[11.5px] leading-relaxed text-zinc-600">
          Slot ricorrenti per account e coda che si riempie automaticamente dalle varianti generate, con pubblicazione via
          cron. Per ora usa <span className="text-zinc-400">Pubblica ora</span> dall&apos;area Output.
        </p>
      </div>
    </div>
  );
}
