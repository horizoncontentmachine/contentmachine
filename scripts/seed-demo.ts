// Seed di un progetto dimostrativo COMPLETO con immagini fittizie, così la canvas e la
// Output board sono visibili senza API key. Esegui: node node_modules/tsx/dist/cli.mjs scripts/seed-demo.ts
import sharp from "sharp";
import { ensureDirs } from "../src/lib/paths";
import { storeAsset } from "../src/lib/assets";
import { saveProject, createProject } from "../src/lib/db";

async function swatch(hex: string): Promise<Buffer> {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return sharp({ create: { width: 1024, height: 1536, channels: 3, background: { r, g, b } } }).png().toBuffer();
}

async function main() {
  ensureDirs();
  const colors = ["#8a6f5c", "#5c6f8a", "#6f8a5c", "#7a5c8a"];
  const keys: string[] = [];
  for (let i = 0; i < colors.length; i++) {
    const k = `demo_img_${i}`;
    await storeAsset({ key: k, kind: "image", buf: await swatch(colors[i]), ext: "png", costCents: 0 });
    keys.push(k);
  }

  const ov = (text: string) => ({
    text,
    fontSizePx: 58,
    yPct: 14,
    barOpacity: 0.72,
    textColor: "#FFFFFF",
    barColor: "#000000",
    maxWidthPct: 84,
  });
  const r = (key: string) => ({ results: [{ key, kind: "image" }], activeIndex: 0 });

  const p = createProject("Demo completa — caroselli", "wellness");
  p.graph = {
    nodes: [
      { id: "g1", type: "imageGen", position: { x: -40, y: -80 }, data: { n: 1, quality: "low", ...r(keys[0]) } },
      { id: "g2", type: "imageGen", position: { x: -40, y: 380 }, data: { n: 2, quality: "low", ...r(keys[1]) } },
      { id: "g3", type: "imageGen", position: { x: -40, y: 840 }, data: { n: 3, quality: "low", ...r(keys[2]) } },
      { id: "t1", type: "overlay", position: { x: 300, y: -60 }, data: { n: 1, overlay: ov("POV: LA TUA COLAZIONE DA 10 MINUTI") } },
      { id: "c1", type: "carousel", position: { x: 640, y: 120 }, data: { n: 1, bodyCount: 2, lastExport: null } },
      {
        id: "v1",
        type: "variants",
        position: { x: 1000, y: 160 },
        data: {
          n: 1,
          hookTexts: "POV: LA TUA COLAZIONE DA 10 MINUTI\n3 COLAZIONI CHE TI SVOLTANO LA MATTINA\nNESSUNO TE LO DICE MA LA COLAZIONE CONTA",
          shuffleBody: true,
          locked: "",
          maxVariants: 6,
          seed: 42,
          lastExport: null,
        },
      },
    ],
    edges: [
      { id: "e4", source: "g1", sourceHandle: "out", target: "t1", targetHandle: "in" },
      { id: "e5", source: "t1", sourceHandle: "out", target: "c1", targetHandle: "hook" },
      { id: "e6", source: "g2", sourceHandle: "out", target: "c1", targetHandle: "body-0" },
      { id: "e7", source: "g3", sourceHandle: "out", target: "c1", targetHandle: "body-1" },
      { id: "e8", source: "c1", sourceHandle: "out", target: "v1", targetHandle: "in" },
    ],
  };
  saveProject(p);
  console.log("Progetto demo:", p.id, "→ /project/" + p.id);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
