"use client";

/**
 * Stack Panel, adapted from Kokonut UI (https://kokonutui.com, MIT, @dorianbaffier):
 * colours moved to the admin palette tokens, the demo removed, and pages that
 * disappear (a session that stopped charging) are popped automatically.
 */

import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import {
  AnimatePresence,
  animate,
  MotionConfig,
  motion,
  type PanInfo,
  useAnimate,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { type KeyboardEvent, type ReactNode, type RefObject, useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { cn } from "@/lib/utils";

export interface StackRow {
  id: string;
  label: ReactNode;
  /** Muted text on the right, like the current value of a setting. */
  detail?: ReactNode;
  /** Id of the page this row opens. */
  to?: string;
  /** Anything else on the right: a badge, a bar. */
  trailing?: ReactNode;
  onSelect?: () => void;
  /** Shows a check, for rows that pick one option of a section. */
  selected?: boolean;
  /** Small coloured dot before the label. */
  dot?: string;
  tone?: "default" | "danger";
}

export interface StackSection {
  title?: string;
  rows: StackRow[];
  /** Small print under the section. */
  footer?: ReactNode;
}

export interface StackPage {
  title: string;
  /** Shown at the right of the header: the page's state at a glance, without opening a row. */
  trailing?: ReactNode;
  sections: StackSection[];
}

export interface StackPanelProps {
  pages: Record<string, StackPage>;
  /** The page the panel starts on. */
  root: string;
  className?: string;
}

// iOS pushes with a curve close to this; the page settles without bounce.
const PUSH = { type: "spring", duration: 0.42, bounce: 0 } as const;
const HEIGHT = { type: "spring", duration: 0.38, bounce: 0 } as const;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;
// The page underneath moves a third as far as the one on top.
const PARALLAX = 0.3;
// Let go past this share of the width, or flick faster, and the page pops.
const POP_DISTANCE = 0.35;
const POP_VELOCITY = 500;

interface Origin {
  /** The tapped row's label, relative to the panel. */
  left: number;
  top: number;
  height: number;
  fontSize: number;
}

/** The header title. Pushed in from a row, it flies from that row's label up into the header. */
function Title({ text, origin, direction, panelRef, align }: { text: string; origin: Origin | null; direction: 1 | -1; panelRef: RefObject<HTMLDivElement | null>; align: "left" | "center" }) {
  const [scope, run] = useAnimate<HTMLSpanElement>();
  const reduced = useReducedMotion();

  useLayoutEffect(() => {
    const el = scope.current;
    const panel = panelRef.current;
    if (!(el && panel)) return;
    if (!origin || reduced) {
      run(el, { opacity: [0, 1], x: [direction * 24, 0] }, { duration: reduced ? 0 : 0.28, ease: EASE_OUT });
      return;
    }
    const box = panel.getBoundingClientRect();
    const own = el.getBoundingClientRect();
    const fontSize = Number.parseFloat(getComputedStyle(el).fontSize);
    const scale = origin.fontSize / fontSize;
    const dx = origin.left - (own.left - box.left);
    const dy = origin.top + origin.height / 2 - (own.top - box.top + own.height / 2);
    // Placed at the row before the first frame, so it never flashes in the header first.
    el.style.setProperty("transform", `translateX(${dx}px) translateY(${dy}px) scale(${scale})`);
    run(el, { x: [dx, 0], y: [dy, 0], scale: [scale, 1], opacity: [1, 1] }, PUSH);
  }, [scope, run, origin, direction, panelRef, reduced]);

  return (
    <motion.span
      className={cn(
        "absolute top-1/2 max-w-[55%] -translate-y-1/2 truncate text-[15px] font-semibold text-ink",
        align === "left" ? "left-3" : "inset-x-0 mx-auto w-fit",
      )}
      exit={{ opacity: 0, x: direction * -40, transition: { duration: 0.18, ease: EASE_OUT } }}
      ref={scope}
      style={{ transformOrigin: "left center" }}
    >
      {text}
    </motion.span>
  );
}

function Page({ page, onOpen, measureRef }: { page: StackPage; onOpen: (row: StackRow, label: HTMLElement) => void; measureRef?: (el: HTMLDivElement | null) => void }) {
  return (
    <div className="flex flex-col gap-4 px-3 pt-2 pb-4" ref={measureRef}>
      {page.sections.map((section, index) => (
        // Sections are a fixed, ordered list.
        <section key={index}>
          {section.title && <h3 className="mb-1.5 px-3 text-xs font-medium text-muted">{section.title}</h3>}
          <ul className="divide-y divide-line overflow-hidden rounded-xl bg-raised">
            {section.rows.map((row) => (
              <li key={row.id}>
                <RowView onOpen={onOpen} row={row} />
              </li>
            ))}
          </ul>
          {section.footer && <div className="mt-1.5 px-3 text-xs leading-5 text-muted">{section.footer}</div>}
        </section>
      ))}
    </div>
  );
}

function RowView({ row, onOpen }: { row: StackRow; onOpen: (row: StackRow, label: HTMLElement) => void }) {
  const labelRef = useRef<HTMLSpanElement>(null);
  const interactive = Boolean(row.to || row.onSelect);
  const content = (
    <>
      {row.dot && <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", row.dot)} />}
      <span
        className={cn("min-w-0 flex-1 truncate text-left text-sm", row.tone === "danger" ? "text-red-600" : "text-ink")}
        ref={labelRef}
      >
        {row.label}
      </span>
      {row.detail != null && <span className="max-w-[55%] shrink-0 truncate text-sm tabular-nums text-muted">{row.detail}</span>}
      {row.trailing}
      {row.selected !== undefined && (
        <Check aria-hidden="true" className={cn("size-4 shrink-0 text-ink", !row.selected && "invisible")} />
      )}
      {row.to && <ChevronRight aria-hidden="true" className="-mr-1 size-4 shrink-0 text-muted" />}
    </>
  );
  const base = "flex min-h-11 w-full items-center gap-2 px-3 py-2";
  if (!interactive) return <div className={base}>{content}</div>;
  const onClick = () => {
    if (labelRef.current) onOpen(row, labelRef.current);
  };
  return (
    <button
      aria-pressed={row.selected}
      className={cn(base, "outline-none transition-colors duration-150 hover:bg-soft/60 focus-visible:bg-soft/60 active:bg-soft")}
      data-row={row.id}
      onClick={onClick}
      type="button"
    >
      {content}
    </button>
  );
}

/**
 * A panel that drills into pages, like settings on a phone. A row opens its page from the
 * right while its label flies up to become the title; swipe the page right, or press Back
 * or Escape, to return.
 */
export function StackPanel({ pages, root, className }: StackPanelProps) {
  const [trail, setTrail] = useState<string[]>([root]);
  // A page that no longer exists (its session stopped) drops out of the stack.
  const kept = trail.filter((id) => pages[id]);
  const stack = kept.length ? kept : [root];
  const setStack = (update: (s: string[]) => string[]) => setTrail((s) => update(s.filter((id) => pages[id])));
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [direction, setDirection] = useState<1 | -1>(1);
  // "auto" until the first page is measured, so the server render has a height too.
  const [height, setHeight] = useState<number | "auto">("auto");
  const [busy, setBusy] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const observer = useRef<ResizeObserver | null>(null);
  // The row that opened each page, so Back can hand focus to it again.
  const openers = useRef<string[]>([]);
  // The top page's offset; the page underneath is derived from it, so a push, a pop and a
  // swipe all move both pages together.
  const x = useMotionValue(0);
  const [width, setWidth] = useState(360);
  const underX = useTransform(x, (v) => -PARALLAX * (width - v));
  const shade = useTransform(x, [0, width], [0.06, 0]);

  const top = stack.at(-1) ?? root;
  const under = stack.length > 1 ? stack.at(-2) : undefined;
  const parent = under ? pages[under] : undefined;

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const watch = new ResizeObserver(() => setWidth(body.clientWidth));
    watch.observe(body);
    return () => {
      watch.disconnect();
      observer.current?.disconnect();
    };
  }, []);


  // The panel's height follows the page on top.
  const measure = (el: HTMLDivElement | null) => {
    observer.current?.disconnect();
    if (!el) return;
    observer.current = new ResizeObserver(() => setHeight(el.offsetHeight));
    observer.current.observe(el);
  };

  const push = (row: StackRow, label: HTMLElement) => {
    row.onSelect?.();
    if (!(row.to && pages[row.to]) || busy) return;
    const box = panelRef.current?.getBoundingClientRect();
    const rect = label.getBoundingClientRect();
    setOrigin(
      box
        ? { left: rect.left - box.left, top: rect.top - box.top, height: rect.height, fontSize: Number.parseFloat(getComputedStyle(label).fontSize) }
        : null
    );
    setDirection(1);
    setBusy(true);
    x.set(width);
    const to = row.to;
    openers.current.push(row.id);
    flushSync(() => setStack((s) => [...s, to]));
    animate(x, 0, PUSH).then(() => setBusy(false));
    backRef.current?.focus({ preventScroll: true });
  };

  const pop = () => {
    if (stack.length < 2 || busy) return;
    setOrigin(null);
    setDirection(-1);
    setBusy(true);
    const opener = openers.current.pop();
    const hadFocus = panelRef.current?.contains(document.activeElement);
    animate(x, width, { ...PUSH, duration: 0.34 }).then(() => {
      // Both in one frame: the old top unmounts as the offset resets.
      flushSync(() => setStack((s) => s.slice(0, -1)));
      x.set(0);
      setBusy(false);
      // The focused Back button or row just unmounted; land on the row that opened the page.
      if (hadFocus && opener) {
        const rows = bodyRef.current?.querySelectorAll<HTMLElement>(`[data-row="${CSS.escape(opener)}"]`);
        const row = [...(rows ?? [])].find((el) => !el.closest("[inert]"));
        row?.focus({ preventScroll: true });
      }
    });
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (x.get() > width * POP_DISTANCE || info.velocity.x > POP_VELOCITY) pop();
    else animate(x, 0, PUSH);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && stack.length > 1) {
      event.preventDefault();
      pop();
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      {/* Escape is a shortcut for the Back button. */}
      <div
        className={cn("relative w-full overflow-hidden rounded-2xl border border-line bg-surface", className)}
        onKeyDown={onKeyDown}
        ref={panelRef}
      >
        <div className="relative z-10 flex h-12 items-center border-b border-line bg-surface px-2">
          <AnimatePresence initial={false}>
            {parent && (
              <motion.button
                animate={{ opacity: 1 }}
                className="relative z-10 flex max-w-[30%] items-center rounded-lg py-1.5 pr-2 pl-1 text-sm text-muted outline-none transition-colors duration-150 hover:bg-soft hover:text-ink focus-visible:ring-2 focus-visible:ring-focus-ring"
                exit={{ opacity: 0 }}
                initial={{ opacity: 0 }}
                key="back"
                onClick={pop}
                ref={backRef}
                transition={{ duration: 0.18 }}
                type="button"
              >
                <ChevronLeft aria-hidden="true" className="size-4 shrink-0" />
                <span className="truncate">{parent.title}</span>
              </motion.button>
            )}
          </AnimatePresence>
          <AnimatePresence initial={false}>
            {/* The root page has no Back button, so its title sits at the left edge; a pushed
                page centres between Back and whatever the page puts on the right. */}
            <Title align={parent ? "center" : "left"} direction={direction} key={`${top}-${stack.length}`} origin={origin} panelRef={panelRef} text={pages[top]?.title ?? ""} />
          </AnimatePresence>
          {pages[top]?.trailing && (
            <div className="relative z-10 ml-auto flex items-center gap-2 pr-1 text-xs text-muted">{pages[top].trailing}</div>
          )}
        </div>

        <motion.div animate={{ height }} className="relative" ref={bodyRef} transition={HEIGHT}>
          {under && pages[under] && (
            <motion.div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0" inert key={`${under}-${stack.length - 1}`} style={{ x: underX }}>
              <Page onOpen={() => undefined} page={pages[under]} />
              <motion.div className="absolute inset-0 bg-black" style={{ opacity: shade }} />
            </motion.div>
          )}
          {pages[top] && (
            <motion.div
              className="relative bg-surface"
              drag={stack.length > 1 && !busy ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragDirectionLock
              dragElastic={{ left: 0, right: 1 }}
              dragMomentum={false}
              key={`${top}-${stack.length}`}
              onDragEnd={onDragEnd}
              style={{ x, boxShadow: stack.length > 1 ? "-8px 0 24px -12px rgb(0 0 0 / 0.18)" : "" }}
            >
              <Page measureRef={measure} onOpen={push} page={pages[top]} />
            </motion.div>
          )}
        </motion.div>
      </div>
    </MotionConfig>
  );
}
