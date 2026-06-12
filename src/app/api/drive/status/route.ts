import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Drive rimandato sulla versione cloud (verrà rifatto via REST).
export async function GET() {
  return NextResponse.json({ connected: false, credsPresent: false, comingSoon: true });
}
