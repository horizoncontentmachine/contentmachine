"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { Check, Clock, ExternalLink, Loader2, Plus, RefreshCw, Smartphone, Trash2, X } from "lucide-react";
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
  const [connecting, setConnecting] = useState<Platform | null>(null);

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
    <div className="mx-auto w-full max-w-[1000px] px-8 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-[17px] font-semibold tracking-tight text-zinc-100">Account social</h2>
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
            onClick={() => setConnecting(p)}
            disabled={disabled}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#2e2e34] bg-[#202024] px-3.5 text-[12px] font-medium text-zinc-200 transition hover:border-[#454550] hover:text-white disabled:opacity-40"
          >
            <Plus size={13} />
            <span className="grid h-4 w-5 place-items-center rounded bg-[#2e2e34] text-[8px] font-bold text-zinc-300">{BADGE[p]}</span>
            {PLATFORM_LABEL[p]}
          </button>
        ))}
      </div>

      {/* elenco account */}
      {accounts.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[#2a2a30] p-8 text-center text-[12px] leading-relaxed text-zinc-600">
          Nessun account collegato. Aggiungine uno con i bottoni qui sopra.
        </div>
      )}
      <div className="grid gap-2 md:grid-cols-2">
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
        Instagram dev&apos;essere Business/Creator. Consigliato: collega <span className="text-zinc-400">dal telefono dell&apos;account</span>{" "}
        (QR) per non incrociare il tuo IP con quello delle pagine.
      </p>

      {connecting && (
        <ConnectModal
          projectId={projectId}
          platform={connecting}
          onClose={() => setConnecting(null)}
          onDone={() => {
            setConnecting(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function ConnectModal({ projectId, platform, onClose, onDone }: { projectId: string; platform: Platform; onClose: () => void; onDone: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // 1) crea il link di collegamento + QR
  useEffect(() => {
    let alive = true;
    postJson<{ url: string; accountId: string }>(`/api/projects/${projectId}/accounts`, { action: "connect", platform })
      .then(async (r) => {
        if (!alive) return;
        setUrl(r.url);
        setAccountId(r.accountId);
        setQr(await QRCode.toDataURL(r.url, { margin: 1, width: 240, color: { dark: "#000000", light: "#ffffff" } }));
      })
      .catch((e) => alive && setErr(String(e)));
    return () => {
      alive = false;
    };
  }, [projectId, platform]);

  // 2) controlla quando l'account risulta collegato
  useEffect(() => {
    if (!accountId) return;
    const iv = setInterval(async () => {
      try {
        const r = await postJson<{ accounts: SocialAccount[] }>(`/api/projects/${projectId}/accounts`, { action: "sync", accountId });
        if (r.accounts.find((a) => a.id === accountId)?.status === "connected") {
          clearInterval(iv);
          setDone(true);
          setTimeout(onDone, 1300);
        }
      } catch {
        /* riprova al prossimo giro */
      }
    }, 4000);
    return () => clearInterval(iv);
  }, [accountId, projectId, onDone]);

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-[420px] max-w-[92vw] overflow-hidden rounded-2xl border border-[#2a2a30] bg-[#161619] shadow-[0_24px_70px_rgba(0,0,0,0.6)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-[#222227] px-4 py-3">
          <span className="grid h-5 w-6 place-items-center rounded bg-[#2e2e34] text-[8px] font-bold text-zinc-300">{BADGE[platform]}</span>
          <span className="text-[13px] font-semibold text-zinc-100">Collega {PLATFORM_LABEL[platform]}</span>
          <div className="flex-1" />
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-lg text-zinc-500 hover:bg-[#222227] hover:text-zinc-200">
            <X size={15} />
          </button>
        </div>

        <div className="p-5">
          {err ? (
            <div className="rounded-lg border border-red-900/50 bg-red-950/30 p-3 text-[12px] text-red-300">{err}</div>
          ) : done ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-emerald-500/15 text-emerald-400">
                <Check size={24} />
              </span>
              <div className="text-[14px] font-semibold text-zinc-100">Account collegato</div>
            </div>
          ) : !qr ? (
            <div className="grid place-items-center py-12 text-zinc-600">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : (
            <>
              <div className="mb-3 flex items-center gap-2 text-[12px] font-medium text-zinc-200">
                <Smartphone size={14} className="text-zinc-400" /> Scansiona col telefono dell&apos;account
              </div>
              <div className="flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="QR collegamento" className="rounded-xl bg-white p-2" width={220} height={220} />
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
                Aprilo sul telefono dove l&apos;account è loggato e autorizza lì: così il collegamento parte dal suo
                dispositivo/IP, non dal tuo PC. Questa finestra si aggiorna da sola quando è fatto.
              </p>
              <div className="mt-4 flex items-center gap-2 border-t border-[#222227] pt-3">
                <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                  <Loader2 size={12} className="animate-spin" /> in attesa di autorizzazione…
                </span>
                <div className="flex-1" />
                {url && (
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 hover:text-zinc-200"
                  >
                    Collega da questo computer <ExternalLink size={11} />
                  </a>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
