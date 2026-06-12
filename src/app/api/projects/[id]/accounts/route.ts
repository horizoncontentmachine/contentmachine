import { NextResponse } from "next/server";
import { listAccounts, getAccount, createAccount, updateAccount, removeAccount } from "@/lib/db";
import { getPublisher } from "@/lib/publish";
import type { Platform, SocialAccount } from "@/lib/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const publisher = await getPublisher();
  return NextResponse.json({ providerConfigured: !!publisher, accounts: await listAccounts(id) });
}

export async function POST(req: Request, { params }: Ctx) {
  const { id: projectId } = await params;
  const body = await req.json().catch(() => ({}));
  const publisher = await getPublisher();
  if (!publisher) {
    return NextResponse.json({ error: "Collega prima Upload-Post in Impostazioni" }, { status: 400 });
  }

  try {
    if (body.action === "connect") {
      const platform = body.platform as Platform;
      if (!["instagram", "tiktok", "x"].includes(platform)) {
        return NextResponse.json({ error: "Piattaforma non valida" }, { status: 400 });
      }
      const accId = crypto.randomUUID().slice(0, 8);
      const profile = `cm_${projectId}_${accId}`;
      const acc: SocialAccount = { id: accId, projectId, platform, providerProfile: profile, status: "pending" };
      await createAccount(acc);
      await publisher.ensureProfile(profile);
      const origin = new URL(req.url).origin;
      const redirect = `${origin}/project/${projectId}?tab=account&account=${accId}`;
      const url = await publisher.connectUrl(profile, redirect, [platform]);
      return NextResponse.json({ url, accountId: accId });
    }

    if (body.action === "sync") {
      const profiles = await publisher.getProfiles();
      const accounts = await listAccounts(projectId);
      const targets = body.accountId ? accounts.filter((a) => a.id === body.accountId) : accounts;
      for (const a of targets) {
        const prof = profiles.find((p) => p.username === a.providerProfile);
        const conn = prof?.connected.find((c) => c.platform === a.platform);
        if (conn) {
          await updateAccount(a.id, { status: "connected", handle: conn.handle, connectedAt: new Date().toISOString() });
        }
      }
      return NextResponse.json({ accounts: await listAccounts(projectId) });
    }

    if (body.action === "disconnect" && body.accountId) {
      const a = await getAccount(body.accountId);
      if (a && a.projectId === projectId) await removeAccount(a.id);
      return NextResponse.json({ accounts: await listAccounts(projectId) });
    }

    return NextResponse.json({ error: "Azione non valida" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
