// Primitivo "scatola" placeholder: rappresenta dove andranno i dati (mockup) prima che esistano.
export function Sk({ w, h = 12, className = "", rounded = "rounded-md" }: { w?: number | string; h?: number | string; className?: string; rounded?: string }) {
  return (
    <div
      className={`animate-pulse bg-[#23232a] ${rounded} ${className}`}
      style={{ width: typeof w === "number" ? `${w}px` : w, height: typeof h === "number" ? `${h}px` : h }}
    />
  );
}
