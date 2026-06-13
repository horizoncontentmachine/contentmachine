"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Clock, Loader2, Plus, Settings2, Trash2, X } from "lucide-react";
import { getJson, postJson } from "@/lib/clientApi";
import { OverlayPreview } from "@/components/OverlayPreview";
import { PLATFORM_FORMAT } from "@/lib/formats";
import type { Slots } from "@/lib/schedule";
import { PLATFORM_LABEL, type Platform, type PostRecord } from "@/lib/types";

const DAYS_SHORT = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const DAY_INDEX = [1, 2, 3, 4, 5, 6, 0]; // colonne lun→dom mappate su getDay()
const DAYS_SETTINGS = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
const BADGE: Record<Platform, string> = { instagram: "IG", tiktok: "TT", x: "X" };

function mondayOf(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const wd = (x.getDay() + 6) % 7; // 0=lun
  x.setDate(x.getDate() - wd);
  return x;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function CalendarPanel({ projectId }: { projectId: string }) {
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [slots, setSlots] = useState<Slots>({ days: [1, 2, 3, 4, 5], times: ["09:00", "13:00", "19:00"] });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editing, setEditing] = useState<PostRecord | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const loadPosts = useCallback(
    () => getJson<PostRecord[]>(`/api/projects/${projectId}/posts`).then(setPosts).catch(() => {}),
    [projectId]
  );
  useEffect(() => {
    getJson<Slots>(`/api/projects/${projectId}/slots`).then(setSlots).catch(() => {});
    loadPosts();
  }, [projectId, loadPosts]);

  const queued = posts.filter((p) => p.status === "queued" && p.scheduledAt);

  const reschedule = async (id: string, iso: string) => {
    setPosts((ps) => ps.map((p) => (p.id === id ? { ...p, scheduledAt: iso } : p))); // ottimistico
    await postJson(`/api/projects/${projectId}/posts`, { action: "reschedule", postId: id, scheduledAt: iso });
    loadPosts();
  };
  const onDropDay = async (day: Date) => {
    if (!dragId) return;
    const src = queued.find((p) => p.id === dragId);
    setDragId(null);
    if (!src?.scheduledAt) return;
    const old = new Date(src.scheduledAt);
    const nd = new Date(day);
    nd.setHours(old.getHours(), old.getMinutes(), 0, 0);
    await reschedule(src.id, nd.toISOString());
  };

  const weekDays = DAY_INDEX.map((_, i) => addDays(weekStart, i));
  const weekLabel = `${weekStart.toLocaleDateString("it-IT", { day: "numeric", month: "short" })} – ${addDays(weekStart, 6).toLocaleDateString("it-IT", { day: "numeric", month: "short" })}`;

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-[16px] font-semibold tracking-tight text-zinc-100">Calendario</h2>
        <span className="text-[12px] text-zinc-500">{queued.length} in coda</span>
        <div className="flex-1" />
        <button
          onClick={() => setSettingsOpen((o) => !o)}
          className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[11.5px] font-medium transition ${
            settingsOpen ? "border-zinc-500 text-zinc-100" : "border-[#2e2e34] bg-[#202024] text-zinc-300 hover:text-white"
          }`}
        >
          <Settings2 size={13} /> Orari
        </button>
        <div className="flex items-center gap-1 rounded-lg border border-[#2e2e34] bg-[#202024] p-0.5">
          <button onClick={() => setWeekStart((w) => addDays(w, -7))} className="grid h-7 w-7 place-items-center rounded-md text-zinc-400 hover:bg-[#26262c] hover:text-white">
            <ChevronLeft size={15} />
          </button>
          <button onClick={() => setWeekStart(mondayOf(new Date()))} className="px-2 text-[11px] font-medium text-zinc-300 hover:text-white">
            Oggi
          </button>
          <button onClick={() => setWeekStart((w) => addDays(w, 7))} className="grid h-7 w-7 place-items-center rounded-md text-zinc-400 hover:bg-[#26262c] hover:text-white">
            <ChevronRight size={15} />
          </button>
        </div>
        <span className="w-[150px] text-right text-[11.5px] text-zinc-500">{weekLabel}</span>
      </div>

      {settingsOpen && <SlotSettings projectId={projectId} slots={slots} setSlots={setSlots} />}

      {/* griglia settimana */}
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((day, i) => {
          const items = queued
            .filter((p) => sameDay(new Date(p.scheduledAt!), day))
            .sort((a, b) => a.scheduledAt!.localeCompare(b.scheduledAt!));
          const isToday = sameDay(day, new Date());
          const isSlotDay = slots.days.includes(DAY_INDEX[i]);
          return (
            <div
              key={i}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDropDay(day)}
              className={`min-h-[320px] rounded-xl border p-1.5 transition ${
                dragId ? "border-dashed border-[#3c3c44]" : "border-[#222227]"
              } ${isSlotDay ? "bg-[#161619]" : "bg-[#131315]"}`}
            >
              <div className="mb-1.5 px-1 pt-0.5">
                <div className={`text-[10px] font-semibold uppercase tracking-wide ${isToday ? "text-white" : "text-zinc-500"}`}>{DAYS_SHORT[i]}</div>
                <div className={`text-[15px] font-bold ${isToday ? "text-white" : "text-zinc-400"}`}>{day.getDate()}</div>
              </div>
              <div className="space-y-1.5">
                {items.map((p) => (
                  <PostCard key={p.id} post={p} onDragStart={() => setDragId(p.id)} onClick={() => setEditing(p)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {queued.length === 0 && (
        <p className="mt-4 text-center text-[11.5px] text-zinc-600">
          Nessun post programmato. Genera i contenuti e usa &quot;Aggiungi alla coda&quot; dall&apos;Output.
        </p>
      )}

      {editing && (
        <PostEditor
          projectId={projectId}
          post={editing}
          onClose={() => setEditing(null)}
          onChanged={() => {
            loadPosts();
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function PostCard({ post, onDragStart, onClick }: { post: PostRecord; onDragStart: () => void; onClick: () => void }) {
  const fmtH = PLATFORM_FORMAT[post.platforms[0] ?? "tiktok"]?.h ?? 1920;
  const first = post.slides?.[0];
  return (
    <button
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className="group flex w-full cursor-grab items-center gap-1.5 rounded-lg border border-[#2a2a30] bg-[#1d1d21] p-1.5 text-left transition hover:border-[#454550] active:cursor-grabbing"
    >
      {first ? (
        <OverlayPreview spec={first.overlay ?? null} width={22} fmtH={fmtH} src={`/api/assets/${first.assetKey}`} className="shrink-0 rounded" />
      ) : (
        <span className="h-[28px] w-[22px] shrink-0 rounded bg-[#2a2a30]" />
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 text-[10.5px] font-semibold text-zinc-200">
          {new Date(post.scheduledAt!).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
          {post.platforms.map((pl) => (
            <span key={pl} className="rounded bg-[#2e2e34] px-1 text-[7px] font-bold text-zinc-400">{BADGE[pl]}</span>
          ))}
        </span>
        <span className="block truncate text-[9.5px] text-zinc-500">{post.caption || "—"}</span>
      </span>
    </button>
  );
}

function SlotSettings({ projectId, slots, setSlots }: { projectId: string; slots: Slots; setSlots: (s: Slots) => void }) {
  const [newTime, setNewTime] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const toggleDay = (d: number) => setSlots({ ...slots, days: slots.days.includes(d) ? slots.days.filter((x) => x !== d) : [...slots.days, d].sort() });
  const addTime = () => {
    if (!/^\d{2}:\d{2}$/.test(newTime) || slots.times.includes(newTime)) return;
    setSlots({ ...slots, times: [...slots.times, newTime].sort() });
    setNewTime("");
  };
  const save = async () => {
    setBusy(true);
    try {
      await postJson(`/api/projects/${projectId}/slots`, slots);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mb-4 rounded-xl border border-[#26262b] bg-[#19191c] p-3">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1.5">
          {DAYS_SETTINGS.map((label, i) => (
            <button
              key={i}
              onClick={() => toggleDay(i)}
              className={`h-7 w-9 rounded-md text-[10.5px] font-medium transition ${slots.days.includes(i) ? "bg-white text-black" : "border border-[#2e2e34] bg-[#202024] text-zinc-400 hover:text-zinc-200"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="h-5 w-px bg-[#2a2a30]" />
        <div className="flex flex-wrap items-center gap-1.5">
          {slots.times.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 rounded-md border border-[#2e2e34] bg-[#202024] px-2 py-1 text-[11px] text-zinc-200">
              {t}
              <button onClick={() => setSlots({ ...slots, times: slots.times.filter((x) => x !== t) })} className="text-zinc-500 hover:text-red-400">
                <X size={11} />
              </button>
            </span>
          ))}
          <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="h-8 rounded-md border border-[#2a2a30] bg-[#1d1d21] px-2 text-[11px] text-zinc-200 [color-scheme:dark]" />
          <button onClick={addTime} className="grid h-8 w-8 place-items-center rounded-md border border-[#2e2e34] bg-[#202024] text-zinc-300 hover:text-white">
            <Plus size={13} />
          </button>
        </div>
        <div className="flex-1" />
        <button onClick={save} disabled={busy} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white px-3 text-[11.5px] font-semibold text-black hover:bg-zinc-200 disabled:opacity-40">
          {busy ? <Loader2 size={12} className="animate-spin" /> : saved ? <Check size={12} /> : null}
          {saved ? "Salvato" : "Salva"}
        </button>
      </div>
    </div>
  );
}

function PostEditor({ projectId, post, onClose, onChanged }: { projectId: string; post: PostRecord; onClose: () => void; onChanged: () => void }) {
  const [caption, setCaption] = useState(post.caption ?? "");
  const [when, setWhen] = useState(post.scheduledAt ? toLocalInput(post.scheduledAt) : "");
  const [busy, setBusy] = useState(false);
  const fmtH = PLATFORM_FORMAT[post.platforms[0] ?? "tiktok"]?.h ?? 1920;

  const save = async () => {
    setBusy(true);
    try {
      if (caption !== (post.caption ?? "")) await postJson(`/api/projects/${projectId}/posts`, { action: "edit", postId: post.id, caption });
      if (when && new Date(when).toISOString() !== post.scheduledAt)
        await postJson(`/api/projects/${projectId}/posts`, { action: "reschedule", postId: post.id, scheduledAt: new Date(when).toISOString() });
      onChanged();
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    setBusy(true);
    try {
      await postJson(`/api/projects/${projectId}/posts`, { action: "delete", postId: post.id });
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-[440px] max-w-[92vw] overflow-hidden rounded-2xl border border-[#2a2a30] bg-[#161619] shadow-[0_24px_70px_rgba(0,0,0,0.6)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-[#222227] px-4 py-3">
          <span className="text-[13px] font-semibold text-zinc-100">Post programmato</span>
          <div className="flex gap-1">
            {post.platforms.map((pl) => (
              <span key={pl} className="grid h-5 w-6 place-items-center rounded bg-[#202024] text-[8px] font-bold text-zinc-400">{BADGE[pl]}</span>
            ))}
          </div>
          <div className="flex-1" />
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-lg text-zinc-500 hover:bg-[#222227] hover:text-zinc-200">
            <X size={15} />
          </button>
        </div>
        <div className="space-y-4 p-4">
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {(post.slides ?? []).map((s, i) => (
              <OverlayPreview key={i} spec={s.overlay ?? null} width={44} fmtH={fmtH} src={`/api/assets/${s.assetKey}`} className="shrink-0 rounded-md ring-1 ring-[#2a2a30]" />
            ))}
          </div>
          <div>
            <div className="mb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-zinc-500">Data e ora</div>
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="w-full rounded-lg border border-[#2a2a30] bg-[#1d1d21] px-2.5 py-1.5 text-[12px] text-zinc-200 outline-none focus:border-zinc-500 [color-scheme:dark]" />
          </div>
          <div>
            <div className="mb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-zinc-500">Didascalia</div>
            <textarea rows={3} value={caption} onChange={(e) => setCaption(e.target.value)} className="w-full rounded-lg border border-[#2a2a30] bg-[#1d1d21] px-2.5 py-1.5 text-[12px] text-zinc-200 outline-none focus:border-zinc-500" />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={save} disabled={busy} className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-[12.5px] font-semibold text-black hover:bg-zinc-200 disabled:opacity-40">
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={14} />} Salva
            </button>
            <button onClick={remove} disabled={busy} className="grid h-9 w-9 place-items-center rounded-full border border-[#2e2e34] bg-[#202024] text-zinc-400 transition hover:border-red-900 hover:text-red-300 disabled:opacity-40" title="Elimina">
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
