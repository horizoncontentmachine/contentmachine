"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Plus, Trash2 } from "lucide-react";
import { getJson, postJson } from "@/lib/clientApi";
import type { VaultEntry, VaultType } from "@/lib/types";

const TYPES: { id: VaultType; label: string }[] = [
  { id: "image", label: "Prompt immagine" },
  { id: "hook", label: "Hook" },
];

// Vault globale (sempre accessibile dalla home): sfoglia/filtra per nicchia, aggiungi, copia.
export function VaultBrowser({ niches }: { niches: string[] }) {
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [tab, setTab] = useState<VaultType>("image");
  const [filter, setFilter] = useState("all");
  const [text, setText] = useState("");
  const [addNiche, setAddNiche] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const reload = () => getJson<VaultEntry[]>("/api/vault").then(setEntries).catch(() => {});
  useEffect(() => {
    reload();
  }, []);

  const allNiches = useMemo(() => {
    const set = new Set<string>([...niches, ...entries.map((e) => e.niche)].filter(Boolean));
    return Array.from(set).sort();
  }, [niches, entries]);

  const add = async () => {
    if (!text.trim()) return;
    await postJson("/api/vault", { niche: addNiche.trim() || "general", type: tab, text });
    setText("");
    reload();
  };
  const remove = async (id: string) => {
    await fetch(`/api/vault?id=${id}`, { method: "DELETE" });
    reload();
  };
  const copy = (e: VaultEntry) => {
    navigator.clipboard.writeText(e.text);
    setCopied(e.id);
    setTimeout(() => setCopied(null), 1200);
  };

  const filtered = entries.filter((e) => e.type === tab && (filter === "all" || e.niche === filter));

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[#222227] p-4 pb-3">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold tracking-tight text-zinc-100">Prompt Vault</h2>
          <span className="text-[10px] text-zinc-600">{entries.length} salvati</span>
        </div>
        <div className="grid grid-cols-2 gap-1 rounded-full border border-[#2a2a30] bg-[#1d1d21] p-1">
          {TYPES.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-full py-1 text-[10.5px] font-medium transition ${
                tab === t.id ? "bg-white text-black" : "text-zinc-500 hover:text-zinc-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <select
          className="mt-2 h-8 w-full rounded-lg border border-[#2a2a30] bg-[#1d1d21] px-2.5 text-[11px] text-zinc-300 outline-none transition focus:border-zinc-500"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">Tutte le nicchie</option>
          {allNiches.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-[#2a2a30] p-4 text-center text-[10.5px] leading-relaxed text-zinc-600">
            Salva qui i prompt e gli hook che funzionano. Cresce con te e lo riusi in ogni progetto della nicchia.
          </div>
        )}
        {filtered.map((e) => (
          <div key={e.id} className="group rounded-xl border border-[#26262b] bg-[#1d1d21] p-2.5 transition hover:border-[#3c3c44]">
            <div className="whitespace-pre-wrap text-[10.5px] leading-relaxed text-zinc-300">{e.text}</div>
            <div className="mt-1.5 flex items-center justify-between">
              <span className="rounded-full border border-[#2a2a30] px-1.5 py-px text-[8.5px] text-zinc-500">{e.niche}</span>
              <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
                <button onClick={() => copy(e)} className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-[3px] text-[9px] font-semibold text-black hover:bg-zinc-200">
                  {copied === e.id ? <Check size={9} /> : <Copy size={9} />} {copied === e.id ? "copiato" : "copia"}
                </button>
                <button onClick={() => remove(e.id)} className="grid h-5 w-5 place-items-center rounded-full text-zinc-600 hover:text-red-400">
                  <Trash2 size={10} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2 border-t border-[#222227] p-4">
        <textarea
          className="w-full rounded-lg border border-[#2a2a30] bg-[#1d1d21] px-2.5 py-1.5 text-[10.5px] text-zinc-200 placeholder-zinc-600 outline-none transition focus:border-zinc-500"
          rows={2}
          placeholder={tab === "image" ? "Nuovo prompt immagine…" : "Nuovo hook…"}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex gap-2">
          <input
            className="h-8 flex-1 rounded-lg border border-[#2a2a30] bg-[#1d1d21] px-2.5 text-[10.5px] text-zinc-200 placeholder-zinc-600 outline-none transition focus:border-zinc-500"
            placeholder="nicchia (default: general)"
            value={addNiche}
            onChange={(e) => setAddNiche(e.target.value)}
            list="vault-niches"
          />
          <datalist id="vault-niches">
            {allNiches.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <button
            onClick={add}
            disabled={!text.trim()}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white px-3 text-[10.5px] font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-40"
          >
            <Plus size={11} /> Salva
          </button>
        </div>
      </div>
    </div>
  );
}
