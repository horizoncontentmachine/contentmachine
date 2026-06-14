"use client";

import { useEffect, useState } from "react";
import { BarChart3, Info, Lightbulb, TrendingUp, Trophy } from "lucide-react";
import { getJson } from "@/lib/clientApi";
import { OverlayPreview } from "@/components/OverlayPreview";
import { Sk } from "@/components/Skeleton";
import { PLATFORM_FORMAT } from "@/lib/formats";
import { PLATFORM_LABEL, type Platform, type SlideInput } from "@/lib/types";

const BADGE: Record<Platform, string> = { instagram: "IG", tiktok: "TT", x: "X" };
const WRAP = "mx-auto w-full max-w-[1400px] px-8 py-8";

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

function Sparkline({ data, className = "h-28" }: { data: number[]; className?: string }) {
  if (data.length < 2) return <div className={`${className} grid place-items-center text-[11px] text-zinc-600`}>dati insufficienti</div>;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${30 - ((v - min) / range) * 28}`).join(" ");
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className={`${className} w-full`}>
      <polyline points={`0,30 ${pts} 100,30`} fill="rgba(255,255,255,0.05)" stroke="none" />
      <polyline points={pts} fill="none" stroke="#ececef" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Stat({ label, value, sub, subClass }: { label: string; value: React.ReactNode; sub?: string; subClass?: string }) {
  return (
    <div className="rounded-2xl border border-[#26262b] bg-[#19191c] p-5">
      <div className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-[28px] font-bold leading-none tracking-tight text-white">{value}</div>
      {sub && <div className={`mt-1.5 text-[12px] ${subClass ?? "text-zinc-500"}`}>{sub}</div>}
    </div>
  );
}

function Card({ icon, title, children, className = "" }: { icon: React.ReactNode; title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-[#26262b] bg-[#19191c] p-5 ${className}`}>
      <div className="mb-4 flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg border border-[#2e2e34] bg-[#1f1f23] text-zinc-400">{icon}</span>
        <h3 className="text-[14px] font-semibold tracking-tight text-zinc-100">{title}</h3>
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
    getJson<Insights>(url).then(setD).catch(() => {}).finally(() => setLoading(false));
  }, [projectId]);

  if (loading || !d || !d.hasData) return <SkeletonInsights empty={!loading} />;

  const maxScore = Math.max(1, ...d.cosaFunziona.platforms.map((p) => p.score));

  return (
    <div className={`${WRAP} space-y-5`}>
      {/* totali */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat
          label="Follower"
          value={fmt(d.totals.followers)}
          sub={d.crescita.delta7 !== 0 ? `${d.crescita.delta7 > 0 ? "+" : ""}${fmt(d.crescita.delta7)} negli ultimi 7 giorni` : undefined}
          subClass={d.crescita.delta7 > 0 ? "text-emerald-400" : "text-red-400"}
        />
        <Stat label="Reach totale" value={fmt(d.totals.reach)} />
        <Stat label="Post pubblicati" value={d.totals.posts} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* colonna principale */}
        <div className="space-y-5 lg:col-span-2">
          <Card icon={<BarChart3 size={14} />} title="Cosa funziona">
            {d.cosaFunziona.platforms.length > 0 && (
              <div className="mb-5">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Per piattaforma</div>
                <div className="space-y-2">
                  {d.cosaFunziona.platforms.map((p) => (
                    <div key={p.platform} className="flex items-center gap-3">
                      <span className="grid h-6 w-9 shrink-0 place-items-center rounded-md bg-[#2e2e34] text-[9px] font-bold text-zinc-300">{BADGE[p.platform]}</span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#222227]">
                        <div className="h-full rounded-full bg-zinc-200" style={{ width: `${(p.score / maxScore) * 100}%` }} />
                      </div>
                      <span className="w-40 shrink-0 text-right text-[11.5px] text-zinc-400">{fmt(p.avgSaves)} salv · {fmt(p.avgReach)} reach</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="grid gap-5 md:grid-cols-2">
              {d.cosaFunziona.hooks.length > 0 && (
                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Hook migliori</div>
                  <div className="space-y-2">
                    {d.cosaFunziona.hooks.slice(0, 6).map((h, i) => (
                      <div key={i} className="flex items-center gap-2 text-[12.5px]">
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded bg-[#222227] text-[10px] font-semibold text-zinc-500">{i + 1}</span>
                        <span className="min-w-0 flex-1 truncate text-zinc-200">{h.hook}</span>
                        <span className="shrink-0 text-[11px] text-zinc-500">{fmt(h.avgSaves)} salv</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {d.cosaFunziona.slides.length > 0 && (
                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Numero di slide</div>
                  <div className="flex flex-wrap gap-2">
                    {d.cosaFunziona.slides.map((s) => (
                      <span key={s.count} className="rounded-lg border border-[#2e2e34] bg-[#202024] px-3 py-1.5 text-[12px] text-zinc-300">
                        <span className="font-semibold text-zinc-100">{s.count}</span> slide · {fmt(s.avgScore)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {d.topPosts.length > 0 && (
            <Card icon={<Trophy size={14} />} title="Top post">
              <div className="grid gap-2.5 md:grid-cols-2">
                {d.topPosts.map((p) => {
                  const fmtH = PLATFORM_FORMAT[p.platforms[0] ?? "tiktok"]?.h ?? 1920;
                  return (
                    <div key={p.postId} className="flex items-center gap-3 rounded-xl border border-[#26262b] bg-[#1d1d21] p-2.5">
                      {p.slides[0] && (
                        <OverlayPreview spec={p.slides[0].overlay ?? null} width={38} fmtH={fmtH} src={`/api/assets/${p.slides[0].assetKey}`} className="shrink-0 rounded-md" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12.5px] text-zinc-100">{p.hook || "—"}</div>
                        <div className="mt-0.5 flex gap-1.5 text-[10px] text-zinc-600">
                          {p.platforms.map((pl) => (
                            <span key={pl}>{PLATFORM_LABEL[pl]}</span>
                          ))}
                        </div>
                      </div>
                      <div className="shrink-0 text-right text-[11px] text-zinc-400">
                        <div className="font-semibold text-zinc-200">{fmt(p.saves)} salv</div>
                        <div className="text-[10px] text-zinc-600">{fmt(p.shares)} cond</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>

        {/* colonna laterale */}
        <div className="space-y-5">
          {d.cosaFunziona.tips.length > 0 && (
            <Card icon={<Lightbulb size={14} />} title="Consigli">
              <ul className="space-y-2.5">
                {d.cosaFunziona.tips.map((t, i) => (
                  <li key={i} className="flex gap-2 text-[12.5px] leading-relaxed text-zinc-300">
                    <span className="text-zinc-600">→</span> {t}
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card icon={<TrendingUp size={14} />} title="Crescita follower">
            <div className="mb-2 text-[26px] font-bold leading-none text-white">{fmt(d.crescita.currentFollowers)}</div>
            <Sparkline data={d.crescita.series.map((s) => s.followers)} />
            {d.crescita.series.length >= 2 && (
              <div className="mt-1 flex justify-between text-[10.5px] text-zinc-600">
                <span>{d.crescita.series[0].date}</span>
                <span>{d.crescita.series[d.crescita.series.length - 1].date}</span>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function SkeletonInsights({ empty }: { empty: boolean }) {
  return (
    <div className={`${WRAP} space-y-5`}>
      {empty && (
        <div className="flex items-center gap-2 rounded-xl border border-[#26262b] bg-[#19191c] px-4 py-3 text-[12px] text-zinc-400">
          <Info size={15} className="shrink-0 text-zinc-500" />
          Ecco come apparirà la dashboard: i dati si popolano qui dopo aver collegato Upload-Post e pubblicato (le metriche arrivano qualche ora dopo).
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {["Follower", "Reach totale", "Post pubblicati"].map((t) => (
          <div key={t} className="rounded-2xl border border-[#26262b] bg-[#19191c] p-5">
            <div className="text-[11px] uppercase tracking-wide text-zinc-500">{t}</div>
            <Sk w={90} h={28} className="mt-1.5" />
          </div>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card icon={<BarChart3 size={14} />} title="Cosa funziona">
            <div className="mb-5 space-y-2">
              {["IG", "TT", "X"].map((b) => (
                <div key={b} className="flex items-center gap-3">
                  <span className="grid h-6 w-9 shrink-0 place-items-center rounded-md bg-[#2e2e34] text-[9px] font-bold text-zinc-500">{b}</span>
                  <Sk h={10} className="flex-1" rounded="rounded-full" />
                  <Sk w={140} h={11} />
                </div>
              ))}
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2.5">
                {[0, 1, 2, 3].map((i) => (
                  <Sk key={i} w={`${85 - i * 8}%`} h={12} />
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {[0, 1, 2].map((i) => (
                  <Sk key={i} w={100} h={30} rounded="rounded-lg" />
                ))}
              </div>
            </div>
          </Card>
          <Card icon={<Trophy size={14} />} title="Top post">
            <div className="grid gap-2.5 md:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl border border-[#26262b] bg-[#1d1d21] p-2.5">
                  <Sk w={38} h={50} rounded="rounded-md" />
                  <div className="flex-1 space-y-1.5">
                    <Sk w="70%" h={12} />
                    <Sk w={40} h={9} />
                  </div>
                  <Sk w={50} h={22} />
                </div>
              ))}
            </div>
          </Card>
        </div>
        <div className="space-y-5">
          <Card icon={<Lightbulb size={14} />} title="Consigli">
            <div className="space-y-2.5">
              <Sk w="95%" h={12} />
              <Sk w="80%" h={12} />
              <Sk w="88%" h={12} />
            </div>
          </Card>
          <Card icon={<TrendingUp size={14} />} title="Crescita follower">
            <Sk w={110} h={26} className="mb-3" />
            <Sk h={112} className="w-full" rounded="rounded-xl" />
          </Card>
        </div>
      </div>
    </div>
  );
}
