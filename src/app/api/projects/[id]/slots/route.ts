import { NextResponse } from "next/server";
import { getSlots, saveSlots } from "@/lib/db";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const slots = (await getSlots(id)) ?? { days: [1, 2, 3, 4, 5], times: ["09:00", "13:00", "19:00"] };
  return NextResponse.json(slots);
}

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const days: number[] = Array.isArray(body.days) ? body.days.filter((d: number) => d >= 0 && d <= 6) : [];
  const times: string[] = Array.isArray(body.times) ? body.times.filter((t: string) => /^\d{2}:\d{2}$/.test(t)) : [];
  if (!days.length || !times.length) {
    return NextResponse.json({ error: "Scegli almeno un giorno e un orario" }, { status: 400 });
  }
  await saveSlots(id, days, times, body.timezone);
  return NextResponse.json({ ok: true, days, times });
}
