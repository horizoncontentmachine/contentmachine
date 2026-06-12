"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Clock, Loader2, RefreshCw, X } from "lucide-react";
import { getJson } from "@/lib/clientApi";
import { OverlayPreview } from "@/components/OverlayPreview";
import type { Platform, PostRecord } from "@/lib/types";

const PLAT_LABEL: Record<Platform, string> = { instagram: "IG", tiktok: "TT", x: "X" };

function StatusBadge({ status }: { status: PostRecord["status"] }) {
  const map = {
    published: { c: "border-emerald-600/30 bg-emerald-600/10 text-emerald-300", i: <Check size={11} />, t: "Pubblicato" },
    failed: { c: "border-red-900/40 bg-red-950/30 text-red-300", i: <X size={11} />, t: "Fallito" },
    queued: { c: "border-zinc-700 bg-zinc-800/40 text-zinc-300", i: <Clock size={11} />, t: "In coda" },
    publishing: { c: "border-zinc-700 bg-zinc-800/40 text-zinc-300", i: <Loader2 size={11} className="animate-spin" />, t: "In corso" },
  }[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${map.c}`}>
      {map.i} {map.t}
    </span>
  );
}

export function HistoryPanel({ projectId }: { projectId: string }) {
  const [posts, setPosts] = useState<PostRecord[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setPosts(await getJson<PostRecord[]>(`/api/projects/${projectId}/posts`));
    } finally {
      setBusy(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-[16px] font-semibold tracking-tight text-zinc-100">Storico pubblicazioni</h2>
          <p className="mt-0.5 text-[12px] text-zinc-500">Cosa è stato pubblicato, dove e quando.</p>
        </div>
        <button
          onClick={load}
          disabled={busy}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#2e2e34] bg-[#202024] px-3 text-[11.5px] font-medium text-zinc-300 transition hover:border-[#454550] hover:text-white disabled:opacity-40"
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Aggiorna
        </button>
      </div>

      {posts && posts.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[#2a2a30] p-10 text-center text-[12px] leading-relaxed text-zinc-600">
          Ancora nessuna pubblicazione. Genera un carosello, poi premi <span className="text-zinc-400">Pubblica</span> dall&apos;area Output.
        </div>
      )}

      <div className="space-y-2.5">
        {posts?.map((p) => (
          <div key={p.id} className="rounded-2xl border border-[#26262b] bg-[#19191c] p-3">
            <div className="mb-2 flex items-center gap-2 px-1">
              <StatusBadge status={p.status} />
              <div className="flex items-center gap-1">
                {p.platforms.map((pl) => (
                  <span key={pl} className="grid h-5 w-6 place-items-center rounded-md bg-[#202024] text-[9px] font-bold text-zinc-400" title={pl}>
                    {PLAT_LABEL[pl]}
                  </span>
                ))}
              </div>
              <div className="flex-1" />
              <span className="text-[10.5px] text-zinc-600">{new Date(p.createdAt).toLocaleString("it-IT")}</span>
            </div>
            {p.slides && p.slides.length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto px-1 pb-1">
                {p.slides.map((s, i) => (
                  <OverlayPreview key={i} spec={s.overlay ?? null} width={40} src={`/api/assets/${s.assetKey}`} className="shrink-0 rounded-md ring-1 ring-[#2a2a30]" />
                ))}
              </div>
            )}
            {p.caption && <div className="mt-1.5 px-1 text-[11px] leading-snug text-zinc-400 line-clamp-2">{p.caption}</div>}
            {p.status === "failed" && p.result ? (
              <div className="mt-1.5 px-1 text-[10.5px] text-red-400/90">{String(p.result).slice(0, 200)}</div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
