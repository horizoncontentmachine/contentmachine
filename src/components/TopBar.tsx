"use client";

import Link from "next/link";
import { ArrowLeft, Redo2, Settings, Undo2 } from "lucide-react";
import { useFlowStore } from "@/store/useFlowStore";
import { BalancePill } from "./BalancePill";

export function TopBar() {
  const meta = useFlowStore((s) => s.meta);
  const setMeta = useFlowStore((s) => s.setMeta);
  const dirty = useFlowStore((s) => s.dirty);
  const saving = useFlowStore((s) => s.saving);
  const undo = useFlowStore((s) => s.undo);
  const redo = useFlowStore((s) => s.redo);
  const canUndo = useFlowStore((s) => s.past.length > 0);
  const canRedo = useFlowStore((s) => s.future.length > 0);

  if (!meta) return null;
  return (
    <div className="flex h-12 items-center gap-2 border-b border-[#222227] bg-[#161619] px-3">
      <Link
        href="/"
        className="grid h-7 w-7 place-items-center rounded-lg text-zinc-500 transition hover:bg-[#222227] hover:text-zinc-200"
      >
        <ArrowLeft size={14} />
      </Link>
      <input
        className="w-60 rounded-lg border border-transparent bg-transparent px-2 py-1 text-[13px] font-semibold tracking-tight text-zinc-100 outline-none transition focus:border-[#2e2e34] focus:bg-[#1d1d21]"
        value={meta.name}
        onChange={(e) => setMeta({ name: e.target.value })}
      />
      <input
        className="w-28 rounded-full border border-[#2a2a30] bg-transparent px-3 py-[3px] text-[10px] text-zinc-500 outline-none transition focus:border-zinc-500 focus:text-zinc-300"
        value={meta.niche}
        onChange={(e) => setMeta({ niche: e.target.value })}
        placeholder="nicchia"
      />
      <div className="ml-1 flex items-center gap-0.5">
        <button
          onClick={undo}
          disabled={!canUndo}
          title="Annulla (⌘Z)"
          className="grid h-7 w-7 place-items-center rounded-lg text-zinc-500 transition hover:bg-[#222227] hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <Undo2 size={14} />
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          title="Ripristina (⇧⌘Z)"
          className="grid h-7 w-7 place-items-center rounded-lg text-zinc-500 transition hover:bg-[#222227] hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <Redo2 size={14} />
        </button>
      </div>
      <div className="flex-1" />
      <span className="flex items-center gap-1.5 text-[10px] text-zinc-600">
        <span
          className={`h-1.5 w-1.5 rounded-full ${saving ? "animate-pulse bg-zinc-300" : dirty ? "bg-zinc-500" : "bg-emerald-500/80"}`}
        />
        {saving ? "salvataggio" : dirty ? "modifiche" : "salvato"}
      </span>
      <BalancePill />
      <Link
        href="/settings"
        title="Impostazioni"
        className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 transition hover:bg-[#222227] hover:text-zinc-200"
      >
        <Settings size={15} />
      </Link>
    </div>
  );
}
