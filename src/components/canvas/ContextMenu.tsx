"use client";

import { useEffect, useRef } from "react";

export interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  separator?: boolean;
}

export interface MenuState {
  x: number;
  y: number;
  items: MenuItem[];
}

export function ContextMenu({ menu, onClose }: { menu: MenuState | null; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as globalThis.Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu, onClose]);

  if (!menu) return null;

  // tieni il menu dentro il viewport
  const maxX = typeof window !== "undefined" ? window.innerWidth - 220 : menu.x;
  const maxY = typeof window !== "undefined" ? window.innerHeight - menu.items.length * 32 - 16 : menu.y;

  return (
    <div
      ref={ref}
      style={{ left: Math.min(menu.x, maxX), top: Math.min(menu.y, maxY) }}
      className="fixed z-50 min-w-[200px] overflow-hidden rounded-xl border border-[#2c2c33] bg-[#1c1c20]/95 p-1 shadow-[0_18px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl"
    >
      {menu.items.map((it, i) =>
        it.separator ? (
          <div key={i} className="my-1 h-px bg-[#2a2a30]" />
        ) : (
          <button
            key={i}
            disabled={it.disabled}
            onClick={() => {
              it.onClick?.();
              onClose();
            }}
            className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-left text-[12px] transition disabled:cursor-not-allowed disabled:opacity-30 ${
              it.danger ? "text-red-400 hover:bg-red-500/10" : "text-zinc-300 hover:bg-[#27272d] hover:text-white"
            }`}
          >
            {it.icon && <span className="grid h-4 w-4 place-items-center text-zinc-500">{it.icon}</span>}
            <span className="flex-1">{it.label}</span>
            {it.shortcut && <span className="font-mono text-[10px] text-zinc-600">{it.shortcut}</span>}
          </button>
        )
      )}
    </div>
  );
}
