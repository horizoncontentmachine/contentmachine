import { NextResponse } from "next/server";
import { getSettings, saveSettings } from "@/lib/db";
import { maskKey, openAIKeySource, resolveOpenAIKey } from "@/lib/settings";
import type { TopUp } from "@/lib/types";

export const runtime = "nodejs";

async function publicView() {
  const s = await getSettings();
  return {
    openai: {
      source: await openAIKeySource(),
      configured: !!(await resolveOpenAIKey()),
      masked: maskKey(await resolveOpenAIKey()),
    },
    topups: s.topups,
    topupCents: s.topups.reduce((a, t) => a + t.cents, 0),
    // Google Drive rimandato sulla versione cloud
    drive: { credsPresent: false, connected: false, connectedEmail: null, rootFolderName: "ShortFlow", redirectUri: "", comingSoon: true },
  };
}

export async function GET() {
  return NextResponse.json(await publicView());
}

export async function POST(req: Request) {
  const body = await req.json();
  const s = await getSettings();

  if (typeof body.openaiKey === "string" && body.openaiKey.trim()) {
    await saveSettings({ openaiKey: body.openaiKey.trim() });
  }
  if (body.clearOpenaiKey) {
    await saveSettings({ openaiKey: undefined });
  }
  if (typeof body.addTopupCents === "number" && body.addTopupCents > 0) {
    const t: TopUp = { cents: Math.round(body.addTopupCents), at: new Date().toISOString(), note: body.topupNote };
    await saveSettings({ topups: [t, ...s.topups] });
  }
  if (typeof body.removeTopupAt === "string") {
    await saveSettings({ topups: s.topups.filter((t) => t.at !== body.removeTopupAt) });
  }

  return NextResponse.json(await publicView());
}
