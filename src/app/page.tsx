"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Copy, FolderOpen, Plus, Settings, Trash2 } from "lucide-react";
import { formatCents } from "@/lib/costs";
import { BalancePill } from "@/components/BalancePill";
import { VaultBrowser } from "@/components/VaultBrowser";
import type { Project } from "@/lib/types";

export default function Home() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [name, setName] = useState("");
  const [niche, setNiche] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const reload = () =>
    fetch("/api/projects")
      .then((r) => r.json())
      .then(setProjects);

  useEffect(() => {
    reload();
  }, []);

  const create = async () => {
    const r = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, niche }),
    });
    const p = await r.json();
    window.location.href = `/project/${p.id}`;
  };

  const duplicate = async (p: Project) => {
    const full = await fetch(`/api/projects/${p.id}`).then((r) => r.json());
    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: p.name + " (copia)", niche: p.niche, graph: full.graph }),
    });
    reload();
  };

  const remove = async (p: Project) => {
    if (!confirm(`Eliminare "${p.name}"? Le immagini generate restano in cache.`)) return;
    await fetch(`/api/projects/${p.id}`, { method: "DELETE" });
    reload();
  };

  // raggruppa per nicchia
  const groups = useMemo(() => {
    const map = new Map<string, Project[]>();
    for (const p of projects ?? []) {
      const k = p.niche?.trim() || "Senza nicchia";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(p);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [projects]);

  const niches = useMemo(() => groups.map((g) => g[0]).filter((n) => n !== "Senza nicchia"), [groups]);

  return (
    <div className="flex h-screen flex-col">
      {/* header */}
      <div className="flex h-14 items-center gap-3 border-b border-[#222227] bg-[#161619] px-5">
        <span className="text-[15px] font-bold tracking-tight text-white">ShortFlow</span>
        <span className="hidden text-[11px] text-zinc-600 sm:inline">Caroselli 9:16 da workflow riutilizzabili</span>
        <div className="flex-1" />
        <BalancePill />
        <Link
          href="/settings"
          title="Impostazioni"
          className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 transition hover:bg-[#222227] hover:text-zinc-200"
        >
          <Settings size={15} />
        </Link>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* progetti */}
        <div className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-6 py-8">
            <div className="flex gap-2">
              <input
                className="h-10 flex-1 rounded-xl border border-[#2a2a30] bg-[#19191c] px-3.5 text-[13px] text-zinc-200 placeholder-zinc-600 outline-none transition focus:border-zinc-500"
                placeholder="Nome del nuovo progetto…"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && create()}
              />
              <input
                className="h-10 w-40 rounded-xl border border-[#2a2a30] bg-[#19191c] px-3.5 text-[13px] text-zinc-200 placeholder-zinc-600 outline-none transition focus:border-zinc-500"
                placeholder="nicchia"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                list="home-niches"
                onKeyDown={(e) => e.key === "Enter" && create()}
              />
              <datalist id="home-niches">
                {niches.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
              <button
                onClick={create}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-white px-4 text-[12.5px] font-semibold text-black transition hover:bg-zinc-200"
              >
                <Plus size={14} /> Crea
              </button>
            </div>

            {projects && projects.length === 0 && (
              <div className="mt-8 rounded-2xl border border-dashed border-[#2a2a30] p-10 text-center text-[12px] leading-relaxed text-zinc-600">
                Nessun progetto ancora.
                <br />
                Creane uno: il workflow che costruisci resta salvato e lo riapri identico quando vuoi.
              </div>
            )}

            <div className="mt-8 space-y-6">
              {groups.map(([nicheName, items]) => {
                const isCol = collapsed[nicheName];
                return (
                  <div key={nicheName}>
                    <button
                      onClick={() => setCollapsed((c) => ({ ...c, [nicheName]: !c[nicheName] }))}
                      className="mb-2.5 flex w-full items-center gap-2 text-left"
                    >
                      <ChevronDown size={13} className={`text-zinc-600 transition ${isCol ? "-rotate-90" : ""}`} />
                      <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-400">{nicheName}</span>
                      <span className="text-[10px] text-zinc-600">{items.length}</span>
                      <div className="h-px flex-1 bg-[#222227]" />
                    </button>
                    {!isCol && (
                      <div className="space-y-2">
                        {items.map((p) => (
                          <div
                            key={p.id}
                            className="group flex items-center gap-4 rounded-2xl border border-[#26262b] bg-[#19191c] px-5 py-3.5 transition hover:border-[#3c3c44]"
                          >
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#2e2e34] bg-[#1f1f23] text-zinc-500">
                              <FolderOpen size={15} />
                            </span>
                            <Link href={`/project/${p.id}`} className="min-w-0 flex-1">
                              <div className="truncate text-[14px] font-semibold tracking-tight text-zinc-100">{p.name}</div>
                              <div className="mt-0.5 flex items-center gap-2 text-[10.5px] text-zinc-600">
                                <span>agg. {new Date(p.updatedAt).toLocaleDateString("it-IT", { day: "numeric", month: "short" })}</span>
                                <span className="text-zinc-700">·</span>
                                <span>{formatCents(p.spentCents)} spesi</span>
                              </div>
                            </Link>
                            <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
                              <button
                                onClick={() => duplicate(p)}
                                title="Duplica come template"
                                className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 transition hover:bg-[#222227] hover:text-zinc-200"
                              >
                                <Copy size={13} />
                              </button>
                              <button
                                onClick={() => remove(p)}
                                title="Elimina"
                                className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 transition hover:bg-[#222227] hover:text-red-400"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* vault sempre accessibile */}
        <div className="hidden w-[320px] shrink-0 border-l border-[#222227] bg-[#161619] lg:block">
          <VaultBrowser niches={niches} />
        </div>
      </div>
    </div>
  );
}
