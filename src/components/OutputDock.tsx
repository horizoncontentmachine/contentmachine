"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Download, Loader2, PanelBottomClose, X } from "lucide-react";
import { useFlowStore } from "@/store/useFlowStore";
import { buildOutputs, type OutputGroup, type OutputSequence } from "@/lib/outputs";
import { downloadCarousel, downloadGroups } from "@/lib/clientExport";
import { OverlayPreview } from "./OverlayPreview";
import type { SlideInput } from "@/lib/types";

function Thumb({ slide, onOpen }: { slide: SlideInput; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="group/th relative shrink-0" title={slide.role}>
      <OverlayPreview
        spec={slide.overlay ?? null}
        width={48}
        src={`/api/assets/${slide.assetKey}`}
        className="rounded-md ring-1 ring-[#2a2a30] transition group-hover/th:ring-zinc-400"
      />
      <span className="pointer-events-none absolute left-1 top-1 rounded bg-black/55 px-1 py-px text-[7px] font-semibold uppercase tracking-wide text-white/90">
        {slide.role === "HOOK" ? "H" : slide.role === "CTA" ? "CTA" : "S"}
      </span>
    </button>
  );
}

function VariantRow({ group, onOpen }: { group: OutputGroup; onOpen: (slides: SlideInput[], start: number) => void }) {
  const [busy, setBusy] = useState(false);
  const download = async () => {
    setBusy(true);
    try {
      await downloadCarousel(group.label, group.slides);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-[#1d1d21]">
      <span className="w-12 shrink-0 font-mono text-[11px] font-semibold text-zinc-400">{group.label}</span>
      <div className="flex flex-1 items-center gap-1.5 overflow-x-auto pb-0.5">
        {group.slides.map((s, i) => (
          <Thumb key={i} slide={s} onOpen={() => onOpen(group.slides, i)} />
        ))}
      </div>
      <button
        onClick={download}
        disabled={busy}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[#2e2e34] bg-[#202024] text-zinc-400 transition hover:border-[#454550] hover:text-white disabled:opacity-40"
        title={`Scarica ${group.label} (ZIP)`}
      >
        {busy ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
      </button>
    </div>
  );
}

function SequenceBlock({ seq, onOpen }: { seq: OutputSequence; onOpen: (slides: SlideInput[], start: number) => void }) {
  const [busy, setBusy] = useState(false);
  const downloadAll = async () => {
    setBusy(true);
    try {
      if (seq.groups.length > 1) {
        await downloadGroups(`C${seq.carouselN}_varianti`, seq.groups);
      } else if (seq.groups[0]) {
        await downloadCarousel(`C${seq.carouselN}`, seq.groups[0].slides);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[#26262b] bg-[#161619] p-2.5">
      <div className="mb-1 flex items-center gap-2 px-2">
        <span className="text-[11.5px] font-semibold text-zinc-200">Carosello #{seq.carouselN}</span>
        <span className="text-[10px] text-zinc-600">
          {seq.groups.length} {seq.groups.length === 1 ? "versione" : "varianti"} · {seq.groups[0]?.slides.length} slide
        </span>
        <div className="flex-1" />
        <button
          onClick={downloadAll}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[10.5px] font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-40"
        >
          {busy ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
          Scarica tutto
        </button>
      </div>
      <div className="space-y-0.5">
        {seq.groups.map((g) => (
          <VariantRow key={g.label} group={g} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

function Lightbox({ slides, start, onClose }: { slides: SlideInput[]; start: number; onClose: () => void }) {
  const [i, setI] = useState(start);
  const s = slides[i];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setI((p) => (p - 1 + slides.length) % slides.length);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setI((p) => (p + 1) % slides.length);
      } else if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slides.length, onClose]);

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/85 backdrop-blur-sm" onClick={onClose}>
      <div className="flex items-center gap-6" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setI((p) => (p - 1 + slides.length) % slides.length)}
          className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
        >
          <ChevronLeft size={20} />
        </button>
        <OverlayPreview spec={s.overlay ?? null} width={340} src={`/api/assets/${s.assetKey}`} className="rounded-2xl shadow-2xl" />
        <button
          onClick={() => setI((p) => (p + 1) % slides.length)}
          className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
        >
          <ChevronRight size={20} />
        </button>
      </div>
      <button onClick={onClose} className="fixed right-5 top-5 grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20">
        <X size={16} />
      </button>
      <div className="fixed bottom-6 flex items-center gap-3 font-mono text-[11px] text-zinc-400">
        <span>{s.role}</span>
        <span className="text-zinc-600">·</span>
        <span>{i + 1}/{slides.length}</span>
        <span className="text-zinc-700">·</span>
        <span className="text-zinc-600">← → per scorrere</span>
      </div>
    </div>
  );
}

export function OutputDock() {
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const meta = useFlowStore((s) => s.meta);
  const [open, setOpen] = useState(true);
  const [box, setBox] = useState<{ slides: SlideInput[]; start: number } | null>(null);

  const sequences = useMemo(() => buildOutputs(nodes, edges), [nodes, edges]);
  const totalVariants = sequences.reduce((a, s) => a + s.groups.length, 0);

  if (!sequences.length || !meta) return null;

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-4">
        <div className="pointer-events-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-[#2a2a30] bg-[#121214]/90 shadow-[0_-10px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition hover:bg-white/[0.02]"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/80" />
            <span className="text-[12px] font-semibold text-zinc-100">Output</span>
            <span className="text-[10.5px] text-zinc-500">
              {sequences.length} {sequences.length === 1 ? "carosello pronto" : "caroselli pronti"} · {totalVariants}{" "}
              {totalVariants === 1 ? "versione" : "varianti"}
            </span>
            <div className="flex-1" />
            {open ? <PanelBottomClose size={15} className="text-zinc-500" /> : <ChevronDown size={15} className="rotate-180 text-zinc-500" />}
          </button>
          {open && (
            <div className="max-h-[46vh] space-y-2.5 overflow-y-auto px-3 pb-3">
              {sequences.map((seq) => (
                <SequenceBlock key={seq.carouselId} seq={seq} onOpen={(slides, start) => setBox({ slides, start })} />
              ))}
            </div>
          )}
        </div>
      </div>
      {box && <Lightbox slides={box.slides} start={box.start} onClose={() => setBox(null)} />}
    </>
  );
}
