"use client";

import { useEffect, useState } from "react";
import { Lightbulb } from "lucide-react";
import { getJson } from "@/lib/clientApi";

interface Mini {
  hasData: boolean;
  totals: { posts: number; reach: number; followers: number };
  crescita: { delta7: number };
  cosaFunziona: { tips: string[] };
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return Math.round(n).toString();
}

// Sintesi performance cross-progetto in home. Si mostra solo quando ci sono dati.
export function GlobalOverview() {
  const [d, setD] = useState<Mini | null>(null);
  useEffect(() => {
    getJson<Mini>("/api/insights").then(setD).catch(() => {});
  }, []);

  if (!d || !d.hasData) return null;

  return (
    <div className="mb-6 rounded-2xl border border-[#26262b] bg-[#19191c] p-4">
      <div className="flex flex-wrap items-center gap-6">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-zinc-600">Follower</div>
          <div className="text-[18px] font-bold text-white">
            {fmt(d.totals.followers)}
            {d.crescita.delta7 !== 0 && (
              <span className={`ml-1.5 text-[11px] font-medium ${d.crescita.delta7 > 0 ? "text-emerald-400" : "text-red-400"}`}>
                {d.crescita.delta7 > 0 ? "+" : ""}{fmt(d.crescita.delta7)}/7g
              </span>
            )}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-zinc-600">Reach totale</div>
          <div className="text-[18px] font-bold text-zinc-200">{fmt(d.totals.reach)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-zinc-600">Post pubblicati</div>
          <div className="text-[18px] font-bold text-zinc-200">{d.totals.posts}</div>
        </div>
        {d.cosaFunziona.tips[0] && (
          <div className="flex min-w-0 flex-1 items-center gap-2 border-l border-[#26262b] pl-6 text-[11.5px] text-zinc-300">
            <Lightbulb size={13} className="shrink-0 text-zinc-500" />
            <span className="truncate">{d.cosaFunziona.tips[0]}</span>
          </div>
        )}
      </div>
    </div>
  );
}
