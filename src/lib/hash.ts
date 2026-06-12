// Hash via Web Crypto (funziona sia su Node che su Cloudflare Workers).

async function sha256Hex(data: string | ArrayBuffer | Uint8Array): Promise<string> {
  const buf =
    typeof data === "string" ? new TextEncoder().encode(data) : data instanceof Uint8Array ? data : new Uint8Array(data);
  const digest = await crypto.subtle.digest("SHA-256", buf as BufferSource);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

// Hash stabile di un oggetto: chiavi ordinate → stesso payload, stessa chiave cache.
export async function stableHash(obj: unknown): Promise<string> {
  return sha256Hex(canonical(obj));
}

export async function bufferHash(buf: ArrayBuffer | Uint8Array): Promise<string> {
  return sha256Hex(buf);
}

function canonical(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`)
    .join(",")}}`;
}
