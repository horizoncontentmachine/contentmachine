import { NextResponse } from "next/server";
import { duoplusCall, duoplusConfigured, DUOPLUS_ACTIONS, DUOPLUS_COSTLY } from "@/lib/duoplus";

export const runtime = "nodejs";
export const maxDuration = 60;

// Proxy unico verso DuoPlus: la chiave resta server-side, solo azioni in whitelist,
// quelle a pagamento richiedono { confirm: true }.
export async function GET() {
  return NextResponse.json({ configured: await duoplusConfigured() });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    const path = DUOPLUS_ACTIONS[action];
    if (!path) return NextResponse.json({ error: "Azione non valida" }, { status: 400 });

    if (DUOPLUS_COSTLY.has(action) && body.confirm !== true) {
      return NextResponse.json({ error: "Azione a pagamento: conferma richiesta", costly: true }, { status: 400 });
    }

    const params = (body.params && typeof body.params === "object" ? body.params : {}) as Record<string, unknown>;
    const r = await duoplusCall(path, params);
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
