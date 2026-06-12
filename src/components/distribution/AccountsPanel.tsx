"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, Clock, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { getJson, postJson } from "@/lib/clientApi";
import { PLATFORM_LABEL, type Platform, type SocialAccount } from "@/lib/types";

interface AccountsView {
  providerConfigured: boolean;
  accounts: SocialAccount[];
}

const PLATFORMS: Platform[] = ["instagram", "tiktok", "x"];
const BADGE: Record<Platform, string> = { instagram: "IG", tiktok: "TT", x: "X" };

export function AccountsPanel({ projectId }: { projectId: string }) {
  const [view, setView] = useState<AccountsView | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => getJson<AccountsView>(`/api/projects/${projectId}/accounts`).then(setView).catch(() => {}), [projectId]);

  const sync = useCallback(
    async (accountId?: string) => {
      setBusy(accountId ? `sync-${accountId}` : "sync");
      try {
        const r = await postJson<{ accounts: SocialAccount[] }>(`/api/projects/${projectId}/accounts`, { action: "sync", accountId });
        setView((v) => (v ? { ...v, accounts: r.accounts } : v));
      } catch {
        /* provider non configurato */
      } finally {
        setBusy(null);
      }
    },
    [projectId]
  );

  useEffect(() => {
    load().then(() => {
      const acc = new URLSearchParams(window.location.search).get("account");
      if (acc) {
        sync(acc);
        window.history.replaceState({}, "", `/project/${projectId}?tab=account`);
      }
    });
  }, [load, sync, projectId]);

  const connect = async (platform: Platform) => {
    setBusy(`add-${platform}`);
    try {
      const r = await postJson<{ url: string }>(`/api/projects/${projectId}/accounts`, { action: "connect", platform });
      window.location.href = r.url;
    } catch (e) {
      alert(String(e));
      setBusy(null);
    }
  };

  const remove = async (accountId: string) => {
    setBusy(`rm-${accountId}`);
    try {
      const r = await postJson<{ accounts: SocialAccount[] }>(`/api/projects/${projectId}/accounts`, { action: "disconnect", accountId });
      setView((v) => (v ? { ...v, accounts: r.accounts } : v));
    } finally {
      setBusy(null);
    }
  };

  const accounts = view?.accounts ?? [];
  const disabled = !view?.providerConfigured;

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-[16px] font-semibold tracking-tight text-zinc-100">Account social</h2>
          <p className="mt-0.5 text-[12px] text-zinc-500">Collega quanti account vuoi, per ogni piattaforma.</p>
        </div>
        <button
          onClick={() => sync()}
          disabled={busy === "sync"}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#2e2e34] bg-[#202024] px-3 text-[11.5px] font-medium text-zinc-300 transition hover:border-[#454550] hover:text-white disabled:opacity-40"
        >
          {busy === "sync" ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Aggiorna
        </button>
      </div>

      {view && !view.providerConfigured && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[12px] text-amber-200">
          Per collegare gli account serve la chiave del provider.{" "}
          <Link href="/settings" className="font-semibold underline underline-offset-2">
            Aggiungila in Impostazioni
          </Link>
          .
        </div>
      )}

      {/* aggiungi account */}
      <div className="mb-5 flex flex-wrap gap-2">
        {PLATFORMS.map((p) => (
          <button
            key={p}
            onClick={() => connect(p)}
            disabled={disabled || busy === `add-${p}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#2e2e34] bg-[#202024] px-3.5 text-[12px] font-medium text-zinc-200 transition hover:border-[#454550] hover:text-white disabled:opacity-40"
          >
            {busy === `add-${p}` ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            <span className="grid h-4 w-5 place-items-center rounded bg-[#2e2e34] text-[8px] font-bold text-zinc-300">{BADGE[p]}</span>
            {PLATFORM_LABEL[p]}
          </button>
        ))}
      </div>

      {/* elenco account */}
      <div className="space-y-2">
        {accounts.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[#2a2a30] p-8 text-center text-[12px] leading-relaxed text-zinc-600">
            Nessun account collegato. Aggiungine uno con i bottoni qui sopra.
          </div>
        )}
        {accounts.map((a) => (
          <div key={a.id} className="flex items-center gap-3 rounded-xl border border-[#26262b] bg-[#19191c] px-4 py-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#2e2e34] bg-[#1f1f23] text-[12px] font-bold text-zinc-300">
              {BADGE[a.platform]}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-zinc-100">
                {a.handle ? `@${a.handle}` : PLATFORM_LABEL[a.platform]}
                <span className="ml-2 text-[10.5px] font-normal text-zinc-600">{PLATFORM_LABEL[a.platform]}</span>
              </div>
              {a.status === "connected" ? (
                <div className="mt-0.5 flex items-center gap-1 text-[11px] text-emerald-400">
                  <Check size={11} /> collegato
                </div>
              ) : (
                <button onClick={() => sync(a.id)} className="mt-0.5 flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300">
                  {busy === `sync-${a.id}` ? <Loader2 size={11} className="animate-spin" /> : <Clock size={11} />} in attesa · verifica
                </button>
              )}
            </div>
            <button
              onClick={() => remove(a.id)}
              disabled={busy === `rm-${a.id}`}
              className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 transition hover:bg-[#222227] hover:text-red-400 disabled:opacity-40"
              title="Rimuovi"
            >
              {busy === `rm-${a.id}` ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            </button>
          </div>
        ))}
      </div>

      <p className="mt-5 text-[11px] leading-relaxed text-zinc-600">
        Instagram dev&apos;essere Business/Creator. Clicchi &quot;+&quot;, autorizzi l&apos;account, e torni qui: puoi
        ripetere per quanti account vuoi.
      </p>
    </div>
  );
}
