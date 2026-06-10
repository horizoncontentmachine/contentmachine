import type { ImageQuality } from "./costs";
import { resolveOpenAIKey } from "./settings";

const API_BASE = "https://api.openai.com/v1";

export const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
// 2:3 nativo più vicino a 9:16; poi cover-crop a 1080x1920
export const OPENAI_IMAGE_SIZE = "1024x1536";

function apiKey(): string {
  const k = resolveOpenAIKey();
  if (!k) throw new Error("Chiave OpenAI mancante: collegala in Impostazioni o in .env.local");
  return k;
}

export interface GenerateImageArgs {
  prompt: string;
  quality: ImageQuality;
  refs?: Buffer[]; // fino a 16 reference image
}

// Testo→immagine (generations) o testo+reference→immagine (edits, multipart).
export async function generateImage({ prompt, quality, refs = [] }: GenerateImageArgs): Promise<Buffer> {
  let res: Response;
  if (refs.length === 0) {
    res = await fetch(`${API_BASE}/images/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_IMAGE_MODEL,
        prompt,
        size: OPENAI_IMAGE_SIZE,
        quality,
        n: 1,
      }),
    });
  } else {
    const fd = new FormData();
    fd.append("model", OPENAI_IMAGE_MODEL);
    fd.append("prompt", prompt);
    fd.append("size", OPENAI_IMAGE_SIZE);
    fd.append("quality", quality);
    for (let i = 0; i < Math.min(refs.length, 16); i++) {
      fd.append("image[]", new Blob([new Uint8Array(refs[i])], { type: "image/png" }), `ref${i}.png`);
    }
    res = await fetch(`${API_BASE}/images/edits`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey()}` },
      body: fd,
    });
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI ${res.status}: ${body.slice(0, 500)}`);
  }
  const json = (await res.json()) as { data?: { b64_json?: string; url?: string }[] };
  const item = json.data?.[0];
  if (item?.b64_json) return Buffer.from(item.b64_json, "base64");
  if (item?.url) {
    const img = await fetch(item.url);
    return Buffer.from(await img.arrayBuffer());
  }
  throw new Error("Risposta OpenAI senza immagine");
}
