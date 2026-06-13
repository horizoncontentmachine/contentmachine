"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LayoutGrid, CalendarClock, AtSign, History } from "lucide-react";
import { useFlowStore } from "@/store/useFlowStore";
import { Flow } from "./canvas/Flow";
import { Inspector } from "./Inspector";
import { VaultPanel } from "./VaultPanel";
import { TopBar } from "./TopBar";
import { OutputDock } from "./OutputDock";
import { AccountsPanel } from "./distribution/AccountsPanel";
import { HistoryPanel } from "./distribution/HistoryPanel";
import { CalendarPanel } from "./distribution/CalendarPanel";
import { PLATFORM_FORMAT } from "@/lib/formats";
import type { Node as RFNode } from "@xyflow/react";
import type { Project } from "@/lib/types";

const PLAT_BADGE = { instagram: "IG", tiktok: "TT", x: "X" } as const;

function WorkflowBar() {
  const workflows = useFlowStore((s) => s.workflows);
  const activeWf = useFlowStore((s) => s.activeWf);
  const switchWorkflow = useFlowStore((s) => s.switchWorkflow);
  if (workflows.length <= 1) return null;
  return (
    <div className="flex items-center gap-1.5 border-b border-[#1e1e22] bg-[#121214] px-3 py-1.5">
      <span className="mr-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-600">Workflow</span>
      {workflows.map((w) => {
        const f = PLATFORM_FORMAT[w.platform];
        const on = w.id === activeWf;
        return (
          <button
            key={w.id}
            onClick={() => switchWorkflow(w.id)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
              on ? "bg-[#26262c] text-zinc-100" : "text-zinc-500 hover:text-zinc-200"
            }`}
          >
            <span className={`grid h-4 w-5 place-items-center rounded text-[8px] font-bold ${on ? "bg-white text-black" : "bg-[#2e2e34] text-zinc-400"}`}>
              {PLAT_BADGE[w.platform]}
            </span>
            {w.name}
            <span className="text-[9px] text-zinc-600">{f.ratio}</span>
          </button>
        );
      })}
    </div>
  );
}

type View = "crea" | "calendario" | "account" | "storico";
const VIEWS: { id: View; label: string; icon: React.ReactNode }[] = [
  { id: "crea", label: "Crea", icon: <LayoutGrid size={13} /> },
  { id: "calendario", label: "Calendario", icon: <CalendarClock size={13} /> },
  { id: "account", label: "Account", icon: <AtSign size={13} /> },
  { id: "storico", label: "Storico", icon: <History size={13} /> },
];

export function ProjectCanvas({ projectId }: { projectId: string }) {
  const load = useFlowStore((s) => s.load);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [tab, setTab] = useState<"node" | "vault">("node");
  const [view, setView] = useState<View>("crea");

  // vista iniziale da URL (?tab=account dopo il collegamento)
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "account" || t === "calendario" || t === "storico") setView(t);
  }, []);

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

  const activeWf = useFlowStore((s) => s.activeWf);

  // payload sempre aggiornato per il salvataggio sincrono (beacon/unmount): tutti i workflow
  const payloadRef = useRef<string>("");
  useEffect(() => {
    if (!meta) return;
    const wfs = useFlowStore.getState().workflowsForSave().map((w) => ({
      ...w,
      graph: {
        nodes: (w.graph.nodes as RFNode[]).map(({ selected, dragging, ...n }) => n), // eslint-disable-line @typescript-eslint/no-unused-vars
        edges: w.graph.edges,
      },
    }));
    payloadRef.current = JSON.stringify({ workflows: wfs, name: meta.name, niche: meta.niche });
  }, [nodes, edges, meta, activeWf]);

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

      {/* schede del progetto */}
      <div className="flex h-10 items-center gap-1 border-b border-[#222227] bg-[#161619] px-3">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition ${
              view === v.id ? "bg-[#26262c] text-zinc-100" : "text-zinc-500 hover:text-zinc-200"
            }`}
          >
            {v.icon} {v.label}
          </button>
        ))}
      </div>

      {view === "crea" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <WorkflowBar />
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
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {view === "account" && <AccountsPanel projectId={projectId} />}
          {view === "storico" && <HistoryPanel projectId={projectId} />}
          {view === "calendario" && <CalendarPanel />}
        </div>
      )}
    </div>
  );
}
