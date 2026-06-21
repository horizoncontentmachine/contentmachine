"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarClock, Loader2, Phone, Plus, Power, RotateCw, Server, Smartphone, X } from "lucide-react";

type Tab = "phones" | "apps" | "proxies" | "warmup" | "numbers";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "phones", label: "Telefoni", icon: <Smartphone size={13} /> },
  { id: "warmup", label: "Warmup (RPA)", icon: <CalendarClock size={13} /> },
  { id: "apps", label: "App", icon: <Server size={13} /> },
  { id: "proxies", label: "Proxy", icon: <Server size={13} /> },
  { id: "numbers", label: "Numeri / SMS", icon: <Phone size={13} /> },
];

// chiamata generica al proxy DuoPlus
async function duo<T = unknown>(action: string, params: Record<string, unknown> = {}, confirm = false): Promise<T> {
  const r = await fetch("/api/duoplus", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, params, confirm }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Errore");
  if (j.code && j.code !== 200) throw new Error(j.message || `DuoPlus code ${j.code}`);
  return j.data as T;
}

const btn = "inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#2e2e34] bg-[#202024] px-3.5 text-[12px] font-medium text-zinc-200 transition hover:border-[#454550] hover:text-white disabled:opacity-40";
const whiteBtn = "inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-4 text-[12px] font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-40";
const inputCls = "h-9 w-full rounded-lg border border-[#2a2a30] bg-[#1d1d21] px-3 text-[12.5px] text-zinc-200 outline-none focus:border-zinc-500";

export function FarmPanel() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("phones");

  useEffect(() => {
    fetch("/api/duoplus").then((r) => r.json()).then((j) => setConfigured(!!j.configured)).catch(() => setConfigured(false));
  }, []);

  return (
    <div className="flex h-screen flex-col">
      <div className="flex h-12 items-center gap-3 border-b border-[#222227] bg-[#161619] px-4">
        <Link href="/" className="grid h-7 w-7 place-items-center rounded-lg text-zinc-500 hover:bg-[#222227] hover:text-zinc-200">
          <ArrowLeft size={14} />
        </Link>
        <span className="text-[14px] font-semibold tracking-tight text-zinc-100">Device farm</span>
        <span className="hidden text-[11px] text-zinc-600 sm:inline">cloud phone DuoPlus — creazione, warmup e gestione account</span>
      </div>

      {configured === false ? (
        <div className="mx-auto mt-10 max-w-xl px-8">
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-[13px] text-amber-200">
            Per usare la Device farm serve la chiave DuoPlus.{" "}
            <Link href="/settings" className="font-semibold underline underline-offset-2">
              Aggiungila in Impostazioni
            </Link>
            .
          </div>
        </div>
      ) : configured === null ? (
        <div className="grid flex-1 place-items-center text-zinc-600">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : (
        <>
          <div className="flex h-10 items-center gap-1 border-b border-[#222227] bg-[#161619] px-3">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition ${
                  tab === t.id ? "bg-[#26262c] text-zinc-100" : "text-zinc-500 hover:text-zinc-200"
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === "phones" && <PhonesTab />}
            {tab === "warmup" && <WarmupTab />}
            {tab === "apps" && <AppsTab />}
            {tab === "proxies" && <ProxiesTab />}
            {tab === "numbers" && <NumbersTab />}
          </div>
        </>
      )}
    </div>
  );
}

const WRAP = "mx-auto w-full max-w-[1200px] px-8 py-7";

function SectionHead({ title, desc, action }: { title: string; desc: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-center justify-between">
      <div>
        <h2 className="text-[16px] font-semibold tracking-tight text-zinc-100">{title}</h2>
        <p className="mt-0.5 text-[12px] text-zinc-500">{desc}</p>
      </div>
      {action}
    </div>
  );
}

interface Phone {
  id: string;
  name: string;
  status: number;
  ip?: string;
  os?: string;
  area?: string;
}

const STATUS_LABEL: Record<number, { t: string; c: string }> = {
  0: { t: "non configurato", c: "text-zinc-500" },
  1: { t: "acceso", c: "text-emerald-400" },
  2: { t: "spento", c: "text-zinc-400" },
  3: { t: "scaduto", c: "text-red-400" },
  4: { t: "rinnovo", c: "text-amber-400" },
  10: { t: "accensione…", c: "text-amber-400" },
  11: { t: "config…", c: "text-amber-400" },
  12: { t: "config fallita", c: "text-red-400" },
};

function PhonesTab() {
  const [phones, setPhones] = useState<Phone[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await duo<{ list: Phone[] }>("phones.list", { page: 1, pagesize: 100 });
      setPhones(d.list ?? []);
    } catch (e) {
      setErr(String(e));
      setPhones([]);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const act = async (action: string, id: string, confirm = false) => {
    setBusy(`${action}-${id}`);
    setErr(null);
    try {
      await duo(action, { image_ids: [id] }, confirm);
      setTimeout(load, 800);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={WRAP}>
      <SectionHead
        title="Cloud phone"
        desc="Crea e gestisci i telefoni cloud. Ogni telefono = ambiente isolato (device + IP)."
        action={
          <button onClick={() => setCreating(true)} className={whiteBtn}>
            <Plus size={14} /> Crea cloud phone
          </button>
        }
      />
      {err && <div className="mb-3 rounded-lg border border-red-900/50 bg-red-950/30 p-2.5 text-[11.5px] text-red-300">{err}</div>}

      {!phones ? (
        <div className="py-16 text-center text-zinc-600"><Loader2 size={18} className="mx-auto animate-spin" /></div>
      ) : phones.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#2a2a30] p-10 text-center text-[12.5px] leading-relaxed text-zinc-600">
          Nessun cloud phone. Premi <span className="text-zinc-400">Crea cloud phone</span> per iniziare.
          <br />
          <span className="text-[11px]">Costo a partire da ~$1,4/mese a device (+ proxy). La creazione è a pagamento.</span>
        </div>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {phones.map((p) => {
            const st = STATUS_LABEL[p.status] ?? { t: String(p.status), c: "text-zinc-500" };
            return (
              <div key={p.id} className="rounded-xl border border-[#26262b] bg-[#19191c] p-3.5">
                <div className="flex items-center gap-2">
                  <Smartphone size={15} className="text-zinc-400" />
                  <span className="text-[13px] font-semibold text-zinc-100">{p.name}</span>
                  <span className={`text-[11px] ${st.c}`}>· {st.t}</span>
                  <div className="flex-1" />
                  <span className="text-[10.5px] text-zinc-600">{p.os} {p.ip ? `· ${p.ip}` : ""}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <button onClick={() => act("phones.powerOn", p.id, true)} disabled={!!busy} className={btn} title="Accendi (a consumo)">
                    {busy === `phones.powerOn-${p.id}` ? <Loader2 size={12} className="animate-spin" /> : <Power size={12} />} Accendi
                  </button>
                  <button onClick={() => act("phones.powerOff", p.id)} disabled={!!busy} className={btn}>
                    {busy === `phones.powerOff-${p.id}` ? <Loader2 size={12} className="animate-spin" /> : <Power size={12} />} Spegni
                  </button>
                  <button onClick={() => act("phones.restart", p.id)} disabled={!!busy} className={btn}>
                    {busy === `phones.restart-${p.id}` ? <Loader2 size={12} className="animate-spin" /> : <RotateCw size={12} />} Riavvia
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {creating && <CreatePhoneModal onClose={() => setCreating(false)} onDone={() => { setCreating(false); load(); }} />}
    </div>
  );
}

function CreatePhoneModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [os, setOs] = useState("15");
  const [duration, setDuration] = useState("30");
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const create = async () => {
    setBusy(true);
    setErr(null);
    try {
      await duo("phones.purchase", { os, duration, quantity }, true);
      onDone();
    } catch (e) {
      setErr(String(e));
      setBusy(false);
    }
  };

  return (
    <Modal title="Crea cloud phone" onClose={onClose}>
      <div className="space-y-3">
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-200">
          Operazione a pagamento: acquista {quantity} device per {duration} giorni.
        </div>
        <Field label="Android">
          <select className={inputCls} value={os} onChange={(e) => setOs(e.target.value)}>
            <option value="10">Android 10</option>
            <option value="11">Android 11</option>
            <option value="12A">Android 12 (Region A)</option>
            <option value="12B">Android 12 (Region B)</option>
            <option value="15">Android 15</option>
            <option value="15pro">Android 15 Pro</option>
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Durata (giorni)">
            <select className={inputCls} value={duration} onChange={(e) => setDuration(e.target.value)}>
              {["7", "30", "90", "180", "360"].map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </Field>
          <Field label="Quantità">
            <input type="number" min={1} max={50} className={inputCls} value={quantity} onChange={(e) => setQuantity(Number(e.target.value) || 1)} />
          </Field>
        </div>
        {err && <div className="rounded-lg border border-red-900/50 bg-red-950/30 p-2.5 text-[11px] text-red-300">{err}</div>}
        <button onClick={create} disabled={busy} className={whiteBtn + " w-full justify-center"}>
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Crea e paga
        </button>
      </div>
    </Modal>
  );
}

function WarmupTab() {
  const [official, setOfficial] = useState<{ id: string; name: string; desc?: string }[] | null>(null);
  const [custom, setCustom] = useState<{ id: string; name: string; desc?: string }[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    duo<{ list: { id: string; name: string; desc?: string }[] }>("templates.official", { page: 1, pagesize: 100 })
      .then((d) => setOfficial(d.list ?? []))
      .catch((e) => { setErr(String(e)); setOfficial([]); });
    duo<{ list: { id: string; name: string; desc?: string }[] }>("templates.custom", { page: 1, pagesize: 100 })
      .then((d) => setCustom(d.list ?? []))
      .catch(() => {});
  }, []);

  return (
    <div className={WRAP}>
      <SectionHead title="Warmup & automazioni (RPA)" desc="Template DuoPlus da pianificare sui telefoni. I template custom si creano nella console DuoPlus, poi li programmi da qui." />
      {err && <div className="mb-3 rounded-lg border border-red-900/50 bg-red-950/30 p-2.5 text-[11.5px] text-red-300">{err}</div>}

      <div className="rounded-xl border border-[#26262b] bg-[#19191c] p-4 text-[12px] leading-relaxed text-zinc-400">
        <div className="mb-1 font-semibold text-zinc-200">Come funziona il warmup</div>
        Un task = un <span className="text-zinc-300">template</span> applicato a N telefoni con orari. Pianifica un template
        di &quot;account warming&quot; come <span className="text-zinc-300">Loop Task</span> (ricorrente) per simulare attività umana
        graduale. La pubblicazione vera passa comunque dall&apos;API ufficiale (Upload-Post).
      </div>

      <div className="mt-5">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Template ufficiali</div>
        {!official ? (
          <Loader2 size={16} className="animate-spin text-zinc-600" />
        ) : official.length === 0 ? (
          <div className="text-[12px] text-zinc-600">Nessun template disponibile.</div>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {official.map((t) => (
              <div key={t.id} className="rounded-xl border border-[#26262b] bg-[#19191c] p-3">
                <div className="text-[12.5px] font-medium text-zinc-100">{t.name}</div>
                {t.desc && <div className="mt-0.5 text-[11px] text-zinc-500 line-clamp-2">{t.desc}</div>}
                <div className="mt-1 font-mono text-[9px] text-zinc-600">{t.id}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {custom.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">I tuoi template</div>
          <div className="grid gap-2 md:grid-cols-2">
            {custom.map((t) => (
              <div key={t.id} className="rounded-xl border border-[#26262b] bg-[#19191c] p-3">
                <div className="text-[12.5px] font-medium text-zinc-100">{t.name}</div>
                <div className="mt-1 font-mono text-[9px] text-zinc-600">{t.id}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AppsTab() {
  const [apps, setApps] = useState<{ id: string; name: string; pkg: string }[] | null>(null);
  useEffect(() => {
    duo<{ list: { id: string; name: string; pkg: string }[] }>("apps.catalog", { page: 1, pagesize: 100 })
      .then((d) => setApps(d.list ?? []))
      .catch(() => setApps([]));
  }, []);
  return (
    <div className={WRAP}>
      <SectionHead title="Catalogo app" desc="App installabili sui cloud phone (poi le installi sui device selezionati)." />
      {!apps ? (
        <Loader2 size={18} className="animate-spin text-zinc-600" />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {apps.map((a) => (
            <div key={a.id} className="flex items-center gap-2 rounded-xl border border-[#26262b] bg-[#19191c] p-3">
              <Server size={14} className="text-zinc-500" />
              <div className="min-w-0">
                <div className="truncate text-[12.5px] font-medium text-zinc-100">{a.name}</div>
                <div className="truncate font-mono text-[9.5px] text-zinc-600">{a.pkg}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProxiesTab() {
  const [proxies, setProxies] = useState<{ id: string; name?: string; host: string; port: number; area?: string }[] | null>(null);
  const [adding, setAdding] = useState(false);
  const load = useCallback(() => duo<{ list: never[] }>("proxies.list", { page: 1, pagesize: 100 }).then((d) => setProxies(d.list ?? [])).catch(() => setProxies([])), []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className={WRAP}>
      <SectionHead title="Proxy" desc="Proxy SOCKS5 da assegnare ai device (un IP per account)." action={<button onClick={() => setAdding(true)} className={whiteBtn}><Plus size={14} /> Aggiungi proxy</button>} />
      {!proxies ? (
        <Loader2 size={18} className="animate-spin text-zinc-600" />
      ) : proxies.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#2a2a30] p-10 text-center text-[12.5px] text-zinc-600">Nessun proxy. I proxy residenziali si comprano a parte (~$5–15/mese a device).</div>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {proxies.map((p) => (
            <div key={p.id} className="rounded-xl border border-[#26262b] bg-[#19191c] p-3 text-[12px]">
              <div className="font-medium text-zinc-100">{p.name || `${p.host}:${p.port}`}</div>
              <div className="text-[10.5px] text-zinc-500">{p.host}:{p.port} {p.area ? `· ${p.area}` : ""}</div>
            </div>
          ))}
        </div>
      )}
      {adding && <AddProxyModal onClose={() => setAdding(false)} onDone={() => { setAdding(false); load(); }} />}
    </div>
  );
}

function AddProxyModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ host: "", port: "", user: "", password: "", name: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const add = async () => {
    setBusy(true); setErr(null);
    try {
      await duo("proxies.add", { proxy_list: [{ protocol: "socks5", host: f.host, port: Number(f.port), user: f.user || undefined, password: f.password || undefined, name: f.name || undefined }] });
      onDone();
    } catch (e) { setErr(String(e)); setBusy(false); }
  };
  return (
    <Modal title="Aggiungi proxy (SOCKS5)" onClose={onClose}>
      <div className="space-y-2.5">
        <div className="grid grid-cols-3 gap-2">
          <input className={inputCls + " col-span-2"} placeholder="host" value={f.host} onChange={(e) => setF({ ...f, host: e.target.value })} />
          <input className={inputCls} placeholder="porta" value={f.port} onChange={(e) => setF({ ...f, port: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input className={inputCls} placeholder="user (opz.)" value={f.user} onChange={(e) => setF({ ...f, user: e.target.value })} />
          <input className={inputCls} placeholder="password (opz.)" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        </div>
        <input className={inputCls} placeholder="nome (opz.)" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        {err && <div className="rounded-lg border border-red-900/50 bg-red-950/30 p-2.5 text-[11px] text-red-300">{err}</div>}
        <button onClick={add} disabled={busy || !f.host || !f.port} className={whiteBtn + " w-full justify-center"}>
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Aggiungi
        </button>
      </div>
    </Modal>
  );
}

function NumbersTab() {
  const [numbers, setNumbers] = useState<{ id: string; phone_number?: string; region_name?: string; status_name?: string }[] | null>(null);
  useEffect(() => {
    duo<{ list: never[] }>("numbers.list", { page: 1, pagesize: 100 }).then((d) => setNumbers(d.list ?? [])).catch(() => setNumbers([]));
  }, []);
  return (
    <div className={WRAP}>
      <SectionHead title="Numeri & SMS" desc="Numeri cloud per registrare/verificare gli account (ricezione codici SMS via API)." />
      <div className="mb-4 rounded-xl border border-[#26262b] bg-[#19191c] p-4 text-[12px] leading-relaxed text-zinc-400">
        Servono per creare account: noleggi un numero, ricevi il codice di verifica via API durante la registrazione.
        L&apos;acquisto è a pagamento e dipende dal paese.
      </div>
      {!numbers ? (
        <Loader2 size={18} className="animate-spin text-zinc-600" />
      ) : numbers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#2a2a30] p-10 text-center text-[12.5px] text-zinc-600">Nessun numero. (Acquisto numeri: lo colleghiamo quando definiamo il flusso di creazione account.)</div>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {numbers.map((n) => (
            <div key={n.id} className="rounded-xl border border-[#26262b] bg-[#19191c] p-3 text-[12px]">
              <div className="font-medium text-zinc-100">{n.phone_number || "in generazione…"}</div>
              <div className="text-[10.5px] text-zinc-500">{n.region_name} · {n.status_name}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-[420px] max-w-[92vw] overflow-hidden rounded-2xl border border-[#2a2a30] bg-[#161619] shadow-[0_24px_70px_rgba(0,0,0,0.6)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-[#222227] px-4 py-3">
          <span className="text-[13px] font-semibold text-zinc-100">{title}</span>
          <div className="flex-1" />
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-lg text-zinc-500 hover:bg-[#222227] hover:text-zinc-200">
            <X size={15} />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-500">{label}</div>
      {children}
    </label>
  );
}
