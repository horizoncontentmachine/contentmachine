import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // su Workers niente sharp/archiver: la lavorazione immagini e gli zip
  // avvengono nel browser (canvas + fflate). Tenuti fuori dal bundle del Worker.
  outputFileTracingExcludes: {
    "*": ["./node_modules/sharp/**", "./node_modules/@img/**"],
  },
};

export default nextConfig;

// abilita i binding Cloudflare (D1/KV) anche in `next dev`
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
