"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ClipboardPaste,
  Copy,
  CopyPlus,
  Crosshair,
  BoxSelect,
  Image as ImageIcon,
  Layers,
  Scissors,
  Shuffle,
  TextCursorInput,
  Trash2,
  Type,
  Undo2,
  Redo2,
  Upload,
} from "lucide-react";
import { useFlowStore } from "@/store/useFlowStore";
import { nodeTypes } from "./nodes";
import { ContextMenu, type MenuItem, type MenuState } from "./ContextMenu";
import type { NodeKind } from "@/lib/nodeData";

type DataKind = "prompt" | "image" | "slides";

function sourceKind(node: Node): DataKind {
  switch (node.type) {
    case "prompt":
      return "prompt";
    case "carousel":
      return "slides";
    default:
      return "image"; // imageGen, upload, overlay
  }
}

function accepted(targetType: string, handle: string): DataKind[] {
  if (targetType === "imageGen") return handle === "prompt" ? ["prompt"] : ["image"];
  if (targetType === "overlay") return ["image"];
  if (targetType === "carousel") return ["image"];
  if (targetType === "variants") return ["slides"];
  return [];
}

const BLOCKS: { kind: NodeKind; label: string; desc: string; icon: React.ReactNode }[] = [
  { kind: "prompt", label: "Prompt", desc: "il testo che descrive l'immagine", icon: <TextCursorInput size={13} /> },
  { kind: "imageGen", label: "Immagine", desc: "genera con GPT Image 2", icon: <ImageIcon size={13} /> },
  { kind: "upload", label: "Upload", desc: "una tua immagine", icon: <Upload size={13} /> },
  { kind: "overlay", label: "Testo", desc: "scritta stile TikTok", icon: <Type size={13} /> },
  { kind: "carousel", label: "Carosello", desc: "Hook → Slide → CTA", icon: <Layers size={13} /> },
  { kind: "variants", label: "Varianti", desc: "tante versioni, zero costi", icon: <Shuffle size={13} /> },
];

const BLOCK_ICON: Record<string, React.ReactNode> = Object.fromEntries(BLOCKS.map((b) => [b.kind, b.icon]));

function BlockPalette() {
  const addNode = useFlowStore((s) => s.addNode);
  return (
    <div className="w-[188px] rounded-2xl border border-[#2a2a30] bg-[#19191c]/90 p-2 shadow-[0_14px_40px_rgba(0,0,0,0.5)] backdrop-blur-md">
      <div className="px-2 pb-1.5 pt-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-zinc-600">Blocchi</div>
      <div className="space-y-0.5">
        {BLOCKS.map((b) => (
          <button
            key={b.kind}
            draggable
            onDragStart={(e) => e.dataTransfer.setData("application/shortflow", JSON.stringify({ kind: b.kind }))}
            onClick={() => addNode(b.kind, { x: 280 + Math.random() * 80, y: 160 + Math.random() * 80 })}
            className="group flex w-full cursor-grab items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-[#222227] active:cursor-grabbing"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[#2e2e34] bg-[#1f1f23] text-zinc-400 transition group-hover:border-[#454550] group-hover:text-white">
              {b.icon}
            </span>
            <span className="min-w-0">
              <span className="block text-[11.5px] font-medium text-zinc-200">{b.label}</span>
              <span className="block truncate text-[9px] leading-tight text-zinc-600">{b.desc}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function FlowInner() {
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const onNodesChange = useFlowStore((s) => s.onNodesChange);
  const onEdgesChange = useFlowStore((s) => s.onEdgesChange);
  const onConnect = useFlowStore((s) => s.onConnect);
  const addNode = useFlowStore((s) => s.addNode);
  const setSelected = useFlowStore((s) => s.setSelected);
  const { screenToFlowPosition, fitView } = useReactFlow();

  const [menu, setMenu] = useState<MenuState | null>(null);
  const [connecting, setConnecting] = useState(false);
  const mouse = useRef({ x: 0, y: 0 });

  const isValidConnection = useCallback((conn: Connection | Edge) => {
    const { nodes } = useFlowStore.getState();
    const src = nodes.find((n) => n.id === conn.source);
    const tgt = nodes.find((n) => n.id === conn.target);
    if (!src || !tgt || src.id === tgt.id) return false;
    return accepted(tgt.type ?? "", conn.targetHandle ?? "in").includes(sourceKind(src));
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const raw = e.dataTransfer.getData("application/shortflow");
      if (!raw) return;
      const { kind } = JSON.parse(raw) as { kind: NodeKind };
      addNode(kind, screenToFlowPosition({ x: e.clientX, y: e.clientY }));
    },
    [addNode, screenToFlowPosition]
  );

  // ---- scorciatoie globali (su window: funzionano sempre, non serve il focus sulla canvas) ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const typing = !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      const mod = e.metaKey || e.ctrlKey;
      const s = useFlowStore.getState();

      // undo / redo
      if (mod && (e.key === "z" || e.key === "Z")) {
        if (typing) return;
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (mod && (e.key === "y" || e.key === "Y")) {
        if (typing) return;
        e.preventDefault();
        s.redo();
        return;
      }

      if (typing) return;
      const sel = s.selectedIds();
      if (mod && e.key === "c") {
        s.copyNodes(sel);
      } else if (mod && e.key === "x") {
        s.copyNodes(sel);
        s.deleteNodes(sel);
      } else if (mod && e.key === "v") {
        s.pasteClipboard(screenToFlowPosition(mouse.current));
      } else if (mod && e.key === "d") {
        e.preventDefault();
        s.duplicateNodes(sel);
      } else if (mod && e.key === "a") {
        e.preventDefault();
        s.selectAll();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        s.deleteSelection();
      } else if (e.key === "Escape") {
        s.selectNodes([]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screenToFlowPosition]);

  // ---- menu contestuali ----
  const paneMenu = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      e.preventDefault();
      const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const s = useFlowStore.getState();
      const items: MenuItem[] = [
        { label: "Annulla", icon: <Undo2 size={14} />, shortcut: "⌘Z", disabled: !s.past.length, onClick: () => s.undo() },
        { label: "Ripristina", icon: <Redo2 size={14} />, shortcut: "⇧⌘Z", disabled: !s.future.length, onClick: () => s.redo() },
        { label: "", separator: true },
        ...BLOCKS.map((b) => ({
          label: `Aggiungi ${b.label}`,
          icon: b.icon,
          onClick: () => addNode(b.kind, flowPos),
        })),
        { label: "", separator: true },
        {
          label: "Incolla",
          icon: <ClipboardPaste size={14} />,
          shortcut: "⌘V",
          disabled: !s.clipboard,
          onClick: () => s.pasteClipboard(flowPos),
        },
        { label: "Seleziona tutto", icon: <BoxSelect size={14} />, shortcut: "⌘A", onClick: () => s.selectAll() },
        { label: "Centra la vista", icon: <Crosshair size={14} />, onClick: () => fitView({ padding: 0.25, duration: 300 }) },
      ];
      setMenu({ x: e.clientX, y: e.clientY, items });
    },
    [screenToFlowPosition, addNode, fitView]
  );

  const nodeMenu = useCallback((e: React.MouseEvent, node: Node) => {
    e.preventDefault();
    e.stopPropagation();
    const s = useFlowStore.getState();
    // se il nodo non è già in una multiselezione, lavora solo su di lui
    const sel = s.selectedIds();
    const ids = sel.includes(node.id) && sel.length > 1 ? sel : [node.id];
    const items: MenuItem[] = [
      { label: ids.length > 1 ? `Copia (${ids.length})` : "Copia", icon: <Copy size={14} />, shortcut: "⌘C", onClick: () => s.copyNodes(ids) },
      { label: "Duplica", icon: <CopyPlus size={14} />, shortcut: "⌘D", onClick: () => s.duplicateNodes(ids) },
      { label: "", separator: true },
      { label: "Elimina", icon: <Trash2 size={14} />, shortcut: "⌫", danger: true, onClick: () => s.deleteNodes(ids) },
    ];
    setMenu({ x: e.clientX, y: e.clientY, items });
  }, []);

  const edgeMenu = useCallback((e: React.MouseEvent, edge: Edge) => {
    e.preventDefault();
    e.stopPropagation();
    const items: MenuItem[] = [
      {
        label: "Elimina collegamento",
        icon: <Scissors size={14} />,
        danger: true,
        onClick: () => useFlowStore.getState().deleteEdge(edge.id),
      },
    ];
    setMenu({ x: e.clientX, y: e.clientY, items });
  }, []);

  return (
    <div
      className="h-full w-full outline-none"
      onMouseMove={(e) => (mouse.current = { x: e.clientX, y: e.clientY })}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={() => setConnecting(true)}
        onConnectEnd={() => setConnecting(false)}
        onNodeDragStart={() => useFlowStore.getState().commit()}
        isValidConnection={isValidConnection}
        onSelectionChange={({ nodes }) => setSelected(nodes[0]?.id ?? null)}
        onPaneContextMenu={paneMenu}
        onNodeContextMenu={nodeMenu}
        onEdgeContextMenu={edgeMenu}
        onDrop={onDrop}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }}
        className={connecting ? "is-connecting" : undefined}
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
        deleteKeyCode={null}
        selectionKeyCode="Shift"
        multiSelectionKeyCode={["Meta", "Shift"]}
        proOptions={{ hideAttribution: true }}
        minZoom={0.15}
        connectionRadius={48}
        defaultEdgeOptions={{ type: "bezier" }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#222226" />
        <Controls position="bottom-left" showInteractive={false} />
        <Panel position="top-left">
          <BlockPalette />
        </Panel>
      </ReactFlow>
      <ContextMenu menu={menu} onClose={() => setMenu(null)} />
    </div>
  );
}

export function Flow() {
  return (
    <ReactFlowProvider>
      <FlowInner />
    </ReactFlowProvider>
  );
}
