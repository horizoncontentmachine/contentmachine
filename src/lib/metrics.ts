import {
  allPublishedSince,
  allPostMetrics,
  upsertPostMetric,
  listPublishedPosts,
  listPostMetrics,
  getFollowerHistory,
  recordFollowers,
  listProjects,
  listAccounts,
  type PostMetricRow,
} from "./db";
import { getPublisher } from "./publish";
import type { Platform, PostRecord, SlideInput } from "./types";
import { PLATFORM_LABEL } from "./types";

interface AccountResult {
  accountId: string;
  platform: Platform;
  ok: boolean;
  providerPostId?: string;
}

function hookOf(p: PostRecord): string {
  return (p.slides?.find((s) => s.role === "HOOK")?.overlay?.text || p.caption || "").trim();
}
function score(m: { saves: number; shares: number; likes: number; comments: number }): number {
  return m.saves * 2 + m.shares * 2 + m.likes + m.comments;
}

// ---- Refresh (chiamato dal cron, throttled) ----
const REFRESH_MS = 6 * 60 * 60 * 1000; // ri-fetch metrica di un post al massimo ogni 6h
const MAX_POST_FETCH = 12;
const MAX_PROFILE_FETCH = 8;

export async function refreshMetrics(): Promise<{ posts: number; profiles: number }> {
  const publisher = await getPublisher();
  if (!publisher) return { posts: 0, profiles: 0 };

  const since = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString();
  const posts = await allPublishedSince(since);
  const existing = new Map((await allPostMetrics()).map((m) => [`${m.postId}:${m.accountId}`, m]));
  const now = Date.now();

  let pCount = 0;
  for (const post of posts) {
    if (pCount >= MAX_POST_FETCH) break;
    const results = (Array.isArray(post.result) ? post.result : []) as AccountResult[];
    for (const r of results) {
      if (pCount >= MAX_POST_FETCH) break;
      if (!r.ok || !r.providerPostId) continue;
      const prev = existing.get(`${post.id}:${r.accountId}`);
      if (prev?.fetchedAt && now - new Date(prev.fetchedAt).getTime() < REFRESH_MS) continue;
      const stats = await publisher.getPostAnalytics(r.providerPostId, r.platform).catch(() => null);
      if (!stats) continue;
      await upsertPostMetric({
        postId: post.id,
        accountId: r.accountId,
        platform: r.platform,
        requestId: r.providerPostId,
        views: stats.views,
        likes: stats.likes,
        comments: stats.comments,
        shares: stats.shares,
        saves: stats.saves,
        reach: stats.reach,
        postUrl: stats.postUrl ?? null,
        fetchedAt: new Date().toISOString(),
      });
      pCount++;
    }
  }

  // snapshot follower una volta al giorno per account
  const today = new Date().toISOString().slice(0, 10);
  let profCount = 0;
  outer: for (const proj of await listProjects()) {
    const accounts = (await listAccounts(proj.id)).filter((a) => a.status === "connected");
    if (!accounts.length) continue;
    const history = await getFollowerHistory(proj.id);
    const doneToday = new Set(history.filter((h) => h.date === today).map((h) => h.accountId));
    for (const a of accounts) {
      if (profCount >= MAX_PROFILE_FETCH) break outer;
      if (doneToday.has(a.id)) continue;
      const stats = await publisher.getProfileAnalytics(a.providerProfile, [a.platform]).catch(() => []);
      const s = stats.find((x) => x.platform === a.platform);
      if (!s) continue;
      await recordFollowers(a.id, proj.id, a.platform, today, s.followers, s.reach);
      profCount++;
    }
  }

  return { posts: pCount, profiles: profCount };
}

// ---- Calcolo insights per progetto ----

export async function computeInsights(projectId: string) {
  const posts = await listPublishedPosts(projectId);
  const metrics = await listPostMetrics(projectId);
  const followers = await getFollowerHistory(projectId);
  return build(posts, metrics, followers);
}

export async function computeGlobalInsights() {
  const projects = await listProjects();
  let posts: PostRecord[] = [];
  let metrics: PostMetricRow[] = [];
  let followers: Awaited<ReturnType<typeof getFollowerHistory>> = [];
  for (const p of projects) {
    posts = posts.concat(await listPublishedPosts(p.id));
    metrics = metrics.concat(await listPostMetrics(p.id));
    followers = followers.concat(await getFollowerHistory(p.id));
  }
  return build(posts, metrics, followers);
}

function build(posts: PostRecord[], metrics: PostMetricRow[], followers: Awaited<ReturnType<typeof getFollowerHistory>>) {
  const postById = new Map(posts.map((p) => [p.id, p]));
  const hasData = metrics.length > 0 || followers.length > 0;

  // ---- metriche aggregate per post (somma account) ----
  const perPost = new Map<string, { saves: number; shares: number; likes: number; comments: number; reach: number; views: number; url?: string }>();
  for (const m of metrics) {
    const cur = perPost.get(m.postId) ?? { saves: 0, shares: 0, likes: 0, comments: 0, reach: 0, views: 0 };
    cur.saves += m.saves; cur.shares += m.shares; cur.likes += m.likes; cur.comments += m.comments; cur.reach += m.reach; cur.views += m.views;
    if (m.postUrl) cur.url = m.postUrl;
    perPost.set(m.postId, cur);
  }

  // ---- Cosa funziona ----
  const byPlatform: Record<string, { posts: number; saves: number; shares: number; reach: number; sc: number }> = {};
  const byHook: Record<string, { posts: number; sc: number; saves: number }> = {};
  const bySlides: Record<number, { posts: number; sc: number }> = {};
  for (const m of metrics) {
    const post = postById.get(m.postId);
    if (!post) continue;
    const sc = score(m);
    const pl = m.platform;
    (byPlatform[pl] ??= { posts: 0, saves: 0, shares: 0, reach: 0, sc: 0 });
    byPlatform[pl].posts++; byPlatform[pl].saves += m.saves; byPlatform[pl].shares += m.shares; byPlatform[pl].reach += m.reach; byPlatform[pl].sc += sc;
    const h = hookOf(post) || "—";
    (byHook[h] ??= { posts: 0, sc: 0, saves: 0 });
    byHook[h].posts++; byHook[h].sc += sc; byHook[h].saves += m.saves;
    const n = post.slides?.length ?? 0;
    (bySlides[n] ??= { posts: 0, sc: 0 });
    bySlides[n].posts++; bySlides[n].sc += sc;
  }

  const platforms = Object.entries(byPlatform).map(([p, v]) => ({
    platform: p as Platform,
    posts: v.posts,
    avgSaves: v.saves / v.posts,
    avgShares: v.shares / v.posts,
    avgReach: v.reach / v.posts,
    score: v.sc / v.posts,
  })).sort((a, b) => b.score - a.score);

  const hooks = Object.entries(byHook).map(([hook, v]) => ({ hook, posts: v.posts, avgScore: v.sc / v.posts, avgSaves: v.saves / v.posts }))
    .sort((a, b) => b.avgScore - a.avgScore).slice(0, 8);

  const slides = Object.entries(bySlides).map(([n, v]) => ({ count: Number(n), posts: v.posts, avgScore: v.sc / v.posts }))
    .sort((a, b) => b.avgScore - a.avgScore);

  // ---- consigli (solo con dati sufficienti) ----
  const tips: string[] = [];
  if (metrics.length >= 4) {
    if (platforms.length >= 2 && platforms[0].score > platforms[1].score * 1.3) {
      tips.push(`${PLATFORM_LABEL[platforms[0].platform]} rende meglio: concentra qui più contenuti.`);
    }
    if (hooks.length >= 2 && hooks[0].posts >= 2) {
      tips.push(`L'hook "${hooks[0].hook.slice(0, 40)}…" è il più efficace finora.`);
    }
    if (slides.length >= 2 && slides[0].posts >= 2) {
      tips.push(`I caroselli da ${slides[0].count} slide performano meglio.`);
    }
  }

  // ---- Top post ----
  const topPosts = posts
    .map((p) => {
      const m = perPost.get(p.id);
      if (!m) return null;
      return {
        postId: p.id,
        hook: hookOf(p),
        platforms: p.platforms,
        date: p.createdAt,
        slides: (p.slides ?? []).slice(0, 6) as SlideInput[],
        saves: m.saves, shares: m.shares, likes: m.likes, reach: m.reach, views: m.views, url: m.url,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b!.saves + b!.shares - (a!.saves + a!.shares))
    .slice(0, 10);

  // ---- Crescita (follower totali per data) ----
  const byDate = new Map<string, number>();
  const latestByAccount = new Map<string, number>();
  const platTotals: Record<string, number> = {};
  for (const f of followers) {
    byDate.set(f.date, (byDate.get(f.date) ?? 0) + f.followers);
    latestByAccount.set(f.accountId, f.followers); // followers ordinati per data → ultimo vince
    platTotals[f.platform] = (platTotals[f.platform] ?? 0) + 0; // placeholder
  }
  const series = [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, followers]) => ({ date, followers }));
  const currentFollowers = [...latestByAccount.values()].reduce((a, b) => a + b, 0);
  const delta7 = series.length >= 2 ? series[series.length - 1].followers - series[Math.max(0, series.length - 8)].followers : 0;

  return {
    hasData,
    totals: {
      posts: posts.length,
      reach: [...perPost.values()].reduce((a, m) => a + m.reach, 0),
      followers: currentFollowers,
    },
    cosaFunziona: { platforms, hooks, slides, tips },
    crescita: { series, currentFollowers, delta7 },
    topPosts,
  };
}

export type Insights = Awaited<ReturnType<typeof computeInsights>>;
