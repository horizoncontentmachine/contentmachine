"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Clock, Loader2, Plus, Trash2, X } from "lucide-react";
import { getJson, postJson } from "@/lib/clientApi";
import type { Slots } from "@/lib/schedule";
import { PLATFORM_LABEL, type Platform, type PostRecord } from "@/lib/types";

const DAYS = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
const BADGE: Record<Platform, string> = { instagram: "IG", tiktok: "TT", x: "X" };

function dayKey(d: Date) {
  return d.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
}

export function CalendarPanel({ projectId }: { projectId: string }) {
  const [slots, setSlots] = useState<Slots>({ days: [1, 2, 3, 4, 5], times: ["09:00", "13:00", "19:00"] });
  const [newTime, setNewTime] = useState("");
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [savedFlash, setSavedFlash] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadPosts = useCallback(
    () => getJson<PostRecord[]>(`/api/projects/${projectId}/posts`).then(setPosts).catch(() => {}),
    [projectId]
  );

  useEffect(() => {
    getJson<Slots>(`/api/projects/${projectId}/slots`).then(setSlots).catch(() => {});
    loadPosts();
  }, [projectId, loadPosts]);

  const toggleDay = (d: number) =>
    setSlots((s) => ({ ...s, days: s.days.includes(d) ? s.days.filter((x) => x !== d) : [...s.days, d].sort() }));

  const addTime = () => {
    if (!/^\d{2}:\d{2}$/.test(newTime) || slots.times.includes(newTime)) return;
    setSlots((s) => ({ ...s, times: [...s.times, newTime].sort() }));
    setNewTime("");
  };
  const removeTime = (t: string) => setSlots((s) => ({ ...s, times: s.times.filter((x) => x !== t) }));

  const saveSlots = async () => {
    setBusy(true);
    try {
      await postJson(`/api/projects/${projectId}/slots`, slots);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    } finally {
      setBusy(false);
    }
  };

  const removePost = async (id: string) => {
    await postJson(`/api/projects/${projectId}/posts`, { action: "delete", postId: id });
    loadPosts();
  };

  const queued = posts
    .filter((p) => p.status === "queued" && p.scheduledAt)
    .sort((a, b) => a.scheduledAt!.localeCompare(b.scheduledAt!));

  // raggruppa per giorno
  const byDay: { key: string; items: PostRecord[] }[] = [];
  for (const p of queued) {
    const k = dayKey(new Date(p.scheduledAt!));
    let g = byDay.find((x) => x.key === k);
    if (!g) byDay.push((g = { key: k, items: [] }));
    g.items.push(p);
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <h2 className="text-[16px] font-semibold tracking-tight text-zinc-100">Calendario</h2>
      <p className="mt-0.5 text-[12px] text-zinc-500">Imposta gli orari fissi e gestisci la coda dei post programmati.</p>

      {/* impostazioni slot */}
      <div className="mt-5 rounded-2xl border border-[#26262b] bg-[#19191c] p-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-500">Giorni</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {DAYS.map((label, i) => (
            <button
              key={i}
              onClick={() => toggleDay(i)}
              className={`h-8 w-11 rounded-lg text-[11px] font-medium transition ${
                slots.days.includes(i) ? "bg-white text-black" : "border border-[#2e2e34] bg-[#202024] text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-500">Orari</div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {slots.times.map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5 rounded-lg border border-[#2e2e34] bg-[#202024] px-2.5 py-1.5 text-[12px] text-zinc-200">
              {t}
              <button onClick={() => removeTime(t)} className="text-zinc-500 hover:text-red-400">
                <X size={12} />
              </button>
            </span>
          ))}
          <input
            type="time"
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
            className="h-9 rounded-lg border border-[#2a2a30] bg-[#1d1d21] px-2 text-[12px] text-zinc-200 outline-none [color-scheme:dark]"
          />
          <button onClick={addTime} className="grid h-9 w-9 place-items-center rounded-lg border border-[#2e2e34] bg-[#202024] text-zinc-300 hover:text-white">
            <Plus size={14} />
          </button>
        </div>

        <button
          onClick={saveSlots}
          disabled={busy}
          className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-4 text-[12px] font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-40"
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : savedFlash ? <Check size={13} /> : null}
          {savedFlash ? "Salvato" : "Salva orari"}
        </button>
        <p className="mt-2 text-[10.5px] text-zinc-600">
          Da qui generi i contenuti, poi nell&apos;Output premi &quot;Aggiungi alla coda&quot;: le varianti si distribuiscono su questi slot.
        </p>
      </div>

      {/* agenda programmati */}
      <div className="mt-6">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-500">In coda ({queued.length})</div>
        {queued.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[#2a2a30] p-8 text-center text-[12px] text-zinc-600">
            Nessun post programmato. Usa &quot;Aggiungi alla coda&quot; dall&apos;Output.
          </div>
        )}
        <div className="space-y-4">
          {byDay.map((g) => (
            <div key={g.key}>
              <div className="mb-1.5 text-[11px] font-semibold capitalize text-zinc-300">{g.key}</div>
              <div className="space-y-1.5">
                {g.items.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 rounded-xl border border-[#26262b] bg-[#19191c] px-3 py-2.5">
                    <span className="flex items-center gap-1 font-mono text-[12px] font-semibold text-zinc-200">
                      <Clock size={12} className="text-zinc-500" />
                      {new Date(p.scheduledAt!).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <div className="flex gap-1">
                      {p.platforms.map((pl) => (
                        <span key={pl} className="grid h-5 w-6 place-items-center rounded bg-[#202024] text-[8px] font-bold text-zinc-400">
                          {BADGE[pl]}
                        </span>
                      ))}
                    </div>
                    <span className="min-w-0 flex-1 truncate text-[11.5px] text-zinc-400">{p.caption || "—"}</span>
                    <button onClick={() => removePost(p.id)} title="Rimuovi dalla coda" className="grid h-7 w-7 place-items-center rounded-lg text-zinc-500 hover:bg-[#222227] hover:text-red-400">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
