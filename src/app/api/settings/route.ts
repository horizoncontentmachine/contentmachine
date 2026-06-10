import { NextResponse } from "next/server";
import { getSettings, saveSettings } from "@/lib/db";
import { maskKey, openAIKeySource, resolveOpenAIKey } from "@/lib/settings";
import { driveConnected, driveCredsPresent, redirectUri } from "@/lib/drive";
import type { TopUp } from "@/lib/types";

export const runtime = "nodejs";

// Vista "sicura": niente chiavi/secret in chiaro verso il browser.
function publicView() {
  const s = getSettings();
  return {
    openai: {
      source: openAIKeySource(),
      configured: !!resolveOpenAIKey(),
      masked: maskKey(resolveOpenAIKey()),
    },
    topups: s.topups,
    topupCents: s.topups.reduce((a, t) => a + t.cents, 0),
    drive: {
      credsPresent: driveCredsPresent(),
      connected: driveConnected(),
      connectedEmail: s.drive.connectedEmail ?? null,
      rootFolderName: s.drive.rootFolderName || "ShortFlow",
      redirectUri: redirectUri(),
    },
  };
}

export async function GET() {
  return NextResponse.json(publicView());
}

export async function POST(req: Request) {
  const body = await req.json();
  const s = getSettings();

  if (typeof body.openaiKey === "string" && body.openaiKey.trim()) {
    saveSettings({ openaiKey: body.openaiKey.trim() });
  }
  if (body.clearOpenaiKey) {
    saveSettings({ openaiKey: undefined });
  }
  if (typeof body.addTopupCents === "number" && body.addTopupCents > 0) {
    const t: TopUp = { cents: Math.round(body.addTopupCents), at: new Date().toISOString(), note: body.topupNote };
    saveSettings({ topups: [t, ...s.topups] });
  }
  if (typeof body.removeTopupAt === "string") {
    saveSettings({ topups: s.topups.filter((t) => t.at !== body.removeTopupAt) });
  }
  if (body.drive) {
    saveSettings({
      drive: {
        ...s.drive,
        ...(typeof body.drive.clientId === "string" ? { clientId: body.drive.clientId.trim() || undefined } : {}),
        ...(typeof body.drive.clientSecret === "string" ? { clientSecret: body.drive.clientSecret.trim() || undefined } : {}),
        ...(typeof body.drive.rootFolderName === "string" ? { rootFolderName: body.drive.rootFolderName.trim() || "ShortFlow" } : {}),
      },
    });
  }

  return NextResponse.json(publicView());
}
