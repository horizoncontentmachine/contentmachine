import type { Edge, Node } from "@xyflow/react";
import { collectSlides } from "./graphResolve";
import { expandVariants } from "./variants";
import type { SlideInput, VariantOptions } from "./types";
import type { CarouselData, VariantsData } from "./nodeData";

// Costruisce, lato client e a costo zero, l'elenco delle sequenze complete con le loro
// varianti — la stessa logica del server, così la Output board mostra esattamente ciò che
// verrebbe esportato.

export interface OutputGroup {
  label: string; // es. "C1.0"
  slides: SlideInput[];
}

export interface OutputSequence {
  carouselId: string;
  carouselN: number;
  variantsNodeId?: string;
  options?: VariantOptions;
  groups: OutputGroup[];
}

function variantOptions(d: VariantsData): VariantOptions {
  return {
    hookTexts: d.hookTexts.split("\n").map((s) => s.trim()).filter(Boolean),
    shuffleBody: d.shuffleBody,
    lockedBodyIndexes: d.locked
      .split(",")
      .map((s) => parseInt(s.trim(), 10) - 1)
      .filter((x) => !isNaN(x) && x >= 0),
    maxVariants: Math.min(Number(d.maxVariants) || 10, 100),
    seed: Number(d.seed) || 42,
  };
}

export function buildOutputs(nodes: Node[], edges: Edge[]): OutputSequence[] {
  const out: OutputSequence[] = [];

  for (const node of nodes.filter((n) => n.type === "carousel")) {
    const { slides, missing } = collectSlides(nodes, edges, node);
    if (!slides.find((s) => s.role === "HOOK") || missing.length > 0) continue;

    const cN = Number((node.data as CarouselData).n) || 1;
    const vEdge = edges.find(
      (e) => e.source === node.id && nodes.find((n) => n.id === e.target)?.type === "variants"
    );
    const vNode = vEdge ? nodes.find((n) => n.id === vEdge.target) : undefined;

    let groups: OutputGroup[];
    let options: VariantOptions | undefined;
    if (vNode) {
      options = variantOptions(vNode.data as VariantsData);
      groups = expandVariants(slides, options).map((v, i) => ({ label: `C${cN}.${i}`, slides: v.slides }));
    } else {
      groups = [{ label: `C${cN}`, slides }];
    }

    out.push({ carouselId: node.id, carouselN: cN, variantsNodeId: vNode?.id, options, groups });
  }

  return out;
}
