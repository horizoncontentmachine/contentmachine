"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Image as ImageIcon,
  Layers,
  Loader2,
  Minus,
  Play,
  Plus,
  Shuffle,
  TextCursorInput,
  Trash2,
  Type,
  Upload,
} from "lucide-react";
import { useFlowStore } from "@/store/useFlowStore";
import { findInputNode, nodeOutput, collectSlides } from "@/lib/graphResolve";
import { generateImage, exportCarousel, runVariants } from "@/lib/actions";
import { uploadFile } from "@/lib/clientApi";
import { estimateImageCents, formatCents, QUALITY_LABEL, type ImageQuality } from "@/lib/costs";
import {
  activeResult,
  type CarouselData,
  type ImageGenData,
  type OverlayData,
  type PromptData,
  type UploadData,
  type VariantsData,
} from "@/lib/nodeData";
import type { OverlaySpec } from "@/lib/types";
import { OverlayPreview } from "@/components/OverlayPreview";
import { PLATFORM_FORMAT } from "@/lib/formats";

// ---------- primitive ----------

function Card({
  selected,
  width,
  children,
}: {
  selected?: boolean;
  width: number;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{ width }}
      className={`rounded-2xl border bg-[#19191c] shadow-[0_14px_40px_rgba(0,0,0,0.5)] transition-colors duration-150 ${
        selected
          ? "border-zinc-400/70 ring-1 ring-zinc-400/20"
          : "border-[#2a2a30] hover:border-[#3c3c44]"
      }`}
    >
      {children}
    </div>
  );
}

function Head({
  icon,
  title,
  right,
}: {
  icon: React.ReactNode;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex h-9 items-center gap-2 px-3">
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-[6px] bg-[#26262c] text-zinc-400">
        {icon}
      </span>
      <span className="flex-1 truncate text-[11px] font-medium text-zinc-300">{title}</span>
      {right}
    </div>
  );
}

function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-[#2e2e34] bg-[#202024] px-2 py-[3px] text-[9px] font-medium text-zinc-400 ${className ?? ""}`}
    >
      {children}
    </span>
  );
}

function RoundBtn({
  onClick,
  disabled,
  busy,
  icon,
  label,
}: {
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      title={label}
      onClick={onClick}
      disabled={disabled || busy}
      className="nodrag grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-35"
    >
      {busy ? <Loader2 size={12} className="animate-spin" /> : icon}
    </button>
  );
}

function NodeError({ id }: { id: string }) {
  const msg = useFlowStore((s) => s.errors[id]);
  if (!msg) return null;
  return <div className="px-3 pb-2.5 text-[9.5px] leading-snug text-red-400/90">{msg}</div>;
}

function GhostIconBtn({ onClick, children, label }: { onClick: () => void; children: React.ReactNode; label: string }) {
  return (
    <button
      title={label}
      onClick={onClick}
      className="nodrag grid h-5 w-5 place-items-center rounded-md text-zinc-500 transition hover:bg-[#26262c] hover:text-zinc-200"
    >
      {children}
    </button>
  );
}

// ---------- Prompt ----------

export function PromptNode({ id, data, selected }: NodeProps) {
  const d = data as PromptData;
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  return (
    <Card selected={selected} width={248}>
      <Head icon={<TextCursorInput size={11} />} title={`Prompt #${d.n}`} />
      <textarea
        className="nodrag nowheel block w-full resize-none bg-transparent px-3 pb-3 text-[11px] leading-relaxed text-zinc-300 placeholder-zinc-600 outline-none"
        rows={6}
        value={d.text}
        placeholder={"Descrivi l'immagine…\nSoggetto centrale, luce naturale, stile fotorealistico."}
        onChange={(e) => updateNodeData(id, { text: e.target.value })}
      />
      <Handle type="source" position={Position.Right} id="out" />
    </Card>
  );
}

// ---------- Immagine (generatore) ----------

function ImagePreview({ src, busy, empty, ratio }: { src: string | null; busy?: boolean; empty: string; ratio: number }) {
  return (
    <div className="relative px-1.5">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" style={{ aspectRatio: ratio }} className="w-full rounded-xl object-cover" draggable={false} />
      ) : (
        <div
          style={{ aspectRatio: ratio }}
          className="grid w-full place-items-center rounded-xl border border-dashed border-[#2e2e34] bg-[#151518] px-5 text-center text-[10px] leading-relaxed text-zinc-600"
        >
          {empty}
        </div>
      )}
      {busy && (
        <div className="absolute inset-1.5 grid place-items-center rounded-xl bg-black/50 backdrop-blur-[2px]">
          <Loader2 size={18} className="animate-spin text-zinc-200" />
        </div>
      )}
    </div>
  );
}

export function ImageGenNode({ id, data, selected }: NodeProps) {
  const d = data as ImageGenData;
  const busy = useFlowStore((s) => !!s.busy[id]);
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const fmt = PLATFORM_FORMAT[useFlowStore((s) => s.activePlatform())];
  const result = activeResult(d);
  const cost = estimateImageCents(d.quality as ImageQuality);

  return (
    <Card selected={selected} width={248}>
      <Handle type="target" position={Position.Left} id="prompt" style={{ top: 48 }} />
      <Handle type="target" position={Position.Left} id="ref" style={{ top: 86 }} />
      {!result && (
        <>
          <span className="pointer-events-none absolute left-2.5 top-[42px] text-[7.5px] font-medium uppercase tracking-[0.08em] text-zinc-600">
            prompt
          </span>
          <span className="pointer-events-none absolute left-2.5 top-[80px] text-[7.5px] font-medium uppercase tracking-[0.08em] text-zinc-600">
            ref
          </span>
        </>
      )}
      <Handle type="source" position={Position.Right} id="out" />

      <Head
        icon={<ImageIcon size={11} />}
        title={`Immagine #${d.n}`}
        right={
          <div className="flex items-center gap-0.5">
            {d.results.length > 1 && (
              <>
                <GhostIconBtn label="Precedente" onClick={() => updateNodeData(id, { activeIndex: Math.max(0, d.activeIndex - 1) })}>
                  <ChevronLeft size={11} />
                </GhostIconBtn>
                <span className="px-0.5 font-mono text-[9px] text-zinc-500">
                  {d.activeIndex + 1}/{d.results.length}
                </span>
                <GhostIconBtn
                  label="Successiva"
                  onClick={() => updateNodeData(id, { activeIndex: Math.min(d.results.length - 1, d.activeIndex + 1) })}
                >
                  <ChevronRight size={11} />
                </GhostIconBtn>
              </>
            )}
            {result && (
              <a
                href={`/api/assets/${result.key}?norm=1`}
                download
                title="Scarica"
                className="nodrag grid h-5 w-5 place-items-center rounded-md text-zinc-500 transition hover:bg-[#26262c] hover:text-zinc-200"
              >
                <Download size={11} />
              </a>
            )}
          </div>
        }
      />

      <ImagePreview
        src={result ? `/api/assets/${result.key}?norm=1` : null}
        busy={busy}
        ratio={fmt.w / fmt.h}
        empty="Collega un Prompt e premi ▶"
      />

      <div className="space-y-2.5 px-3 pb-3 pt-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip className="whitespace-nowrap">GPT Image 2</Chip>
          <Chip className="whitespace-nowrap">{fmt.ratio}</Chip>
          <select
            className="nodrag cursor-pointer rounded-full border border-[#2e2e34] bg-[#202024] px-2.5 py-[3px] text-[9px] font-medium text-zinc-400 outline-none transition hover:border-[#454550]"
            value={d.quality}
            title={`Qualità — costo ~${formatCents(cost)}`}
            onChange={(e) => updateNodeData(id, { quality: e.target.value })}
          >
            {(Object.keys(QUALITY_LABEL) as ImageQuality[]).map((q) => (
              <option key={q} value={q}>
                {QUALITY_LABEL[q]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-mono text-[9px] text-zinc-600">
            {result?.cached ? "riuso · $0" : result?.costCents != null ? formatCents(result.costCents) : `~${formatCents(cost)}`}
          </span>
          <RoundBtn onClick={() => generateImage(id)} busy={busy} icon={<Play size={11} fill="currentColor" />} label="Genera" />
        </div>
      </div>
      <NodeError id={id} />
    </Card>
  );
}

// ---------- Upload ----------

export function UploadNode({ id, data, selected }: NodeProps) {
  const d = data as UploadData;
  const busy = useFlowStore((s) => !!s.busy[id]);
  const fmt = PLATFORM_FORMAT[useFlowStore((s) => s.activePlatform())];
  const { updateNodeData, setBusy, setError } = useFlowStore.getState();

  const onFile = async (f: File | null) => {
    if (!f) return;
    setError(id, null);
    setBusy(id, true);
    try {
      const r = await uploadFile(f);
      if (r.asset.kind !== "image") throw new Error("Carica un'immagine");
      updateNodeData(id, { result: { key: r.asset.key, kind: "image" }, fileName: f.name });
    } catch (e) {
      setError(id, String(e));
    } finally {
      setBusy(id, false);
    }
  };

  return (
    <Card selected={selected} width={216}>
      <Handle type="source" position={Position.Right} id="out" />
      <Head icon={<Upload size={11} />} title={`Upload #${d.n}`} />
      {d.result ? (
        <ImagePreview src={`/api/assets/${d.result.key}?norm=1`} busy={busy} ratio={fmt.w / fmt.h} empty="" />
      ) : (
        <div className="px-1.5">
          <label className="nodrag grid aspect-[9/16] w-full cursor-pointer place-items-center rounded-xl border border-dashed border-[#2e2e34] bg-[#151518] px-5 text-center text-[10px] leading-relaxed text-zinc-600 transition hover:border-zinc-500 hover:text-zinc-400">
            {busy ? <Loader2 size={16} className="animate-spin" /> : "Clicca per scegliere un'immagine"}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>
      )}
      <div className="flex items-center gap-2 px-3 py-3">
        <Chip className="min-w-0 flex-1">
          <span className="truncate">{d.fileName || "nessun file"}</span>
        </Chip>
        {d.result && (
          <div className="flex shrink-0 items-center gap-1">
            <label className="nodrag cursor-pointer rounded-md px-1.5 py-1 text-[9px] font-medium text-zinc-500 transition hover:bg-[#26262c] hover:text-zinc-200">
              sostituisci
              <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
            </label>
            <button
              onClick={() => {
                setError(id, null);
                updateNodeData(id, { result: null, fileName: "" });
              }}
              title="Rimuovi immagine"
              className="nodrag grid h-6 w-6 place-items-center rounded-md text-zinc-500 transition hover:bg-[#26262c] hover:text-red-400"
            >
              <Trash2 size={11} />
            </button>
          </div>
        )}
      </div>
      <NodeError id={id} />
    </Card>
  );
}

// ---------- Testo (overlay) ----------

export function OverlayNode({ id, data, selected }: NodeProps) {
  const d = data as OverlayData;
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const input = findInputNode(nodes, edges, id, "in");
  const out = input ? nodeOutput(nodes, edges, input) : null;
  const ov = d.overlay as OverlaySpec;
  const fmtH = PLATFORM_FORMAT[useFlowStore((s) => s.activePlatform())].h;

  return (
    <Card selected={selected} width={224}>
      <Handle type="target" position={Position.Left} id="in" />
      <Handle type="source" position={Position.Right} id="out" />
      <Head icon={<Type size={11} />} title={`Testo #${d.n}`} />
      <div className="px-1.5">
        <OverlayPreview
          spec={ov}
          width={209}
          fmtH={fmtH}
          src={out ? `/api/assets/${out.assetKey}?norm=1` : null}
          className="rounded-xl"
        />
      </div>
      <textarea
        className="nodrag nowheel block w-full resize-none bg-transparent px-3 pb-1 pt-2.5 text-[11px] leading-relaxed text-zinc-300 placeholder-zinc-600 outline-none"
        rows={2}
        value={ov.text}
        placeholder="Testo dell'overlay…"
        onChange={(e) => updateNodeData(id, { overlay: { ...ov, text: e.target.value } })}
      />
      <div className="px-3 pb-2.5 text-[8.5px] text-zinc-600">
        Dimensione e posizione nel pannello a destra · si applica solo in export
      </div>
    </Card>
  );
}

// ---------- Carosello ----------

const HEAD_H = 36;
const ROW_H = 26;

export function CarouselNode({ id, data, selected }: NodeProps) {
  const d = data as CarouselData;
  const busy = useFlowStore((s) => !!s.busy[id]);
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const updateNodeData = useFlowStore((s) => s.updateNodeData);

  const setCount = (n: number) => {
    const clamped = Math.max(1, Math.min(8, n));
    updateNodeData(id, { bodyCount: clamped });
    const { edges } = useFlowStore.getState();
    useFlowStore.setState({
      edges: edges.filter((e) => {
        if (e.target !== id || !e.targetHandle?.startsWith("body-")) return true;
        return Number(e.targetHandle.split("-")[1]) < clamped;
      }),
    });
  };

  const row = (handle: string, label: string, i: number) => {
    const src = findInputNode(nodes, edges, id, handle);
    const out = src ? nodeOutput(nodes, edges, src) : null;
    return (
      <div key={handle} className="flex items-center gap-2" style={{ height: ROW_H }}>
        <Handle
          type="target"
          position={Position.Left}
          id={handle}
          style={{ top: HEAD_H + 4 + i * ROW_H + ROW_H / 2 }}
        />
        {out ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/assets/${out.assetKey}?norm=1`} alt="" className="h-[22px] w-[12.5px] rounded-[3px] object-cover" />
        ) : (
          <span className={`h-[22px] w-[12.5px] rounded-[3px] border border-dashed ${src ? "border-amber-600/60" : "border-[#33333a]"}`} />
        )}
        <span className={`flex-1 text-[10px] font-medium ${out ? "text-zinc-300" : "text-zinc-600"}`}>{label}</span>
        {out && out.overlay?.text?.trim() && <Type size={9} className="text-zinc-600" />}
      </div>
    );
  };

  const rows = [row("hook", "Hook", 0)];
  for (let i = 0; i < d.bodyCount; i++) rows.push(row(`body-${i}`, `Slide ${i + 1}`, i + 1));
  rows.push(row("cta", "CTA — opzionale", d.bodyCount + 1));

  const ready = collectSlides(nodes, edges, { id, type: "carousel", data: d, position: { x: 0, y: 0 } } as never);

  return (
    <Card selected={selected} width={248}>
      <Handle type="source" position={Position.Right} id="out" />
      <Head icon={<Layers size={11} />} title={`Carosello #${d.n}`} right={<Chip>{ready.slides.length} pronte</Chip>} />
      <div className="px-3 pt-1">{rows}</div>
      <div className="flex items-center gap-1.5 px-2.5 py-2.5">
        <div className="flex items-center gap-1 rounded-full border border-[#2e2e34] bg-[#202024] px-1.5 py-[2px]">
          <button onClick={() => setCount(d.bodyCount - 1)} className="nodrag grid h-4 w-4 place-items-center rounded-full text-zinc-500 hover:text-zinc-200">
            <Minus size={9} />
          </button>
          <span className="text-[9px] font-medium text-zinc-400">{d.bodyCount} slide</span>
          <button onClick={() => setCount(d.bodyCount + 1)} className="nodrag grid h-4 w-4 place-items-center rounded-full text-zinc-500 hover:text-zinc-200">
            <Plus size={9} />
          </button>
        </div>
        <div className="flex-1" />
        {d.lastExport?.zipUrl && (
          <a href={d.lastExport.zipUrl} className="nodrag text-[9px] font-medium text-zinc-400 underline-offset-2 hover:text-white hover:underline">
            ZIP ({d.lastExport.count})
          </a>
        )}
        <RoundBtn onClick={() => exportCarousel(id)} busy={busy} icon={<Download size={11} />} label="Esporta PNG" />
      </div>
      <NodeError id={id} />
    </Card>
  );
}

// ---------- Varianti ----------

export function VariantsNode({ id, data, selected }: NodeProps) {
  const d = data as VariantsData;
  const busy = useFlowStore((s) => !!s.busy[id]);
  const hookCount = d.hookTexts.split("\n").map((s) => s.trim()).filter(Boolean).length;

  return (
    <Card selected={selected} width={240}>
      <Handle type="target" position={Position.Left} id="in" />
      <Head icon={<Shuffle size={11} />} title={`Varianti #${d.n}`} />
      <div className="flex flex-wrap items-center gap-1.5 px-3 pb-1">
        <Chip>{hookCount} hook</Chip>
        {d.shuffleBody && <Chip>riordino slide</Chip>}
        <Chip>max {d.maxVariants}</Chip>
        <Chip className="border-transparent bg-transparent text-zinc-600">AI $0</Chip>
      </div>
      <div className="px-3 pb-1 text-[8.5px] leading-relaxed text-zinc-600">
        Stesse immagini, hook e ordine diversi. Configura nel pannello a destra.
      </div>
      <div className="flex items-center gap-1.5 px-2.5 py-2.5">
        {d.lastExport?.zipUrl && (
          <a href={d.lastExport.zipUrl} className="nodrag text-[9px] font-medium text-zinc-400 underline-offset-2 hover:text-white hover:underline">
            Scarica ZIP ({d.lastExport.count} varianti)
          </a>
        )}
        <div className="flex-1" />
        <RoundBtn onClick={() => runVariants(id)} busy={busy} icon={<Play size={11} fill="currentColor" />} label="Genera varianti" />
      </div>
      <NodeError id={id} />
    </Card>
  );
}

export const nodeTypes = {
  prompt: PromptNode,
  imageGen: ImageGenNode,
  upload: UploadNode,
  overlay: OverlayNode,
  carousel: CarouselNode,
  variants: VariantsNode,
};
