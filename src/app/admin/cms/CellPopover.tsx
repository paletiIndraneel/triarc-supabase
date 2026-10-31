"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const PANEL_WIDTH = 260;
// Enough room for the longest panel; only used to decide whether it opens below or above.
const PANEL_HEIGHT = 220;

// One label/value line of a popover.
export function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[11px] font-semibold text-muted">{label}</span>
      <span className="text-right text-[12px] text-ink">{value}</span>
    </div>
  );
}

/**
 * A packed table cell that opens a titled panel of the values behind it, so the table can show
 * fewer columns. Click to open; Escape, an outside click or a scroll closes it, and clicking
 * another cell's trigger closes this one first. The panel is fixed-position in a portal because
 * the table scrolls inside overflow-x-auto, which would clip it.
 */
export function CellPopover({ title, trigger, children }: { title: string; trigger: ReactNode; children: ReactNode }) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!position) return;

    function close() {
      setPosition(null);
    }

    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close();
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKey);
    // The table scrolls under the panel, so follow the scroll by closing rather than tracking it.
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [position]);

  function toggle() {
    if (position) {
      setPosition(null);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - PANEL_WIDTH - 8);
    const below = rect.bottom + 6;
    // Opens above the cell instead when the panel would run off the bottom of the window.
    const top = below + PANEL_HEIGHT > window.innerHeight ? Math.max(8, rect.top - PANEL_HEIGHT - 6) : below;
    setPosition({ top, left });
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-expanded={position != null}
        className="-mx-1 rounded px-1 text-left hover:bg-soft"
      >
        {trigger}
      </button>
      {position
        && createPortal(
          <div
            ref={panelRef}
            style={{ top: position.top, left: position.left, width: PANEL_WIDTH }}
            className="fixed z-50 overflow-hidden rounded-xl border border-line bg-surface shadow-xl"
          >
            <p className="bg-primary px-3 py-2 text-[12px] font-bold text-primary-ink">{title}</p>
            <div className="flex flex-col gap-1.5 p-3">{children}</div>
          </div>,
          document.body
        )}
    </>
  );
}
