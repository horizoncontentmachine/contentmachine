import { NextResponse } from "next/server";
import { listAccounts, syncAccounts, removeAccount } from "@/lib/db";
import { getPublisher } from "@/lib/publish";
import type { Platform } from "@/lib/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const publisher = await getPublisher();
  return NextResponse.json({ providerConfigured: !!publisher, connected: await listAccounts(id) });
}

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const publisher = await getPublisher();
  if (!publisher) {
    return NextResponse.json({ error: "Collega prima Upload-Post in Impostazioni" }, { status: 400 });
  }

  try {
    if (body.action === "connect") {
      const platform = body.platform as Platform | undefined;
      const origin = new URL(req.url).origin;
      const redirect = `${origin}/project/${id}?tab=account&connected=1`;
      const url = await publisher.connectUrl(id, redirect, platform ? [platform] : undefined);
      return NextResponse.json({ url });
    }

    if (body.action === "sync") {
      const conns = await publisher.listConnections(id);
      const handles: Partial<Record<Platform, string>> = {};
      conns.forEach((c) => c.handle && (handles[c.platform] = c.handle));
      await syncAccounts(id, conns.map((c) => c.platform), handles);
      return NextResponse.json({ connected: await listAccounts(id) });
    }

    if (body.action === "disconnect" && body.platform) {
      await removeAccount(id, body.platform as Platform);
      return NextResponse.json({ connected: await listAccounts(id) });
    }

    return NextResponse.json({ error: "Azione non valida" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
