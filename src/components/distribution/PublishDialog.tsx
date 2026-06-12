"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Loader2, Send, X } from "lucide-react";
import { getJson } from "@/lib/clientApi";
import { renderSlideBlobs } from "@/lib/clientExport";
import { OverlayPreview } from "@/components/OverlayPreview";
import type { Platform, SlideInput, SocialAccount } from "@/lib/types";

const PLAT_LABEL: Record<Platform, string> = { instagram: "Instagram", tiktok: "TikTok" };

export function PublishDialog({
  projectId,
  label,
  slides,
  onClose,
}: {
  projectId: string;
  label: string;
  slides: SlideInput[];
  onClose: () => void;
}) {
  const [connected, setConnected] = useState<SocialAccount[] | null>(null);
  const [picked, setPicked] = useState<Set<Platform>>(new Set());
  const [caption, setCaption] = useState("");
  const [state, setState] = useState<"idle" | "publishing" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getJson<{ connected: SocialAccount[] }>(`/api/projects/${projectId}/accounts`)
      .then((r) => {
        setConnected(r.connected);
        setPicked(new Set(r.connected.map((a) => a.platform)));
      })
      .catch(() => setConnected([]));
  }, [projectId]);

  const toggle = (p: Platform) =>
    setPicked((s) => {
      const n = new Set(s);
      n.has(p) ? n.delete(p) : n.add(p);
      return n;
    });

  const publish = async () => {
    if (!picked.size) return;
    setError(null);
    setState("publishing");
    try {
      const blobs = await renderSlideBlobs(slides);
      const fd = new FormData();
      fd.append("projectId", projectId);
      fd.append("platforms", [...picked].join(","));
      fd.append("caption", caption);
      fd.append("slides", JSON.stringify(slides));
      blobs.forEach((b, i) => fd.append("photos", b, `${String(i + 1).padStart(2, "0")}.png`));
      const r = await fetch("/api/publish", { method: "POST", body: fd });
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
        className="w-[420px] max-w-[92vw] overflow-hidden rounded-2xl border border-[#2a2a30] bg-[#161619] shadow-[0_24px_70px_rgba(0,0,0,0.6)]"
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
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {slides.map((s, i) => (
              <OverlayPreview key={i} spec={s.overlay ?? null} width={44} src={`/api/assets/${s.assetKey}`} className="shrink-0 rounded-md ring-1 ring-[#2a2a30]" />
            ))}
          </div>

          <div>
            <div className="mb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-zinc-500">Dove pubblicare</div>
            {connected === null ? (
              <div className="text-[11px] text-zinc-600">Carico account…</div>
            ) : connected.length === 0 ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-200">
                Nessun account collegato.{" "}
                <Link href={`/project/${projectId}?tab=account`} className="font-semibold underline">
                  Collega Instagram o TikTok
                </Link>
                .
              </div>
            ) : (
              <div className="flex gap-2">
                {connected.map((a) => {
                  const on = picked.has(a.platform);
                  return (
                    <button
                      key={a.platform}
                      onClick={() => toggle(a.platform)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] font-medium transition ${
                        on ? "border-white bg-white text-black" : "border-[#2e2e34] bg-[#202024] text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      {PLAT_LABEL[a.platform]} {on && <Check size={11} />}
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

          {error && <div className="rounded-lg border border-red-900/50 bg-red-950/30 p-2.5 text-[11px] text-red-300">{error}</div>}

          <button
            onClick={publish}
            disabled={!picked.size || state !== "idle"}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-[12.5px] font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-40"
          >
            {state === "publishing" ? (
              <>
                <Loader2 size={13} className="animate-spin" /> Pubblico…
              </>
            ) : state === "done" ? (
              <>
                <Check size={14} /> Pubblicato
              </>
            ) : (
              <>
                <Send size={13} /> Pubblica ora
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
