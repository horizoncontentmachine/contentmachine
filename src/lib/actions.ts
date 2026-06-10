"use client";

// Azioni condivise tra i blocchi sulla canvas e l'inspector.
// Tutte aggiornano busy/errors nello store, così entrambe le UI restano in sync.

import { useFlowStore } from "@/store/useFlowStore";
import { collectRefKeys, collectSlides, resolvePrompt } from "./graphResolve";
import { postJson } from "./clientApi";
import { activeResult, type ExportInfo, type GenResult, type ImageGenData, type VariantsData } from "./nodeData";

export async function generateImage(nodeId: string) {
  const { nodes, edges, meta, setBusy, setError, updateNodeData, addSpent } = useFlowStore.getState();
  const node = nodes.find((n) => n.id === nodeId);
  if (!node || !meta) return;
  const d = node.data as ImageGenData;

  const prompt = resolvePrompt(nodes, edges, nodeId);
  if (!prompt) {
    setError(nodeId, "Collega un blocco Prompt (con del testo) all'ingresso in alto a sinistra.");
    return;
  }
  const refKeys = collectRefKeys(nodes, edges, nodeId);

  setError(nodeId, null);
  setBusy(nodeId, true);
  try {
    const r = await postJson<{ asset: { key: string }; cacheHit: boolean; costCents: number }>(
      "/api/generate/image",
      { projectId: meta.id, prompt, quality: d.quality, refKeys }
    );
    const existing = d.results.findIndex((x) => x.key === r.asset.key);
    if (existing >= 0) {
      updateNodeData(nodeId, { activeIndex: existing });
    } else {
      const result: GenResult = { key: r.asset.key, kind: "image", costCents: r.costCents, cached: r.cacheHit };
      updateNodeData(nodeId, { results: [...d.results, result], activeIndex: d.results.length });
    }
    if (!r.cacheHit) addSpent(r.costCents);
  } catch (e) {
    setError(nodeId, String(e));
  } finally {
    setBusy(nodeId, false);
  }
}

export async function exportCarousel(nodeId: string) {
  const { nodes, edges, meta, setBusy, setError, updateNodeData } = useFlowStore.getState();
  const node = nodes.find((n) => n.id === nodeId);
  if (!node || !meta) return;

  const { slides, missing } = collectSlides(nodes, edges, node);
  if (!slides.find((s) => s.role === "HOOK")) {
    setError(nodeId, "Manca la slide Hook. " + missing.join(" · "));
    return;
  }
  setError(nodeId, null);
  setBusy(nodeId, true);
  try {
    const r = await postJson<{ zipUrl: string; files: string[] }>("/api/export/carousel", {
      projectId: meta.id,
      name: meta.name,
      slides,
    });
    updateNodeData(nodeId, {
      lastExport: { zipUrl: r.zipUrl, count: r.files.length, at: new Date().toISOString() } satisfies ExportInfo,
    });
  } catch (e) {
    setError(nodeId, String(e));
  } finally {
    setBusy(nodeId, false);
  }
}

export async function runVariants(nodeId: string) {
  const { nodes, edges, meta, setBusy, setError, updateNodeData } = useFlowStore.getState();
  const node = nodes.find((n) => n.id === nodeId);
  if (!node || !meta) return;
  const d = node.data as VariantsData;

  const sourceEdge = edges.find((e) => e.target === nodeId && (e.targetHandle ?? "in") === "in");
  const source = sourceEdge ? nodes.find((n) => n.id === sourceEdge.source) : undefined;
  if (!source) {
    setError(nodeId, "Collega l'uscita di un blocco Carosello.");
    return;
  }
  const { slides, missing } = collectSlides(nodes, edges, source);
  if (!slides.find((s) => s.role === "HOOK")) {
    setError(nodeId, "Il carosello non è completo: " + missing.join(" · "));
    return;
  }
  const hookTexts = d.hookTexts.split("\n").map((s) => s.trim()).filter(Boolean);
  if (hookTexts.length > 0 && !slides.find((s) => s.role === "HOOK")?.overlay) {
    setError(nodeId, "Per cambiare il testo hook, la slide Hook deve passare da un blocco Testo.");
    return;
  }

  setError(nodeId, null);
  setBusy(nodeId, true);
  try {
    const lockedBodyIndexes = d.locked
      .split(",")
      .map((s) => parseInt(s.trim(), 10) - 1)
      .filter((x) => !isNaN(x) && x >= 0);
    const r = await postJson<{ count: number; zipUrl?: string; dirUrl: string }>("/api/export/variants", {
      projectId: meta.id,
      name: meta.name + "_varianti",
      slides,
      options: {
        hookTexts,
        shuffleBody: d.shuffleBody,
        lockedBodyIndexes,
        maxVariants: d.maxVariants,
        seed: d.seed,
      },
    });
    updateNodeData(nodeId, {
      lastExport: { zipUrl: r.zipUrl, dirUrl: r.dirUrl, count: r.count, at: new Date().toISOString() } satisfies ExportInfo,
    });
  } catch (e) {
    setError(nodeId, String(e));
  } finally {
    setBusy(nodeId, false);
  }
}

export { activeResult };
