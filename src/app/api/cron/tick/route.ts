import { NextResponse } from "next/server";
import { getDuePosts, updatePostStatus, requeueStuck } from "@/lib/db";
import { runScheduledPost } from "@/lib/publish/run";
import { refreshMetrics } from "@/lib/metrics";
import { cfEnv } from "@/lib/cf";

export const runtime = "nodejs";
export const maxDuration = 300;

// Chiamato dal cron worker ogni pochi minuti. Pubblica i post programmati ormai dovuti.
// Protetto da segreto (CRON_SECRET): è escluso dal gate password nel middleware.
async function handle(req: Request) {
  const secret = (await cfEnv()).CRON_SECRET;
  const given = req.headers.get("x-cron-secret") || new URL(req.url).searchParams.get("secret");
  if (secret && given !== secret) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const now = new Date().toISOString();
  // recupera i post bloccati in "publishing" da oltre 15 minuti (crash a metà)
  await requeueStuck(new Date(Date.now() - 15 * 60 * 1000).toISOString());
  const due = await getDuePosts(now);
  const out: { id: string; status: string }[] = [];

  for (const post of due) {
    await updatePostStatus(post.id, "publishing");
    try {
      const r = await runScheduledPost(post);
      out.push({ id: post.id, status: r.status });
    } catch (e) {
      await updatePostStatus(post.id, "failed", String(e));
      out.push({ id: post.id, status: "failed" });
    }
  }

  // aggiorna le metriche analytics (throttled internamente)
  let metrics = { posts: 0, profiles: 0 };
  try {
    metrics = await refreshMetrics();
  } catch {
    /* non bloccare il cron per gli analytics */
  }

  return NextResponse.json({ processed: out.length, results: out, metrics, at: now });
}

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}
