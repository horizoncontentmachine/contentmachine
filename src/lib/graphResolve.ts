import type { Edge, Node } from "@xyflow/react";
import type { OverlaySpec, SlideInput } from "./types";
import { activeResult, type CarouselData, type ImageGenData, type OverlayData, type PromptData, type UploadData } from "./nodeData";

// Risoluzione client-side del grafo: cammina sugli edge e produce i payload
// (assetKey + overlay) che il server usa per export. Nessuna AI coinvolta.

export interface ResolvedOutput {
  assetKey: string;
  overlay: OverlaySpec | null;
}

export function findInputNode(
  nodes: Node[],
  edges: Edge[],
  nodeId: string,
  handleId: string
): Node | undefined {
  const e = edges.find((e) => e.target === nodeId && (e.targetHandle ?? "in") === handleId);
  return e ? nodes.find((n) => n.id === e.source) : undefined;
}

export function findInputNodes(nodes: Node[], edges: Edge[], nodeId: string, handleId: string): Node[] {
  return edges
    .filter((e) => e.target === nodeId && (e.targetHandle ?? "in") === handleId)
    .map((e) => nodes.find((n) => n.id === e.source))
    .filter((n): n is Node => !!n);
}

// Cosa "trasporta" l'output di un nodo (con passthrough dell'overlay dal blocco Testo).
export function nodeOutput(nodes: Node[], edges: Edge[], node: Node): ResolvedOutput | null {
  switch (node.type) {
    case "imageGen": {
      const r = activeResult(node.data as ImageGenData);
      return r ? { assetKey: r.key, overlay: null } : null;
    }
    case "upload": {
      const r = (node.data as UploadData).result;
      return r ? { assetKey: r.key, overlay: null } : null;
    }
    case "overlay": {
      const input = findInputNode(nodes, edges, node.id, "in");
      const out = input ? nodeOutput(nodes, edges, input) : null;
      if (!out) return null;
      return { ...out, overlay: (node.data as OverlayData).overlay };
    }
    default:
      return null;
  }
}

// Testo del blocco Prompt collegato all'ingresso "prompt" di un blocco Immagine.
export function resolvePrompt(nodes: Node[], edges: Edge[], imageNodeId: string): string {
  const p = findInputNode(nodes, edges, imageNodeId, "prompt");
  if (!p || p.type !== "prompt") return "";
  return ((p.data as PromptData).text ?? "").trim();
}

export function collectRefKeys(nodes: Node[], edges: Edge[], nodeId: string): string[] {
  return findInputNodes(nodes, edges, nodeId, "ref")
    .map((n) => nodeOutput(nodes, edges, n))
    .filter((o): o is ResolvedOutput => !!o)
    .map((o) => o.assetKey);
}

export interface CollectedSlides {
  slides: SlideInput[];
  missing: string[]; // descrizioni umane degli slot non pronti
}

// Slot del carosello → lista slide ordinata HOOK, BODY×N, CTA (CTA opzionale).
export function collectSlides(nodes: Node[], edges: Edge[], container: Node): CollectedSlides {
  const data = container.data as CarouselData;
  const slides: SlideInput[] = [];
  const missing: string[] = [];

  const push = (handle: string, role: SlideInput["role"], label: string) => {
    const src = findInputNode(nodes, edges, container.id, handle);
    const out = src ? nodeOutput(nodes, edges, src) : null;
    if (!out) {
      missing.push(`${label}: ${src ? "immagine non ancora generata" : "non collegato"}`);
      return;
    }
    slides.push({ role, assetKey: out.assetKey, overlay: out.overlay });
  };

  push("hook", "HOOK", "Hook");
  for (let i = 0; i < (data.bodyCount ?? 0); i++) {
    push(`body-${i}`, "BODY", `Slide ${i + 1}`);
  }
  // CTA opzionale: segnala solo se collegata ma non pronta
  const ctaEdge = edges.find((e) => e.target === container.id && e.targetHandle === "cta");
  if (ctaEdge) push("cta", "CTA", "CTA");

  return { slides, missing };
}
