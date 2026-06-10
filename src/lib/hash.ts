import crypto from "crypto";

// Hash stabile di un oggetto: chiavi ordinate, così lo stesso payload dà sempre la stessa chiave cache.
export function stableHash(obj: unknown): string {
  return crypto.createHash("sha256").update(canonical(obj)).digest("hex").slice(0, 32);
}

export function bufferHash(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex").slice(0, 32);
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
