"use client";

import { useEffect, useState } from "react";
import { BarChart3, Info, Lightbulb, TrendingUp, Trophy } from "lucide-react";
import { getJson } from "@/lib/clientApi";
import { OverlayPreview } from "@/components/OverlayPreview";
import { Sk } from "@/components/Skeleton";
import { PLATFORM_FORMAT } from "@/lib/formats";
import { PLATFORM_LABEL, type Platform, type SlideInput } from "@/lib/types";

const BADGE: Record<Platform, string> = { instagram: "IG", tiktok: "TT", x: "X" };

interface Insights {
  hasData: boolean;
  totals: { posts: number; reach: number; followers: number };
  cosaFunziona: {
    platforms: { platform: Platform; posts: number; avgSaves: number; avgShares: number; avgReach: number; score: number }[];
    hooks: { hook: string; posts: number; avgScore: number; avgSaves: number }[];
    slides: { count: number; posts: number; avgScore: number }[];
    tips: string[];
  };
  crescita: { series: { date: string; followers: number }[]; currentFollowers: number; delta7: number };
  topPosts: { postId: string; hook: string; platforms: Platform[]; date: string; slides: SlideInput[]; saves: number; shares: number; reach: number; likes: number; views: number; url?: string }[];
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return Math.round(n).toString();
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${30 - ((v - min) / range) * 28}`).join(" ");
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-10 w-full">
      <polyline points={pts} fill="none" stroke="#ececef" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function SkeletonInsights({ empty }: { empty: boolean }) {
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-6 py-8">
      {empty && (
        <div className="flex items-center gap-2 rounded-xl border border-[#26262b] bg-[#19191c] px-3.5 py-2.5 text-[11.5px] text-zinc-400">
          <Info size={14} className="shrink-0 text-zinc-500" />
          Ecco come apparirà la dashboard: i dati si popolano qui dopo aver collegato Upload-Post e pubblicato (le metriche arrivano qualche ora dopo).
        </div>
      )}
      {/* totali */}
      <div className="grid grid-cols-3 gap-3">
        {["Follower", "Reach totale", "Post pubblicati"].map((t) => (
          <div key={t} className="rounded-2xl border border-[#26262b] bg-[#19191c] p-4">
            <div className="text-[10px] uppercase tracking-wide text-zinc-600">{t}</div>
            <Sk w={64} h={22} className="mt-1.5" />
          </div>
        ))}
      </div>
      {/* consigli */}
      <Card icon={<Lightbulb size={13} />} title="Consigli">
        <div className="space-y-2">
          <Sk w="90%" h={11} />
          <Sk w="70%" h={11} />
        </div>
      </Card>
      {/* cosa funziona */}
      <Card icon={<BarChart3 size={13} />} title="Cosa funziona">
        <div className="mb-4">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">Per piattaforma</div>
          <div className="space-y-1.5">
            {["IG", "TT", "X"].map((b) => (
              <div key={b} className="flex items-center gap-2">
                <span className="grid h-5 w-7 shrink-0 place-items-center rounded bg-[#2e2e34] text-[8px] font-bold text-zinc-500">{b}</span>
                <Sk h={8} className="flex-1" rounded="rounded-full" />
                <Sk w={90} h={10} />
              </div>
            ))}
          </div>
        </div>
        <div className="mb-4">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">Hook migliori</div>
          <div className="space-y-1.5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <Sk w={`${70 - i * 8}%`} h={11} />
                <Sk w={70} h={9} />
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">N. slide</div>
          <div className="flex flex-wrap gap-1.5">
            {[0, 1, 2].map((i) => (
              <Sk key={i} w={96} h={26} rounded="rounded-lg" />
            ))}
          </div>
        </div>
      </Card>
      {/* crescita */}
      <Card icon={<TrendingUp size={13} />} title="Crescita follower">
        <Sk h={40} className="w-full" />
      </Card>
      {/* top post */}
      <Card icon={<Trophy size={13} />} title="Top post">
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-[#26262b] bg-[#1d1d21] p-2">
              <Sk w={30} h={40} rounded="rounded" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Sk w={`${60 - i * 6}%`} h={11} />
                <Sk w={40} h={8} />
              </div>
              <div className="space-y-1.5 text-right">
                <Sk w={70} h={10} className="ml-auto" />
                <Sk w={90} h={8} className="ml-auto" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#26262b] bg-[#19191c] p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-md border border-[#2e2e34] bg-[#1f1f23] text-zinc-400">{icon}</span>
        <h3 className="text-[13px] font-semibold tracking-tight text-zinc-100">{title}</h3>
      </div>
      {children}
    </section>
  );
}

export function InsightsPanel({ projectId }: { projectId?: string }) {
  const [d, setD] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = projectId ? `/api/projects/${projectId}/insights` : `/api/insights`;
    getJson<Insights>(url)
      .then(setD)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  // Mockup strutturato: le "scatole" che conterranno i dati, prima che esistano.
  if (loading || !d || !d.hasData) return <SkeletonInsights empty={!loading} />;

  const maxScore = Math.max(1, ...d.cosaFunziona.platforms.map((p) => p.score));

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-6 py-8">
      {/* totali */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-[#26262b] bg-[#19191c] p-4">
          <div className="text-[10px] uppercase tracking-wide text-zinc-600">Follower</div>
          <div className="mt-0.5 text-[20px] font-bold text-white">{fmt(d.totals.followers)}</div>
          {d.crescita.delta7 !== 0 && (
            <div className={`text-[11px] ${d.crescita.delta7 > 0 ? "text-emerald-400" : "text-red-400"}`}>
              {d.crescita.delta7 > 0 ? "+" : ""}{fmt(d.crescita.delta7)} / 7g
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-[#26262b] bg-[#19191c] p-4">
          <div className="text-[10px] uppercase tracking-wide text-zinc-600">Reach totale</div>
          <div className="mt-0.5 text-[20px] font-bold text-white">{fmt(d.totals.reach)}</div>
        </div>
        <div className="rounded-2xl border border-[#26262b] bg-[#19191c] p-4">
          <div className="text-[10px] uppercase tracking-wide text-zinc-600">Post pubblicati</div>
          <div className="mt-0.5 text-[20px] font-bold text-white">{d.totals.posts}</div>
        </div>
      </div>

      {/* consigli */}
      {d.cosaFunziona.tips.length > 0 && (
        <Card icon={<Lightbulb size={13} />} title="Consigli">
          <ul className="space-y-1.5">
            {d.cosaFunziona.tips.map((t, i) => (
              <li key={i} className="flex gap-2 text-[12px] leading-relaxed text-zinc-300">
                <span className="text-zinc-600">→</span> {t}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* cosa funziona */}
      <Card icon={<BarChart3 size={13} />} title="Cosa funziona">
        {d.cosaFunziona.platforms.length > 0 && (
          <div className="mb-4">
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">Per piattaforma</div>
            <div className="space-y-1.5">
              {d.cosaFunziona.platforms.map((p) => (
                <div key={p.platform} className="flex items-center gap-2">
                  <span className="grid h-5 w-7 shrink-0 place-items-center rounded bg-[#2e2e34] text-[8px] font-bold text-zinc-300">{BADGE[p.platform]}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#222227]">
                    <div className="h-full rounded-full bg-zinc-300" style={{ width: `${(p.score / maxScore) * 100}%` }} />
                  </div>
                  <span className="w-28 text-right text-[10px] text-zinc-500">{fmt(p.avgSaves)} salv · {fmt(p.avgReach)} reach</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {d.cosaFunziona.hooks.length > 0 && (
          <div className="mb-4">
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">Hook migliori</div>
            <div className="space-y-1">
              {d.cosaFunziona.hooks.slice(0, 5).map((h, i) => (
                <div key={i} className="flex items-center gap-2 text-[11.5px]">
                  <span className="min-w-0 flex-1 truncate text-zinc-300">{h.hook}</span>
                  <span className="shrink-0 text-[10px] text-zinc-500">{fmt(h.avgSaves)} salv · {h.posts} post</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {d.cosaFunziona.slides.length > 0 && (
          <div>
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">N. slide</div>
            <div className="flex flex-wrap gap-1.5">
              {d.cosaFunziona.slides.map((s) => (
                <span key={s.count} className="rounded-lg border border-[#2e2e34] bg-[#202024] px-2.5 py-1 text-[11px] text-zinc-300">
                  {s.count} slide · score {fmt(s.avgScore)}
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* crescita */}
      {d.crescita.series.length >= 2 && (
        <Card icon={<TrendingUp size={13} />} title="Crescita follower">
          <Sparkline data={d.crescita.series.map((s) => s.followers)} />
          <div className="mt-1 flex justify-between text-[10px] text-zinc-600">
            <span>{d.crescita.series[0].date}</span>
            <span>{d.crescita.series[d.crescita.series.length - 1].date}</span>
          </div>
        </Card>
      )}

      {/* top post */}
      {d.topPosts.length > 0 && (
        <Card icon={<Trophy size={13} />} title="Top post">
          <div className="space-y-2">
            {d.topPosts.map((p) => {
              const fmtH = PLATFORM_FORMAT[p.platforms[0] ?? "tiktok"]?.h ?? 1920;
              return (
                <div key={p.postId} className="flex items-center gap-3 rounded-xl border border-[#26262b] bg-[#1d1d21] p-2">
                  {p.slides[0] && (
                    <OverlayPreview spec={p.slides[0].overlay ?? null} width={30} fmtH={fmtH} src={`/api/assets/${p.slides[0].assetKey}`} className="shrink-0 rounded" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11.5px] text-zinc-200">{p.hook || "—"}</div>
                    <div className="flex gap-1 text-[9px] text-zinc-600">
                      {p.platforms.map((pl) => (
                        <span key={pl}>{PLATFORM_LABEL[pl]}</span>
                      ))}
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-[10.5px] text-zinc-400">
                    <div>{fmt(p.saves)} salvataggi</div>
                    <div className="text-zinc-600">{fmt(p.shares)} cond · {fmt(p.reach)} reach</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
