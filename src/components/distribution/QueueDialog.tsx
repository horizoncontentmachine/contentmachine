"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarPlus, Check, Loader2, X } from "lucide-react";
import { getJson } from "@/lib/clientApi";
import { renderSlideBlobs } from "@/lib/clientExport";
import { nextSlots, fmtSlot, type Slots } from "@/lib/schedule";
import { PLATFORM_LABEL, type Platform, type PostRecord, type SocialAccount } from "@/lib/types";
import type { OutputGroup } from "@/lib/outputs";

const BADGE: Record<Platform, string> = { instagram: "IG", tiktok: "TT", x: "X" };

// "Aggiungi alla coda": distribuisce automaticamente le varianti nei prossimi slot liberi.
export function QueueDialog({
  projectId,
  platform,
  fmtH,
  groups,
  onClose,
}: {
  projectId: string;
  platform: Platform;
  fmtH: number;
  groups: OutputGroup[];
  onClose: () => void;
}) {
  const [accounts, setAccounts] = useState<SocialAccount[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [slots, setSlots] = useState<Slots | null>(null);
  const [taken, setTaken] = useState<string[]>([]);
  const [state, setState] = useState<"idle" | "working" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      getJson<{ accounts: SocialAccount[] }>(`/api/projects/${projectId}/accounts`),
      getJson<Slots>(`/api/projects/${projectId}/slots`),
      getJson<PostRecord[]>(`/api/projects/${projectId}/posts`),
    ])
      .then(([a, s, posts]) => {
        const conn = a.accounts.filter((x) => x.status === "connected" && x.platform === platform);
        setAccounts(conn);
        setPicked(new Set(conn.map((x) => x.id)));
        setSlots(s);
        setTaken(posts.filter((p) => p.status === "queued" && p.scheduledAt).map((p) => p.scheduledAt!));
      })
      .catch(() => setAccounts([]));
  }, [projectId, platform]);

  const plan = useMemo(() => (slots ? nextSlots(slots, taken, groups.length) : []), [slots, taken, groups.length]);
  const enough = plan.length >= groups.length;

  const toggle = (id: string) =>
    setPicked((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const run = async () => {
    if (!picked.size || !plan.length) return;
    setError(null);
    setState("working");
    setProgress(0);
    try {
      const accountIds = [...picked].join(",");
      for (let i = 0; i < groups.length && i < plan.length; i++) {
        const g = groups[i];
        const blobs = await renderSlideBlobs(g.slides, fmtH);
        const fd = new FormData();
        fd.append("projectId", projectId);
        fd.append("accountIds", accountIds);
        fd.append("caption", g.hook ?? "");
        fd.append("slides", JSON.stringify(g.slides));
        fd.append("scheduledAt", plan[i].toISOString());
        blobs.forEach((b, k) => fd.append("photos", b, `${String(k + 1).padStart(2, "0")}.png`));
        const r = await fetch("/api/schedule", { method: "POST", body: fd });
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Errore programmazione");
        setProgress(i + 1);
      }
      setState("done");
      setTimeout(onClose, 1400);
    } catch (e) {
      setError(String(e));
      setState("idle");
    }
  };

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-[440px] max-w-[92vw] overflow-hidden rounded-2xl border border-[#2a2a30] bg-[#161619] shadow-[0_24px_70px_rgba(0,0,0,0.6)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-[#222227] px-4 py-3">
          <CalendarPlus size={14} className="text-zinc-400" />
          <span className="text-[13px] font-semibold text-zinc-100">Aggiungi alla coda · {groups.length} varianti</span>
          <div className="flex-1" />
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-lg text-zinc-500 hover:bg-[#222227] hover:text-zinc-200">
            <X size={15} />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div>
            <div className="mb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-zinc-500">Account {PLATFORM_LABEL[platform]} ({picked.size})</div>
            {accounts === null ? (
              <div className="text-[11px] text-zinc-600">Carico…</div>
            ) : accounts.length === 0 ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-200">
                Nessun account {PLATFORM_LABEL[platform]} collegato.{" "}
                <Link href={`/project/${projectId}?tab=account`} className="font-semibold underline">Collega</Link>.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {accounts.map((a) => {
                  const on = picked.has(a.id);
                  return (
                    <button
                      key={a.id}
                      onClick={() => toggle(a.id)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] font-medium transition ${on ? "border-white bg-white text-black" : "border-[#2e2e34] bg-[#202024] text-zinc-400 hover:text-zinc-200"}`}
                    >
                      <span className="grid h-4 w-5 place-items-center rounded bg-black/10 text-[8px] font-bold">{BADGE[a.platform]}</span>
                      {a.handle ? `@${a.handle}` : PLATFORM_LABEL[a.platform]} {on && <Check size={11} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-[#26262b] bg-[#1d1d21] p-3 text-[11.5px] leading-relaxed">
            {!slots || !slots.times.length ? (
              <span className="text-amber-300">
                Imposta prima gli orari nella scheda <span className="font-semibold">Calendario</span>.
              </span>
            ) : enough ? (
              <>
                <span className="text-zinc-300">
                  {groups.length} post negli slot: <span className="text-zinc-100">{slots.times.join(", ")}</span>
                </span>
                <div className="mt-1 text-[10.5px] text-zinc-500">
                  Dal {fmtSlot(plan[0])} al {fmtSlot(plan[plan.length - 1])}
                </div>
              </>
            ) : (
              <span className="text-amber-300">Slot insufficienti nei prossimi mesi: aggiungi orari/giorni in Calendario.</span>
            )}
          </div>

          {error && <div className="rounded-lg border border-red-900/50 bg-red-950/30 p-2.5 text-[11px] text-red-300">{error}</div>}

          <button
            onClick={run}
            disabled={!picked.size || !plan.length || state !== "idle"}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-[12.5px] font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-40"
          >
            {state === "working" ? (
              <>
                <Loader2 size={13} className="animate-spin" /> Programmo… {progress}/{groups.length}
              </>
            ) : state === "done" ? (
              <>
                <Check size={14} /> In coda
              </>
            ) : (
              <>
                <CalendarPlus size={13} /> Programma {Math.min(groups.length, plan.length)} post
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
