"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, Check, Loader2, Send, X } from "lucide-react";
import { getJson } from "@/lib/clientApi";
import { renderSlideBlobs } from "@/lib/clientExport";
import { OverlayPreview } from "@/components/OverlayPreview";
import { PLATFORM_FORMAT } from "@/lib/formats";
import { PLATFORM_LABEL, type Platform, type SlideInput, type SocialAccount } from "@/lib/types";

const BADGE: Record<Platform, string> = { instagram: "IG", tiktok: "TT", x: "X" };

export function PublishDialog({
  projectId,
  platform,
  fmtH,
  label,
  slides,
  onClose,
}: {
  projectId: string;
  platform: Platform;
  fmtH: number;
  label: string;
  slides: SlideInput[];
  onClose: () => void;
}) {
  const [accounts, setAccounts] = useState<SocialAccount[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  // caption pre-compilata con l'hook della variante (modificabile)
  const [caption, setCaption] = useState(() => slides.find((s) => s.role === "HOOK")?.overlay?.text?.trim() ?? "");
  const [mode, setMode] = useState<"now" | "schedule">("now");
  const [when, setWhen] = useState("");
  const [state, setState] = useState<"idle" | "publishing" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const maxImages = PLATFORM_FORMAT[platform].maxImages;
  const willTrim = slides.length > maxImages;

  useEffect(() => {
    getJson<{ accounts: SocialAccount[] }>(`/api/projects/${projectId}/accounts`)
      .then((r) => {
        // solo gli account della piattaforma di questo workflow
        const connected = r.accounts.filter((a) => a.status === "connected" && a.platform === platform);
        setAccounts(connected);
        setPicked(new Set(connected.map((a) => a.id)));
      })
      .catch(() => setAccounts([]));
  }, [projectId, platform]);

  const toggle = (id: string) =>
    setPicked((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const submit = async () => {
    if (!picked.size) return;
    if (mode === "schedule" && !when) {
      setError("Scegli data e ora.");
      return;
    }
    setError(null);
    setState("publishing");
    try {
      const blobs = await renderSlideBlobs(slides, fmtH);
      const fd = new FormData();
      fd.append("projectId", projectId);
      fd.append("accountIds", [...picked].join(","));
      fd.append("caption", caption);
      fd.append("slides", JSON.stringify(slides));
      blobs.forEach((b, i) => fd.append("photos", b, `${String(i + 1).padStart(2, "0")}.png`));
      let url = "/api/publish";
      if (mode === "schedule") {
        fd.append("scheduledAt", new Date(when).toISOString());
        url = "/api/schedule";
      }
      const r = await fetch(url, { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || r.statusText);
      setState("done");
      setTimeout(onClose, 1400);
    } catch (e) {
      setError(String(e));
      setState("idle");
    }
  };

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-[440px] max-w-[92vw] overflow-hidden rounded-2xl border border-[#2a2a30] bg-[#161619] shadow-[0_24px_70px_rgba(0,0,0,0.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-[#222227] px-4 py-3">
          <Send size={14} className="text-zinc-400" />
          <span className="text-[13px] font-semibold text-zinc-100">Pubblica {label}</span>
          <div className="flex-1" />
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-lg text-zinc-500 hover:bg-[#222227] hover:text-zinc-200">
            <X size={15} />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div className="flex items-center gap-2 text-[10px] text-zinc-500">
            <span className="grid h-4 w-5 place-items-center rounded bg-[#2e2e34] text-[8px] font-bold text-zinc-300">{BADGE[platform]}</span>
            {PLATFORM_LABEL[platform]} · {PLATFORM_FORMAT[platform].ratio}
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {slides.map((s, i) => (
              <OverlayPreview key={i} spec={s.overlay ?? null} width={44} fmtH={fmtH} src={`/api/assets/${s.assetKey}`} className="shrink-0 rounded-md ring-1 ring-[#2a2a30]" />
            ))}
          </div>
          {willTrim && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-[10.5px] text-amber-200">
              {PLATFORM_LABEL[platform]} accetta max {maxImages} immagini: verranno usate solo le prime {maxImages}.
            </div>
          )}

          <div>
            <div className="mb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-zinc-500">Account ({picked.size} selezionati)</div>
            {accounts === null ? (
              <div className="text-[11px] text-zinc-600">Carico account…</div>
            ) : accounts.length === 0 ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-200">
                Nessun account collegato.{" "}
                <Link href={`/project/${projectId}?tab=account`} className="font-semibold underline">
                  Collega un account
                </Link>
                .
              </div>
            ) : (
              <div className="grid max-h-44 grid-cols-1 gap-1.5 overflow-y-auto">
                {accounts.map((a) => {
                  const on = picked.has(a.id);
                  return (
                    <button
                      key={a.id}
                      onClick={() => toggle(a.id)}
                      className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition ${
                        on ? "border-zinc-400 bg-[#222227]" : "border-[#2a2a30] bg-[#1d1d21] hover:border-[#3c3c44]"
                      }`}
                    >
                      <span className="grid h-6 w-7 shrink-0 place-items-center rounded bg-[#2e2e34] text-[9px] font-bold text-zinc-300">{BADGE[a.platform]}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-medium text-zinc-200">{a.handle ? `@${a.handle}` : PLATFORM_LABEL[a.platform]}</span>
                        <span className="block text-[9.5px] text-zinc-600">{PLATFORM_LABEL[a.platform]}</span>
                      </span>
                      <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${on ? "border-white bg-white text-black" : "border-[#3c3c44]"}`}>
                        {on && <Check size={10} />}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <div className="mb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-zinc-500">Didascalia</div>
            <textarea
              className="w-full rounded-lg border border-[#2a2a30] bg-[#1d1d21] px-2.5 py-1.5 text-[12px] text-zinc-200 placeholder-zinc-600 outline-none transition focus:border-zinc-500"
              rows={3}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Scrivi la didascalia… #hashtag"
            />
          </div>

          {/* ora vs programmato */}
          <div className="grid grid-cols-2 gap-1 rounded-full border border-[#2a2a30] bg-[#1d1d21] p-1">
            {(["now", "schedule"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`inline-flex items-center justify-center gap-1.5 rounded-full py-1 text-[10.5px] font-medium transition ${
                  mode === m ? "bg-white text-black" : "text-zinc-500 hover:text-zinc-200"
                }`}
              >
                {m === "now" ? <Send size={11} /> : <CalendarClock size={11} />}
                {m === "now" ? "Pubblica ora" : "Programma"}
              </button>
            ))}
          </div>

          {mode === "schedule" && (
            <input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className="w-full rounded-lg border border-[#2a2a30] bg-[#1d1d21] px-2.5 py-1.5 text-[12px] text-zinc-200 outline-none transition focus:border-zinc-500 [color-scheme:dark]"
            />
          )}

          {error && <div className="rounded-lg border border-red-900/50 bg-red-950/30 p-2.5 text-[11px] text-red-300">{error}</div>}

          <button
            onClick={submit}
            disabled={!picked.size || state !== "idle"}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-[12.5px] font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-40"
          >
            {state === "publishing" ? (
              <>
                <Loader2 size={13} className="animate-spin" /> {mode === "now" ? "Pubblico…" : "Programmo…"}
              </>
            ) : state === "done" ? (
              <>
                <Check size={14} /> {mode === "now" ? "Pubblicato" : "Programmato"}
              </>
            ) : mode === "now" ? (
              <>
                <Send size={13} /> Pubblica su {picked.size || 0}
              </>
            ) : (
              <>
                <CalendarClock size={13} /> Programma su {picked.size || 0}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
