"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, Loader2, RefreshCw, Unlink } from "lucide-react";
import { getJson, postJson } from "@/lib/clientApi";
import type { Platform, SocialAccount } from "@/lib/types";

interface AccountsView {
  providerConfigured: boolean;
  connected: SocialAccount[];
}

const PLATFORMS: { id: Platform; label: string; icon: React.ReactNode }[] = [
  { id: "instagram", label: "Instagram", icon: <span className="text-[12px] font-bold">IG</span> },
  { id: "tiktok", label: "TikTok", icon: <span className="text-[12px] font-bold">TT</span> },
];

export function AccountsPanel({ projectId }: { projectId: string }) {
  const [view, setView] = useState<AccountsView | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => getJson<AccountsView>(`/api/projects/${projectId}/accounts`).then(setView).catch(() => {}), [projectId]);

  const sync = useCallback(async () => {
    setBusy("sync");
    try {
      const r = await postJson<{ connected: SocialAccount[] }>(`/api/projects/${projectId}/accounts`, { action: "sync" });
      setView((v) => (v ? { ...v, connected: r.connected } : v));
    } catch {
      /* provider non configurato: la GET mostra già lo stato */
    } finally {
      setBusy(null);
    }
  }, [projectId]);

  useEffect(() => {
    load().then(() => {
      // ritorno dal flusso di collegamento → sincronizza lo stato dal provider
      if (new URLSearchParams(window.location.search).get("connected")) {
        sync();
        window.history.replaceState({}, "", `/project/${projectId}?tab=account`);
      }
    });
  }, [load, sync, projectId]);

  const connect = async (platform: Platform) => {
    setBusy(platform);
    try {
      const r = await postJson<{ url: string }>(`/api/projects/${projectId}/accounts`, { action: "connect", platform });
      window.location.href = r.url;
    } catch (e) {
      alert(String(e));
      setBusy(null);
    }
  };

  const disconnect = async (platform: Platform) => {
    setBusy(platform);
    try {
      const r = await postJson<{ connected: SocialAccount[] }>(`/api/projects/${projectId}/accounts`, { action: "disconnect", platform });
      setView((v) => (v ? { ...v, connected: r.connected } : v));
    } finally {
      setBusy(null);
    }
  };

  const isConnected = (p: Platform) => view?.connected.find((a) => a.platform === p);

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-[16px] font-semibold tracking-tight text-zinc-100">Account social</h2>
          <p className="mt-0.5 text-[12px] text-zinc-500">Collega gli account di questo progetto per pubblicare i caroselli.</p>
        </div>
        <button
          onClick={sync}
          disabled={busy === "sync"}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#2e2e34] bg-[#202024] px-3 text-[11.5px] font-medium text-zinc-300 transition hover:border-[#454550] hover:text-white disabled:opacity-40"
        >
          {busy === "sync" ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Aggiorna
        </button>
      </div>

      {view && !view.providerConfigured && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[12px] text-amber-200">
          Per collegare gli account serve la chiave del provider di pubblicazione.{" "}
          <Link href="/settings" className="font-semibold underline underline-offset-2">
            Aggiungila in Impostazioni
          </Link>
          .
        </div>
      )}

      <div className="space-y-2.5">
        {PLATFORMS.map((p) => {
          const acc = isConnected(p.id);
          return (
            <div key={p.id} className="flex items-center gap-4 rounded-2xl border border-[#26262b] bg-[#19191c] px-5 py-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#2e2e34] bg-[#1f1f23] text-zinc-300">
                {p.icon}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-semibold text-zinc-100">{p.label}</div>
                {acc ? (
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-emerald-400">
                    <Check size={11} /> collegato{acc.handle ? ` · @${acc.handle}` : ""}
                  </div>
                ) : (
                  <div className="mt-0.5 text-[11px] text-zinc-600">non collegato</div>
                )}
              </div>
              {acc ? (
                <button
                  onClick={() => disconnect(p.id)}
                  disabled={busy === p.id}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#2e2e34] bg-[#202024] px-3 text-[11.5px] font-medium text-zinc-400 transition hover:border-red-900 hover:text-red-300 disabled:opacity-40"
                >
                  {busy === p.id ? <Loader2 size={13} className="animate-spin" /> : <Unlink size={13} />} Scollega
                </button>
              ) : (
                <button
                  onClick={() => connect(p.id)}
                  disabled={!view?.providerConfigured || busy === p.id}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white px-4 text-[11.5px] font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-40"
                >
                  {busy === p.id ? <Loader2 size={13} className="animate-spin" /> : "Collega"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-5 text-[11px] leading-relaxed text-zinc-600">
        Instagram dev&apos;essere un account <span className="text-zinc-400">Business o Creator</span>. Il collegamento è
        sicuro e autorizzato (OAuth ufficiale): clicchi &quot;Collega&quot;, autorizzi, e torni qui.
      </p>
    </div>
  );
}
