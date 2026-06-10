"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowUpLeft, Plus, X } from "lucide-react";
import { useFlowStore } from "@/store/useFlowStore";
import { postJson } from "@/lib/clientApi";
import type { VaultEntry, VaultType, OverlaySpec } from "@/lib/types";
import type { OverlayData, VariantsData } from "@/lib/nodeData";

const TYPES: { id: VaultType; label: string }[] = [
  { id: "image", label: "Prompt immagine" },
  { id: "hook", label: "Hook" },
];

// Prompt vault per nicchia: i blocchi pescano da qui con "usa".
export function VaultPanel() {
  const meta = useFlowStore((s) => s.meta);
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [tab, setTab] = useState<VaultType>("image");
  const [text, setText] = useState("");

  const reload = useCallback(async () => {
    if (!meta) return;
    const r = await fetch(`/api/vault?niche=${encodeURIComponent(meta.niche)}`);
    setEntries(await r.json());
  }, [meta?.niche]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    reload();
  }, [reload]);

  const add = async () => {
    if (!text.trim() || !meta) return;
    await postJson("/api/vault", { niche: meta.niche, type: tab, text });
    setText("");
    reload();
  };

  const remove = async (id: string) => {
    await fetch(`/api/vault?id=${id}`, { method: "DELETE" });
    reload();
  };

  // Applica un'entry al blocco selezionato
  const use = (e: VaultEntry) => {
    const { selectedId, nodes, updateNodeData } = useFlowStore.getState();
    const node = nodes.find((n) => n.id === selectedId);
    if (!node) return;
    if (e.type === "image" && node.type === "prompt") {
      updateNodeData(node.id, { text: e.text });
    } else if (e.type === "hook" && node.type === "overlay") {
      const ov = (node.data as OverlayData).overlay as OverlaySpec;
      updateNodeData(node.id, { overlay: { ...ov, text: e.text } });
    } else if (e.type === "hook" && node.type === "variants") {
      const d = node.data as VariantsData;
      updateNodeData(node.id, { hookTexts: (d.hookTexts ? d.hookTexts + "\n" : "") + e.text });
    }
  };

  const filtered = entries.filter((e) => e.type === tab);

  return (
    <div className="flex h-full flex-col p-4">
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
      <div className="mt-2.5 text-[9.5px] text-zinc-600">
        Nicchia <span className="font-medium text-zinc-400">{meta?.niche || "—"}</span> · seleziona un blocco{" "}
        {tab === "image" ? "Prompt" : "Testo o Varianti"} e premi &quot;usa&quot;
      </div>
      <div className="mt-3 flex-1 space-y-2 overflow-y-auto pr-1">
        {filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-[#2a2a30] p-4 text-center text-[10.5px] leading-relaxed text-zinc-600">
            Il vault cresce con te: salva qui i prompt e gli hook che funzionano, per riusarli in ogni progetto della
            nicchia.
          </div>
        )}
        {filtered.map((e) => (
          <div key={e.id} className="group rounded-xl border border-[#2a2a30] bg-[#1d1d21] p-2.5 transition hover:border-[#3c3c44]">
            <div className="whitespace-pre-wrap text-[10.5px] leading-relaxed text-zinc-300">{e.text}</div>
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-[8.5px] text-zinc-600">{e.niche}</span>
              <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
                <button
                  onClick={() => use(e)}
                  className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-[3px] text-[9px] font-semibold text-black hover:bg-zinc-200"
                >
                  <ArrowUpLeft size={9} /> usa
                </button>
                <button onClick={() => remove(e.id)} className="grid h-5 w-5 place-items-center rounded-full text-zinc-600 hover:text-red-400">
                  <X size={10} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 space-y-2 border-t border-[#26262b] pt-3">
        <textarea
          className="w-full rounded-lg border border-[#2a2a30] bg-[#1d1d21] px-2.5 py-1.5 text-[10.5px] text-zinc-200 placeholder-zinc-600 outline-none transition focus:border-zinc-500"
          rows={2}
          placeholder={tab === "image" ? "Nuovo prompt immagine…" : "Nuovo hook…"}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          onClick={add}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#2e2e34] bg-[#202024] px-3 py-1 text-[10.5px] font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
        >
          <Plus size={11} /> Salva nel vault
        </button>
      </div>
    </div>
  );
}
