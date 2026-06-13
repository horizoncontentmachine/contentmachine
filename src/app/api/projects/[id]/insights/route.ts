import { NextResponse } from "next/server";
import { computeInsights } from "@/lib/metrics";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.json(await computeInsights(id));
}
