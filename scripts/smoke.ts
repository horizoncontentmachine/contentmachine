// Smoke test della pipeline locale (zero AI): asset → overlay → flatten → export PNG → varianti.
// Esegui con: node node_modules/tsx/dist/cli.mjs scripts/smoke.ts
import path from "path";
import sharp from "sharp";
import { ensureDirs } from "../src/lib/paths";
import { storeAsset } from "../src/lib/assets";
import { renderOverlayPng } from "../src/lib/flatten";
import { DEFAULT_OVERLAY, type SlideInput } from "../src/lib/types";
import { expandVariants } from "../src/lib/variants";
import { exportCarouselPngs, newBatchDir } from "../src/lib/exporter";

async function dummyImage(r: number, g: number, b: number): Promise<Buffer> {
  return sharp({ create: { width: 1024, height: 1536, channels: 3, background: { r, g, b } } })
    .png()
    .toBuffer();
}

async function main() {
  ensureDirs();

  const a1 = await storeAsset({ key: "smoke_hook", kind: "image", buf: await dummyImage(30, 70, 140), ext: "png", costCents: 0 });
  await storeAsset({ key: "smoke_body1", kind: "image", buf: await dummyImage(140, 60, 30), ext: "png", costCents: 0 });
  await storeAsset({ key: "smoke_body2", kind: "image", buf: await dummyImage(40, 120, 60), ext: "png", costCents: 0 });
  const meta = await sharp(path.join(process.cwd(), "data/assets/files", a1.normFile!)).metadata();
  if (meta.width !== 1080 || meta.height !== 1920) throw new Error(`normalizzazione errata: ${meta.width}x${meta.height}`);
  console.log("✓ asset + normalizzazione 1080x1920");

  const ovl = await renderOverlayPng({ ...DEFAULT_OVERLAY, text: "QUESTO HOOK SPACCA\nDAVVERO TANTO" });
  if (!ovl) throw new Error("overlay nullo");
  const stats = await sharp(ovl).stats();
  const alphaMax = stats.channels[3]?.max ?? 0;
  if (alphaMax < 200) throw new Error(`overlay vuoto, alpha max ${alphaMax}`);
  console.log("✓ overlay SVG→PNG renderizzato");

  const slides: SlideInput[] = [
    { role: "HOOK", assetKey: "smoke_hook", overlay: { ...DEFAULT_OVERLAY, text: "POV: IL TUO PRIMO HOOK" } },
    { role: "BODY", assetKey: "smoke_body1", overlay: null },
    { role: "BODY", assetKey: "smoke_body2", overlay: { ...DEFAULT_OVERLAY, text: "slide due", yPct: 80, fontSizePx: 44 } },
  ];
  const dir = newBatchDir("smoketest", "carousel");
  const files = await exportCarouselPngs(slides, dir);
  console.log("✓ export carosello:", files.map((f) => path.basename(f)).join(", "));

  const vars = expandVariants(slides, {
    hookTexts: ["HOOK ALTERNATIVO A", "HOOK ALTERNATIVO B"],
    shuffleBody: true,
    lockedBodyIndexes: [],
    maxVariants: 4,
    seed: 7,
  });
  if (vars.length < 2) throw new Error("varianti insufficienti");
  console.log("✓ varianti:", vars.map((v) => v.name).join(" | "));
  console.log("\nPNG di verifica visiva:", files[0]);
}

main().catch((e) => {
  console.error("✗ SMOKE FAIL:", e);
  process.exit(1);
});
