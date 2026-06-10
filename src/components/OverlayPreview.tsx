"use client";

import { layoutOverlay } from "@/lib/overlay";
import type { OverlaySpec } from "@/lib/types";

function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return `rgba(0,0,0,${alpha})`;
  const v = parseInt(m[1], 16);
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${alpha})`;
}

// Preview WYSIWYG dell'overlay: stesso algoritmo di layout del flatten server-side.
export function OverlayPreview({
  spec,
  width,
  src,
  videoSrc,
  className,
}: {
  spec: OverlaySpec | null;
  width: number;
  src?: string | null;
  videoSrc?: string | null;
  className?: string;
}) {
  const height = (width * 1920) / 1080;
  const lay = spec ? layoutOverlay(spec, width, height) : null;
  return (
    <div
      className={`relative overflow-hidden rounded bg-neutral-800 ${className ?? ""}`}
      style={{ width, height }}
    >
      {videoSrc ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video src={videoSrc} className="absolute inset-0 h-full w-full object-cover" muted loop autoPlay playsInline />
      ) : src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-[9px] text-neutral-600">
          1080×1920
        </div>
      )}
      {lay &&
        spec &&
        lay.lines.map((l, i) => {
          const outline = spec.style === "outline";
          const strokeW = (spec.strokePx ?? 9) * (width / 1080);
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: "50%",
                transform: "translateX(-50%)",
                top: lay.blockTop + i * lay.lineAdvance,
                height: lay.pillH,
                lineHeight: `${lay.pillH}px`,
                fontSize: lay.fontSize,
                padding: `0 ${lay.padX}px`,
                background: outline ? "transparent" : hexToRgba(spec.barColor, spec.barOpacity),
                color: spec.textColor,
                borderRadius: lay.radius,
                fontWeight: 800,
                whiteSpace: "nowrap",
                fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
                ...(outline
                  ? {
                      WebkitTextStrokeWidth: `${strokeW}px`,
                      WebkitTextStrokeColor: spec.barColor,
                      paintOrder: "stroke" as const,
                    }
                  : {}),
              }}
            >
              {l.text}
            </div>
          );
        })}
    </div>
  );
}
