import type { ImageQuality } from "./costs";
import { resolveOpenAIKey } from "./settings";
import { cfEnv } from "./cf";

const API_BASE = "https://api.openai.com/v1";

export async function imageModel(): Promise<string> {
  return (await cfEnv()).OPENAI_IMAGE_MODEL || "gpt-image-2";
}
export const DEFAULT_IMAGE_SIZE = "1024x1536"; // 2:3 nativo (fallback)

async function apiKey(): Promise<string> {
  const k = await resolveOpenAIKey();
  if (!k) throw new Error("Chiave OpenAI mancante: collegala in Impostazioni");
  return k;
}

export interface GenerateImageArgs {
  prompt: string;
  quality: ImageQuality;
  size?: string; // dimensione nativa di generazione (per formato piattaforma)
  refs?: Uint8Array[]; // fino a 16 reference image
}

// Testo→immagine (generations) o testo+reference→immagine (edits). Ritorna i byte PNG.
export async function generateImage({ prompt, quality, size = DEFAULT_IMAGE_SIZE, refs = [] }: GenerateImageArgs): Promise<Uint8Array> {
  const model = await imageModel();
  const key = await apiKey();
  let res: Response;

  if (refs.length === 0) {
    res = await fetch(`${API_BASE}/images/generations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, size, quality, n: 1 }),
    });
  } else {
    const fd = new FormData();
    fd.append("model", model);
    fd.append("prompt", prompt);
    fd.append("size", size);
    fd.append("quality", quality);
    for (let i = 0; i < Math.min(refs.length, 16); i++) {
      fd.append("image[]", new Blob([refs[i] as BlobPart], { type: "image/png" }), `ref${i}.png`);
    }
    res = await fetch(`${API_BASE}/images/edits`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: fd,
    });
  }

  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 400)}`);
  const json = (await res.json()) as { data?: { b64_json?: string; url?: string }[] };
  const item = json.data?.[0];
  if (item?.b64_json) {
    const bin = atob(item.b64_json);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  if (item?.url) {
    const img = await fetch(item.url);
    return new Uint8Array(await img.arrayBuffer());
  }
  throw new Error("Risposta OpenAI senza immagine");
}
