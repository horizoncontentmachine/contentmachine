import type { SlideInput, VariantOptions } from "./types";

// Espansione varianti: nessuna chiamata AI, solo ricombinazione di testo hook + ordine BODY.
// PRNG seedato → stesse opzioni = stesse varianti (riproducibile).

export interface VariantDef {
  name: string;
  slides: SlideInput[];
}

export function expandVariants(base: SlideInput[], opts: VariantOptions): VariantDef[] {
  const hookTexts = opts.hookTexts.map((t) => t.trim()).filter(Boolean);
  if (!hookTexts.length) {
    const hook = base.find((s) => s.role === "HOOK");
    hookTexts.push(hook?.overlay?.text ?? "");
  }

  const bodyIdx = base
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.role === "BODY")
    .map(({ i }) => i);

  const orders: number[][] = [bodyIdx];
  if (opts.shuffleBody && bodyIdx.length > 1) {
    const rng = mulberry32(opts.seed || 42);
    const movable = bodyIdx.filter((_, k) => !opts.lockedBodyIndexes.includes(k));
    const seen = new Set([bodyIdx.join(",")]);
    // genera abbastanza permutazioni distinte da coprire maxVariants
    for (let tries = 0; tries < 200 && orders.length < opts.maxVariants; tries++) {
      const shuffled = [...movable];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      let m = 0;
      const order = bodyIdx.map((orig, k) =>
        opts.lockedBodyIndexes.includes(k) ? orig : shuffled[m++]
      );
      const sig = order.join(",");
      if (!seen.has(sig)) {
        seen.add(sig);
        orders.push(order);
      }
    }
  }

  const out: VariantDef[] = [];
  let v = 0;
  outer: for (const order of orders) {
    for (const hookText of hookTexts) {
      if (out.length >= opts.maxVariants) break outer;
      v++;
      const slides = reorderBodies(base, bodyIdx, order).map((s) =>
        s.role === "HOOK" && s.overlay
          ? { ...s, overlay: { ...s.overlay, text: hookText } }
          : s
      );
      out.push({ name: `v${String(v).padStart(2, "0")}_${slug(hookText)}`, slides });
    }
  }
  return out;
}

function reorderBodies(base: SlideInput[], bodyIdx: number[], order: number[]): SlideInput[] {
  const copy = [...base];
  bodyIdx.forEach((pos, k) => {
    copy[pos] = base[order[k]];
  });
  return copy;
}

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "variant"
  );
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
