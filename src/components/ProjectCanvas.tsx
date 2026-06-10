"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Node } from "@xyflow/react";
import { useFlowStore } from "@/store/useFlowStore";
import { Flow } from "./canvas/Flow";
import { Inspector } from "./Inspector";
import { VaultPanel } from "./VaultPanel";
import { TopBar } from "./TopBar";
import { OutputDock } from "./OutputDock";
import type { Project } from "@/lib/types";

export function ProjectCanvas({ projectId }: { projectId: string }) {
  const load = useFlowStore((s) => s.load);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [tab, setTab] = useState<"node" | "vault">("node");

  useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((p: Project) => {
        load(p);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [projectId, load]);

  // Autosave: ogni modifica salva (debounce 500ms) + flush su unmount e chiusura tab.
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const meta = useFlowStore((s) => s.meta);
  const dirty = useFlowStore((s) => s.dirty);

  // payload sempre aggiornato per il salvataggio sincrono (beacon/unmount)
  const payloadRef = useRef<string>("");
  useEffect(() => {
    if (!meta) return;
    const clean = (nodes as Node[]).map(({ selected, dragging, ...n }) => n); // eslint-disable-line @typescript-eslint/no-unused-vars
    payloadRef.current = JSON.stringify({ graph: { nodes: clean, edges }, name: meta.name, niche: meta.niche });
  }, [nodes, edges, meta]);

  const save = useCallback(async () => {
    const m = useFlowStore.getState().meta;
    if (!m || !payloadRef.current) return;
    const { markSaving, markClean } = useFlowStore.getState();
    markSaving(true);
    try {
      await fetch(`/api/projects/${m.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: payloadRef.current,
      });
    } finally {
      markClean();
    }
  }, []);

  useEffect(() => {
    if (!dirty || !meta || status !== "ready") return;
    const t = setTimeout(save, 500);
    return () => clearTimeout(t);
  }, [nodes, edges, meta, dirty, status, save]);

  // salvataggio garantito alla chiusura/refresh e quando si lascia la pagina
  useEffect(() => {
    const flush = () => {
      if (!useFlowStore.getState().dirty || !meta) return;
      navigator.sendBeacon?.(`/api/projects/${meta.id}`, new Blob([payloadRef.current], { type: "application/json" }));
    };
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
    });
    return () => {
      window.removeEventListener("beforeunload", flush);
      if (useFlowStore.getState().dirty) save();
    };
  }, [meta, save]);

  if (status === "loading")
    return <div className="flex h-screen items-center justify-center text-[12px] text-zinc-600">Carico…</div>;
  if (status === "error")
    return <div className="flex h-screen items-center justify-center text-[12px] text-red-400">Progetto non trovato</div>;

  return (
    <div className="flex h-screen flex-col">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          <Flow />
          <OutputDock />
        </div>
        <div className="flex w-[320px] flex-col border-l border-[#222227] bg-[#161619]">
          <div className="p-3 pb-0">
            <div className="grid grid-cols-2 gap-1 rounded-full border border-[#2a2a30] bg-[#1d1d21] p-1">
              {(["node", "vault"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`rounded-full py-1 text-[10.5px] font-medium transition ${
                    tab === t ? "bg-white text-black" : "text-zinc-500 hover:text-zinc-200"
                  }`}
                >
                  {t === "node" ? "Blocco" : "Vault"}
                </button>
              ))}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{tab === "node" ? <Inspector /> : <VaultPanel />}</div>
        </div>
      </div>
    </div>
  );
}
