"use client";

/**
 * A row of pill tabs whose indicator slides between them, adapted from Kokonut UI's Swipe Tabs
 * (https://kokonutui.com, MIT, @dorianbaffier). The labels are drawn twice: once in the resting
 * colour and once in the active colour, clipped to the indicator, so every label is exactly right
 * at every point of the slide with no colour tween.
 */

import { animate, type AnimationPlaybackControls, useMotionValue } from "motion/react";
import { type KeyboardEvent, type ReactNode, useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export interface SlidingTabItem<T extends string> {
  id: T;
  label: ReactNode;
  icon?: ReactNode;
}

interface Rect { left: number; width: number; top: number; height: number }

// Just under critical damping: a firm settle without a wobble.
const SPRING = { type: "spring", stiffness: 420, damping: 38 } as const;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export default function SlidingTabs<T extends string>({
  items,
  value,
  onChange,
  label,
  mode = "tabs",
  className,
  itemClassName = "px-3.5 py-1.5",
  textClassName = "text-[13px] font-semibold leading-5",
}: {
  items: SlidingTabItem<T>[];
  /** The selected id; one not in `items` shows no indicator. */
  value: T | null;
  onChange: (id: T) => void;
  label: string;
  /** "tabs" is a tablist; "nav" marks the current item with aria-current, for module navigation. */
  mode?: "tabs" | "nav";
  className?: string;
  /** Padding of each item; the same classes size the label copy. */
  itemClassName?: string;
  /** Label type, on an inner span so a scoped `button { font: inherit }` rule can't change it. */
  textClassName?: string;
}) {
  const selected = items.findIndex((item) => item.id === value);
  const listRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const rects = useRef<Rect[]>([]);
  const size = useRef({ width: 0, height: 0 });
  const anim = useRef<AnimationPlaybackControls | null>(null);
  const progress = useMotionValue(Math.max(selected, 0));
  const visible = useRef(selected >= 0);

  const paint = useCallback((p: number) => {
    const overlay = overlayRef.current;
    const all = rects.current;
    if (!overlay || !all.length) return;
    if (!visible.current) {
      overlay.style.clipPath = "inset(0 100% 0 0)";
      return;
    }
    const last = all.length - 1;
    const clamped = Math.min(Math.max(p, 0), last);
    const i = Math.min(Math.floor(clamped), Math.max(last - 1, 0));
    const a = all[i];
    const b = all[Math.min(i + 1, last)];
    const t = clamped - i;
    const left = lerp(a.left, b.left, t);
    const width = lerp(a.width, b.width, t);
    const right = size.current.width - left - width;
    const bottom = size.current.height - a.top - a.height;
    overlay.style.clipPath = `inset(${a.top}px ${right}px ${bottom}px ${left}px round ${a.height / 2}px)`;
  }, []);

  // Measure the tabs before paint, and again on resize and font load.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    let alive = true;
    const measure = () => {
      if (!alive) return;
      size.current = { width: list.offsetWidth, height: list.offsetHeight };
      rects.current = tabRefs.current.slice(0, items.length).map((tab) =>
        tab ? { left: tab.offsetLeft, width: tab.offsetWidth, top: tab.offsetTop, height: tab.offsetHeight } : { left: 0, width: 0, top: 0, height: 0 }
      );
      paint(progress.get());
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    document.fonts?.ready.then(measure).catch(() => undefined);
    return () => {
      alive = false;
      observer.disconnect();
    };
  }, [items.length, paint, progress]);

  useEffect(() => progress.on("change", paint), [paint, progress]);

  // Follow the selection: spring there, or jump when nothing was selected before.
  useEffect(() => {
    anim.current?.stop();
    if (selected < 0) {
      visible.current = false;
      paint(progress.get());
      return;
    }
    if (!visible.current) {
      visible.current = true;
      progress.jump(selected);
      paint(selected);
      return;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    anim.current = reduced
      ? animate(progress, selected, { duration: 0.15, ease: EASE_OUT })
      : animate(progress, selected, SPRING);
  }, [selected, paint, progress]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = items.length;
    const next = ({ ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 } as Record<string, number>)[event.key];
    if (next === undefined) return;
    event.preventDefault();
    tabRefs.current[next]?.focus();
    onChange(items[next].id);
  };

  const tabs = mode === "tabs";
  return (
    <div
      aria-label={label}
      className={cn("relative inline-flex max-w-full items-center rounded-full bg-soft/70 p-1", className)}
      ref={listRef}
      role={tabs ? "tablist" : undefined}
    >
      {items.map((item, i) => {
        const isSelected = i === selected;
        return (
          <button
            aria-current={!tabs && isSelected ? "page" : undefined}
            aria-selected={tabs ? isSelected : undefined}
            className={cn(
              "relative flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full text-muted outline-none transition-colors duration-150 ease-out hover:text-ink focus-visible:ring-2 focus-visible:ring-focus-ring",
              itemClassName
            )}
            key={item.id}
            onClick={() => onChange(item.id)}
            onKeyDown={tabs ? (event) => onKeyDown(event, i) : undefined}
            ref={(el) => { tabRefs.current[i] = el; }}
            role={tabs ? "tab" : undefined}
            tabIndex={tabs ? (isSelected || (selected < 0 && i === 0) ? 0 : -1) : undefined}
            type="button"
          >
            {item.icon}
            <span className={textClassName}>{item.label}</span>
          </button>
        );
      })}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center bg-primary p-1"
        ref={overlayRef}
        style={{ clipPath: "inset(0 100% 0 0)" }}
      >
        {items.map((item) => (
          <span className={cn("flex shrink-0 items-center gap-1.5 whitespace-nowrap text-primary-ink", itemClassName)} key={item.id}>
            {item.icon}
            <span className={textClassName}>{item.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
