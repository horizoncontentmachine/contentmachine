import { NextResponse } from "next/server";
import { computeGlobalInsights } from "@/lib/metrics";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  return NextResponse.json(await computeGlobalInsights());
}
