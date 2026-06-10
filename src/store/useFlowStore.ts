"use client";

import { create } from "zustand";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import { DEFAULT_OVERLAY, type Project } from "@/lib/types";
import type { NodeKind } from "@/lib/nodeData";

interface Meta {
  id: string;
  name: string;
  niche: string;
  spentCents: number;
}

interface Clip {
  nodes: Node[];
  edges: Edge[];
}

interface FlowState {
  meta: Meta | null;
  nodes: Node[];
  edges: Edge[];
  selectedId: string | null;
  busy: Record<string, boolean>;
  errors: Record<string, string | null>;
  clipboard: Clip | null;
  past: Clip[];
  future: Clip[];
  dirty: boolean;
  saving: boolean;

  load: (p: Project) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (conn: Connection) => void;
  addNode: (kind: NodeKind, position: { x: number; y: number }) => string;
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
  setSelected: (id: string | null) => void;
  setBusy: (id: string, b: boolean) => void;
  setError: (id: string, msg: string | null) => void;
  addSpent: (cents: number) => void;
  setMeta: (patch: Partial<Meta>) => void;
  markSaving: (saving: boolean) => void;
  markClean: () => void;

  // editing
  copyNodes: (ids: string[]) => void;
  pasteClipboard: (at?: { x: number; y: number }) => void;
  duplicateNodes: (ids: string[]) => void;
  deleteNodes: (ids: string[]) => void;
  deleteEdge: (id: string) => void;
  deleteSelection: () => void;
  selectAll: () => void;
  selectNodes: (ids: string[]) => void;
  selectedIds: () => string[];

  // cronologia (undo/redo)
  commit: () => void;
  undo: () => void;
  redo: () => void;
}

const HISTORY_LIMIT = 80;

let counter = 0;
function nid(kind: string) {
  return `${kind}_${Date.now().toString(36)}_${counter++}`;
}

// prossimo numero progressivo per tipo ("Immagine #3")
function nextN(nodes: Node[], kind: string): number {
  return (
    nodes
      .filter((x) => x.type === kind)
      .reduce((m, x) => Math.max(m, Number((x.data as { n?: number }).n) || 0), 0) + 1
  );
}

function defaultData(kind: NodeKind, n: number): Record<string, unknown> {
  switch (kind) {
    case "prompt":
      return { text: "", n };
    case "imageGen":
      return { quality: "low", results: [], activeIndex: 0, n };
    case "upload":
      return { result: null, fileName: "", n };
    case "overlay":
      return { overlay: { ...DEFAULT_OVERLAY, text: "IL TUO HOOK QUI" }, n };
    case "carousel":
      return { bodyCount: 3, lastExport: null, n };
    case "variants":
      return { hookTexts: "", shuffleBody: false, locked: "", maxVariants: 10, seed: 42, lastExport: null, n };
  }
}

// Clona un set di nodi: nuovi id, edge interni rimappati, numeri progressivi ricalcolati, offset.
function cloneNodes(
  src: Node[],
  allNodes: Node[],
  srcEdges: Edge[],
  offset: { x: number; y: number }
): { nodes: Node[]; edges: Edge[] } {
  const idMap = new Map<string, string>();
  const counters: Record<string, number> = {};
  let pool = [...allNodes];

  const nodes = src.map((node) => {
    const newId = nid(node.type ?? "node");
    idMap.set(node.id, newId);
    const kind = node.type ?? "";
    if (!(kind in counters)) counters[kind] = nextN(pool, kind);
    const n = counters[kind]++;
    const cloned: Node = {
      ...node,
      id: newId,
      position: { x: node.position.x + offset.x, y: node.position.y + offset.y },
      selected: true,
      data: { ...node.data, n },
    };
    pool = [...pool, cloned];
    return cloned;
  });

  const edges = srcEdges
    .filter((e) => idMap.has(e.source) && idMap.has(e.target))
    .map((e) => ({
      ...e,
      id: `e_${nid("edge")}`,
      source: idMap.get(e.source)!,
      target: idMap.get(e.target)!,
    }));

  return { nodes, edges };
}

// Snapshot profondo dello stato grafo per la cronologia.
function snapClip(nodes: Node[], edges: Edge[]): Clip {
  return { nodes: structuredClone(nodes), edges: structuredClone(edges) };
}

// Coalescing degli edit di testo: digitare nello stesso campo non crea uno step di undo per tasto.
let lastEditKey = "";
let lastEditAt = 0;

export const useFlowStore = create<FlowState>((set, get) => ({
  meta: null,
  nodes: [],
  edges: [],
  selectedId: null,
  busy: {},
  errors: {},
  clipboard: null,
  past: [],
  future: [],
  dirty: false,
  saving: false,

  load: (p) =>
    set({
      meta: { id: p.id, name: p.name, niche: p.niche, spentCents: p.spentCents },
      nodes: (p.graph?.nodes as Node[]) ?? [],
      edges: (p.graph?.edges as Edge[]) ?? [],
      selectedId: null,
      past: [],
      future: [],
      dirty: false,
    }),

  // Salva lo stato corrente nello stack undo (chiamare PRIMA di una modifica strutturale).
  commit: () =>
    set((s) => ({
      past: [...s.past, snapClip(s.nodes, s.edges)].slice(-HISTORY_LIMIT),
      future: [],
    })),

  onNodesChange: (changes) => {
    // le rimozioni (es. tasto Canc di React Flow) vanno nello storico
    if (changes.some((c) => c.type === "remove")) get().commit();
    set({ nodes: applyNodeChanges(changes, get().nodes), dirty: true });
  },
  onEdgesChange: (changes) => {
    if (changes.some((c) => c.type === "remove")) get().commit();
    set({ edges: applyEdgeChanges(changes, get().edges), dirty: true });
  },

  onConnect: (conn) => {
    get().commit();
    // un solo collegamento per ingresso, tranne le reference (ref) che ne accettano fino a 16
    const isRef = conn.targetHandle === "ref";
    let edges = get().edges;
    if (!isRef) {
      edges = edges.filter(
        (e) => !(e.target === conn.target && (e.targetHandle ?? "in") === (conn.targetHandle ?? "in"))
      );
    }
    set({ edges: addEdge(conn, edges), dirty: true });
  },

  addNode: (kind, position) => {
    get().commit();
    const id = nid(kind);
    set({
      nodes: [...get().nodes, { id, type: kind, position, data: defaultData(kind, nextN(get().nodes, kind)) }],
      dirty: true,
    });
    return id;
  },

  updateNodeData: (id, patch) => {
    // raggruppa i tasti consecutivi sullo stesso campo in un solo step di undo
    const key = id + ":" + Object.keys(patch).join(",");
    const now = Date.now();
    if (key !== lastEditKey || now - lastEditAt > 800) get().commit();
    lastEditKey = key;
    lastEditAt = now;
    set({
      nodes: get().nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
      dirty: true,
    });
  },

  setSelected: (id) => set({ selectedId: id }),
  setBusy: (id, b) => set({ busy: { ...get().busy, [id]: b } }),
  setError: (id, msg) => set({ errors: { ...get().errors, [id]: msg } }),
  addSpent: (cents) => {
    const m = get().meta;
    if (m) set({ meta: { ...m, spentCents: m.spentCents + cents } });
  },
  setMeta: (patch) => {
    const m = get().meta;
    if (m) set({ meta: { ...m, ...patch }, dirty: true });
  },
  markSaving: (saving) => set({ saving }),
  markClean: () => set({ dirty: false, saving: false }),

  // ---------- editing ----------

  selectedIds: () => get().nodes.filter((n) => n.selected).map((n) => n.id),

  copyNodes: (ids) => {
    const nodes = get().nodes.filter((n) => ids.includes(n.id));
    if (!nodes.length) return;
    const edges = get().edges.filter((e) => ids.includes(e.source) && ids.includes(e.target));
    // deep-clone per congelare lo stato copiato
    set({ clipboard: JSON.parse(JSON.stringify({ nodes, edges })) });
  },

  pasteClipboard: (at) => {
    const clip = get().clipboard;
    if (!clip?.nodes.length) return;
    get().commit();
    const minX = Math.min(...clip.nodes.map((n) => n.position.x));
    const minY = Math.min(...clip.nodes.map((n) => n.position.y));
    const offset = at ? { x: at.x - minX, y: at.y - minY } : { x: 40, y: 40 };
    const { nodes, edges } = cloneNodes(clip.nodes, get().nodes, clip.edges, offset);
    set({
      nodes: [...get().nodes.map((n) => ({ ...n, selected: false })), ...nodes],
      edges: [...get().edges, ...edges],
      selectedId: nodes[0]?.id ?? null,
      dirty: true,
    });
  },

  duplicateNodes: (ids) => {
    const src = get().nodes.filter((n) => ids.includes(n.id));
    if (!src.length) return;
    get().commit();
    const edges = get().edges.filter((e) => ids.includes(e.source) && ids.includes(e.target));
    const cloned = cloneNodes(src, get().nodes, edges, { x: 40, y: 40 });
    set({
      nodes: [...get().nodes.map((n) => ({ ...n, selected: false })), ...cloned.nodes],
      edges: [...get().edges, ...cloned.edges],
      selectedId: cloned.nodes[0]?.id ?? null,
      dirty: true,
    });
  },

  deleteNodes: (ids) => {
    if (!ids.length) return;
    get().commit();
    set({
      nodes: get().nodes.filter((n) => !ids.includes(n.id)),
      edges: get().edges.filter((e) => !ids.includes(e.source) && !ids.includes(e.target)),
      selectedId: null,
      dirty: true,
    });
  },

  deleteEdge: (id) => {
    get().commit();
    set({ edges: get().edges.filter((e) => e.id !== id), dirty: true });
  },

  // elimina ciò che è selezionato: nodi (+ relativi edge) e/o singoli edge selezionati
  deleteSelection: () => {
    const nodeIds = get().nodes.filter((n) => n.selected).map((n) => n.id);
    const edgeIds = get().edges.filter((e) => e.selected).map((e) => e.id);
    if (!nodeIds.length && !edgeIds.length) return;
    get().commit();
    set({
      nodes: get().nodes.filter((n) => !nodeIds.includes(n.id)),
      edges: get().edges.filter(
        (e) => !edgeIds.includes(e.id) && !nodeIds.includes(e.source) && !nodeIds.includes(e.target)
      ),
      selectedId: null,
      dirty: true,
    });
  },

  selectAll: () => set({ nodes: get().nodes.map((n) => ({ ...n, selected: true })) }),

  selectNodes: (ids) =>
    set({
      nodes: get().nodes.map((n) => ({ ...n, selected: ids.includes(n.id) })),
      selectedId: ids[0] ?? null,
    }),

  undo: () => {
    const { past } = get();
    if (!past.length) return;
    const prev = past[past.length - 1];
    set((s) => ({
      past: s.past.slice(0, -1),
      future: [...s.future, snapClip(s.nodes, s.edges)].slice(-HISTORY_LIMIT),
      nodes: prev.nodes,
      edges: prev.edges,
      selectedId: null,
      dirty: true,
    }));
  },

  redo: () => {
    const { future } = get();
    if (!future.length) return;
    const next = future[future.length - 1];
    set((s) => ({
      future: s.future.slice(0, -1),
      past: [...s.past, snapClip(s.nodes, s.edges)].slice(-HISTORY_LIMIT),
      nodes: next.nodes,
      edges: next.edges,
      selectedId: null,
      dirty: true,
    }));
  },
}));
