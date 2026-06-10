import { NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/drive";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.redirect(getAuthUrl());
  } catch (e) {
    const url = new URL("/settings", process.env.APP_URL || "http://localhost:3010");
    url.searchParams.set("drive_error", String(e));
    return NextResponse.redirect(url);
  }
}
