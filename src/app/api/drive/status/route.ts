import { NextResponse } from "next/server";
import { driveConnected, driveCredsPresent } from "@/lib/drive";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ connected: driveConnected(), credsPresent: driveCredsPresent() });
}
