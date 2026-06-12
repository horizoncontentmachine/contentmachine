import { NextResponse } from "next/server";
import { computeUsage } from "@/lib/settings";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(await computeUsage());
}
