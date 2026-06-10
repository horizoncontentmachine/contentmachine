"use client";

import type { Node } from "@xyflow/react";
import { Download, Loader2, Play } from "lucide-react";
import { useFlowStore } from "@/store/useFlowStore";
import { collectSlides, findInputNode, nodeOutput, resolvePrompt } from "@/lib/graphResolve";
import { generateImage, exportCarousel, runVariants } from "@/lib/actions";
import { estimateImageCents, formatCents, QUALITY_LABEL, type ImageQuality } from "@/lib/costs";
import {
  activeResult,
  type CarouselData,
  type ExportInfo,
  type ImageGenData,
  type OverlayData,
  type PromptData,
  type VariantsData,
} from "@/lib/nodeData";
import type { OverlaySpec } from "@/lib/types";
import { OverlayPreview } from "./OverlayPreview";

// ---------- widget ----------

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-zinc-500">{label}</span>
        {hint && <span className="text-[9px] text-zinc-600">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border border-[#2a2a30] bg-[#1d1d21] px-2.5 py-1.5 text-[12px] text-zinc-200 placeholder-zinc-600 outline-none transition focus:border-zinc-500";

function PrimaryBtn({
  onClick,
  disabled,
  busy,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || busy}
      className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-[11.5px] font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-35"
    >
      {busy && <Loader2 size={12} className="animate-spin" />}
      {children}
    </button>
  );
}

function ErrLine({ id }: { id: string }) {
  const msg = useFlowStore((s) => s.errors[id]);
  if (!msg) return null;
  return <div className="rounded-lg border border-red-900/50 bg-red-950/30 p-2.5 text-[10.5px] leading-snug text-red-300">{msg}</div>;
}

function ExportLinks({ exp }: { exp: ExportInfo | null }) {
  if (!exp) return null;
  return (
    <div className="rounded-lg border border-[#2a2a30] bg-[#1d1d21] p-2.5 text-[10.5px]">
      <div className="text-zinc-400">
        Ultimo export{exp.count != null ? ` · ${exp.count} file` : ""} · {new Date(exp.at).toLocaleTimeString("it-IT")}
      </div>
      {exp.zipUrl && (
        <a href={exp.zipUrl} className="mt-1 inline-flex items-center gap-1.5 font-medium text-white underline-offset-2 hover:underline">
          <Download size={11} /> Scarica ZIP
        </a>
      )}
      <div className="mt-1 text-[9px] text-zinc-600">I file restano anche in shortflow/data/exports/</div>
    </div>
  );
}

// ---------- per blocco ----------

function PromptInspector({ node }: { node: Node }) {
  const d = node.data as PromptData;
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  return (
    <div className="space-y-4">
      <Field label="Prompt" hint="modificabile anche sul blocco">
        <textarea className={inputCls} rows={9} value={d.text} onChange={(e) => updateNodeData(node.id, { text: e.target.value })} />
      </Field>
      <p className="text-[10px] leading-relaxed text-zinc-600">
        Suggerimento: soggetto centrale (l&apos;immagine viene ritagliata ai lati per il 9:16), luce naturale, &quot;shot on
        iPhone, ultra realistic&quot; per il look UGC. Salva i migliori nel Vault.
      </p>
    </div>
  );
}

function ImageGenInspector({ node }: { node: Node }) {
  const d = node.data as ImageGenData;
  const busy = useFlowStore((s) => !!s.busy[node.id]);
  const { updateNodeData } = useFlowStore.getState();
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const prompt = resolvePrompt(nodes, edges, node.id);
  const result = activeResult(d);

  return (
    <div className="space-y-4">
      <Field label="Qualità" hint={`~${formatCents(estimateImageCents(d.quality as ImageQuality))} a immagine`}>
        <div className="grid grid-cols-3 gap-1 rounded-full border border-[#2a2a30] bg-[#1d1d21] p-1">
          {(Object.keys(QUALITY_LABEL) as ImageQuality[]).map((q) => (
            <button
              key={q}
              onClick={() => updateNodeData(node.id, { quality: q })}
              className={`rounded-full py-1 text-[10.5px] font-medium transition ${
                d.quality === q ? "bg-white text-black" : "text-zinc-500 hover:text-zinc-200"
              }`}
            >
              {QUALITY_LABEL[q]}
            </button>
          ))}
        </div>
      </Field>
      <div className="text-[10.5px] leading-relaxed text-zinc-500">
        {prompt ? (
          <>
            Prompt collegato: <span className="text-zinc-300">{prompt.slice(0, 140)}{prompt.length > 140 && "…"}</span>
          </>
        ) : (
          "Nessun Prompt collegato."
        )}
      </div>
      <div className="flex items-center gap-2">
        <PrimaryBtn onClick={() => generateImage(node.id)} busy={busy}>
          <Play size={11} fill="currentColor" /> Genera
        </PrimaryBtn>
        {result?.cached && <span className="text-[10px] text-zinc-500">riusata dalla cache · $0</span>}
      </div>
      <ErrLine id={node.id} />
      <p className="text-[10px] leading-relaxed text-zinc-600">
        Stesso prompt + stessa qualità = riuso automatico dalla cache, costo zero. Le generazioni restano nella history
        del blocco (frecce ‹ › sulla card).
      </p>
    </div>
  );
}

function OverlayInspector({ node }: { node: Node }) {
  const d = node.data as OverlayData;
  const { updateNodeData } = useFlowStore.getState();
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const ov = d.overlay as OverlaySpec;
  const input = findInputNode(nodes, edges, node.id, "in");
  const out = input ? nodeOutput(nodes, edges, input) : null;
  const set = (patch: Partial<OverlaySpec>) => updateNodeData(node.id, { overlay: { ...ov, ...patch } });
  const outline = ov.style === "outline";

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <OverlayPreview spec={ov} width={170} src={out ? `/api/assets/${out.assetKey}?norm=1` : null} className="rounded-xl" />
      </div>
      <Field label="Testo" hint="a capo = nuova riga">
        <textarea className={inputCls} rows={3} value={ov.text} onChange={(e) => set({ text: e.target.value })} />
      </Field>
      <Field label="Stile">
        <div className="grid grid-cols-2 gap-1 rounded-full border border-[#2a2a30] bg-[#1d1d21] p-1">
          {(["bar", "outline"] as const).map((st) => (
            <button
              key={st}
              onClick={() => set({ style: st })}
              className={`rounded-full py-1 text-[10.5px] font-medium transition ${
                (ov.style ?? "bar") === st ? "bg-white text-black" : "text-zinc-500 hover:text-zinc-200"
              }`}
            >
              {st === "bar" ? "Barra" : "Contorno"}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Dimensione" hint={`${ov.fontSizePx}px`}>
        <input type="range" min={28} max={120} value={ov.fontSizePx} onChange={(e) => set({ fontSizePx: Number(e.target.value) })} className="w-full" />
      </Field>
      <Field label="Posizione verticale" hint={`${ov.yPct}%`}>
        <input type="range" min={4} max={96} value={ov.yPct} onChange={(e) => set({ yPct: Number(e.target.value) })} className="w-full" />
      </Field>
      {outline ? (
        <Field label="Spessore contorno" hint={`${ov.strokePx ?? 9}px`}>
          <input type="range" min={2} max={26} value={ov.strokePx ?? 9} onChange={(e) => set({ strokePx: Number(e.target.value) })} className="w-full" />
        </Field>
      ) : (
        <Field label="Opacità sfondo" hint={`${Math.round(ov.barOpacity * 100)}%`}>
          <input type="range" min={0} max={1} step={0.05} value={ov.barOpacity} onChange={(e) => set({ barOpacity: Number(e.target.value) })} className="w-full" />
        </Field>
      )}
      <Field label="Larghezza massima" hint={`${ov.maxWidthPct}%`}>
        <input type="range" min={40} max={100} value={ov.maxWidthPct} onChange={(e) => set({ maxWidthPct: Number(e.target.value) })} className="w-full" />
      </Field>
      <div className="flex items-end gap-5">
        <Field label="Testo">
          <input type="color" value={ov.textColor} onChange={(e) => set({ textColor: e.target.value })} />
        </Field>
        <Field label={outline ? "Contorno" : "Sfondo"}>
          <input type="color" value={ov.barColor} onChange={(e) => set({ barColor: e.target.value })} />
        </Field>
        <button
          onClick={() => set({ textColor: ov.barColor, barColor: ov.textColor })}
          className="mb-px h-9 rounded-lg border border-[#2e2e34] bg-[#202024] px-3 text-[11px] font-medium text-zinc-300 transition hover:border-[#454550] hover:text-white"
          title="Inverti i due colori"
        >
          Inverti
        </button>
      </div>
      <p className="text-[10px] leading-relaxed text-zinc-600">
        {outline
          ? "Testo con contorno (es. bianco con bordo nero). Usa “Inverti” per nero con bordo bianco."
          : "Testo su barra scura. Cambia stile in “Contorno” per il testo bordato."}{" "}
        Il testo è un livello separato: si stampa solo in export, modificarlo non costa nulla.
      </p>
    </div>
  );
}

function CarouselInspector({ node }: { node: Node }) {
  const d = node.data as CarouselData;
  const busy = useFlowStore((s) => !!s.busy[node.id]);
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const { slides, missing } = collectSlides(nodes, edges, node);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="text-[11px] text-zinc-400">{slides.length} slide pronte per l&apos;export</div>
        {missing.map((m, i) => (
          <div key={i} className="text-[10px] text-amber-400/90">
            · {m}
          </div>
        ))}
      </div>
      <PrimaryBtn onClick={() => exportCarousel(node.id)} busy={busy}>
        <Download size={11} /> Esporta PNG
      </PrimaryBtn>
      <ErrLine id={node.id} />
      <ExportLinks exp={d.lastExport} />
      <p className="text-[10px] leading-relaxed text-zinc-600">
        Ordine di pubblicazione: Hook, Slide 1…{d.bodyCount}, CTA. PNG già 1080×1920 con i testi stampati.
      </p>
    </div>
  );
}

function VariantsInspector({ node }: { node: Node }) {
  const d = node.data as VariantsData;
  const busy = useFlowStore((s) => !!s.busy[node.id]);
  const { updateNodeData } = useFlowStore.getState();
  const hookCount = d.hookTexts.split("\n").map((s) => s.trim()).filter(Boolean).length;

  return (
    <div className="space-y-4">
      <Field label="Testi hook" hint={`uno per riga · ${hookCount}`}>
        <textarea
          className={inputCls}
          rows={7}
          value={d.hookTexts}
          onChange={(e) => updateNodeData(node.id, { hookTexts: e.target.value })}
          placeholder={"POV: hai scoperto questo trucco\n3 errori che fai ogni giorno\nNessuno te lo dice ma…"}
        />
      </Field>
      <label className="flex items-center gap-2.5 text-[11.5px] text-zinc-300">
        <input type="checkbox" checked={d.shuffleBody} onChange={(e) => updateNodeData(node.id, { shuffleBody: e.target.checked })} />
        Mescola l&apos;ordine delle slide centrali
      </label>
      {d.shuffleBody && (
        <Field label="Slide bloccate" hint="es. 1,3 — non si spostano">
          <input className={inputCls} value={d.locked} onChange={(e) => updateNodeData(node.id, { locked: e.target.value })} />
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Max varianti">
          <input
            type="number"
            min={1}
            max={100}
            className={inputCls}
            value={d.maxVariants}
            onChange={(e) => updateNodeData(node.id, { maxVariants: Number(e.target.value) || 10 })}
          />
        </Field>
        <Field label="Seed" hint="stesso seed = stesso mix">
          <input type="number" className={inputCls} value={d.seed} onChange={(e) => updateNodeData(node.id, { seed: Number(e.target.value) || 42 })} />
        </Field>
      </div>
      <PrimaryBtn onClick={() => runVariants(node.id)} busy={busy}>
        <Play size={11} fill="currentColor" /> Genera varianti — AI $0
      </PrimaryBtn>
      <ErrLine id={node.id} />
      <ExportLinks exp={d.lastExport} />
    </div>
  );
}

// ---------- entry ----------

const TITLES: Record<string, (n: number) => string> = {
  prompt: (n) => `Prompt #${n}`,
  imageGen: (n) => `Immagine #${n}`,
  upload: (n) => `Upload #${n}`,
  overlay: (n) => `Testo #${n}`,
  carousel: (n) => `Carosello #${n}`,
  variants: (n) => `Varianti #${n}`,
};

export function Inspector() {
  const selectedId = useFlowStore((s) => s.selectedId);
  const nodes = useFlowStore((s) => s.nodes);
  const node = nodes.find((n) => n.id === selectedId);

  if (!node)
    return (
      <div className="p-5 text-[11.5px] leading-relaxed text-zinc-500">
        <p className="font-medium text-zinc-400">Seleziona un blocco per modificarlo.</p>
        <p className="mt-4 text-zinc-600">
          Il flusso tipico:
          <br />
          <span className="text-zinc-400">Prompt → Immagine → Testo → Carosello → Varianti</span>
        </p>
        <p className="mt-4 text-zinc-600">
          Collega i pallini: l&apos;uscita di un blocco (destra) entra nell&apos;ingresso del successivo (sinistra).
        </p>
      </div>
    );

  const n = Number((node.data as { n?: number }).n) || 1;

  return (
    <div className="space-y-4 p-4">
      <div className="text-[13px] font-semibold tracking-tight text-zinc-100">
        {TITLES[node.type ?? ""]?.(n) ?? node.type}
      </div>
      {node.type === "prompt" && <PromptInspector node={node} />}
      {node.type === "imageGen" && <ImageGenInspector node={node} />}
      {node.type === "upload" && (
        <p className="text-[10.5px] leading-relaxed text-zinc-600">Scegli o sostituisci il file direttamente sul blocco.</p>
      )}
      {node.type === "overlay" && <OverlayInspector node={node} />}
      {node.type === "carousel" && <CarouselInspector node={node} />}
      {node.type === "variants" && <VariantsInspector node={node} />}
    </div>
  );
}
