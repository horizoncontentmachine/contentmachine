import { NextResponse } from "next/server";
import { exchangeCode, appBaseUrl } from "@/lib/drive";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get("code");
  const dest = new URL("/settings", appBaseUrl());
  if (!code) {
    dest.searchParams.set("drive_error", "Nessun code ricevuto da Google");
    return NextResponse.redirect(dest);
  }
  try {
    const email = await exchangeCode(code);
    dest.searchParams.set("drive_ok", email || "1");
  } catch (e) {
    dest.searchParams.set("drive_error", String(e));
  }
  return NextResponse.redirect(dest);
}
