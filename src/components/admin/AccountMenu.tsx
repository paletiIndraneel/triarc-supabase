"use client";

/**
 * The header's account menu, adapted from Kokonut UI's Account Menu (https://kokonutui.com, MIT,
 * @dorianbaffier). The panel grows out of the trigger and the avatar, name and email travel into
 * its header. It holds only what the admin has: the theme, the set-up modules and Sign out.
 */

import { Check, ChevronsUpDown, LogOut, Monitor, Moon, Sun } from "lucide-react";
import { animate, motion, type Transition, useMotionTemplate, useMotionValue, useReducedMotion } from "motion/react";
import { type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { roleLabel } from "@/lib/adminAccess";
import { supabase } from "@/lib/supabase/billing";
import { cn } from "@/lib/utils";
import LogoutButton from "@/components/admin/LogoutButton";

export type ThemeMode = "light" | "dark" | "system";

export interface AccountMenuItem {
  key: string;
  label: string;
  icon: ReactNode;
  current: boolean;
  onSelect: () => void;
}

const PANEL_W = 288;
const RADIUS = 16;
const SPRING: Transition = { type: "spring", duration: 0.3, bounce: 0 };
const INDICATOR_SPRING: Transition = { type: "spring", duration: 0.25, bounce: 0 };
const INSTANT: Transition = { duration: 0 };
const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const NAV_KEYS = new Set(["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End"]);
const THEMES = [
  { id: "light", label: "Light", Icon: Sun },
  { id: "dark", label: "Dark", Icon: Moon },
  { id: "system", label: "System", Icon: Monitor },
] as const;

const ITEM_CLASS =
  "flex w-full cursor-default items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-sm text-ink outline-none transition-colors duration-100 focus:bg-soft/70";

type Phase = "closed" | "open" | "closing";
type Via = "pointer" | "keyboard";

// A click fired by Enter or Space carries no pointer detail.
const viaOf = (event: MouseEvent): Via => (event.detail === 0 ? "keyboard" : "pointer");

function menuItems(root: HTMLElement | null) {
  return root ? Array.from(root.querySelectorAll<HTMLElement>("[data-menu-item]")) : [];
}

/** Where arrow keys move focus: rows go up and down, the theme options left and right. */
function nextTarget(items: HTMLElement[], active: Element | null, key: string): HTMLElement | undefined {
  if (key === "Home") return items[0];
  if (key === "End") return items.at(-1);
  const current = items.find((item) => item === active);
  if (!current) return key === "ArrowUp" ? items.at(-1) : items[0];
  if (key === "ArrowLeft" || key === "ArrowRight") {
    const row = items.filter((item) => item.dataset.row === current.dataset.row);
    if (row.length < 2) return;
    return row[(row.indexOf(current) + (key === "ArrowRight" ? 1 : -1) + row.length) % row.length];
  }
  const rows = [...new Set(items.map((item) => item.dataset.row))];
  const next = rows[(rows.indexOf(current.dataset.row) + (key === "ArrowDown" ? 1 : -1) + rows.length) % rows.length];
  const candidates = items.filter((item) => item.dataset.row === next);
  return candidates.find((item) => item.getAttribute("aria-checked") === "true") ?? candidates[0];
}

function useAdminUser() {
  const [user, setUser] = useState({ name: "Loading…", email: "" });
  useEffect(() => {
    let mounted = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      const metadata = data.user?.user_metadata ?? {};
      const pick = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
      const name = pick(metadata.display_name) ?? pick(metadata.full_name) ?? pick(metadata.name) ?? (data.user?.email?.split("@")[0] || "User");
      setUser({ name, email: data.user?.email ?? "" });
    });
    return () => { mounted = false; };
  }, []);
  return user;
}

function initialsOf(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0] ?? "").join("").toUpperCase() || "?";
}

/**
 * Avatar, name and second line. Drawn in the trigger while the menu is closed and in the panel
 * header while it is open; shared layout ids let the pieces travel between the two places.
 */
function Identity({ uid, shared, name, sub, transition, stacked }: { uid: string; shared: boolean; name: string; sub: string; transition: Transition; stacked: boolean }) {
  const hidden = shared ? undefined : "invisible";
  return (
    <span className={cn("flex min-w-0", stacked ? "flex-col items-start gap-3" : "items-center gap-2.5")}>
      <motion.span className={cn("relative z-20 block", hidden)} key={shared ? "avatar-shared" : "avatar-static"} layoutId={shared ? `${uid}-avatar` : undefined} transition={transition}>
        <span aria-hidden="true" className={cn("grid shrink-0 select-none place-items-center rounded-full bg-primary text-[11px] font-medium tracking-wide text-primary-ink", stacked ? "size-10" : "size-8")}>
          {initialsOf(name)}
        </span>
      </motion.span>
      <span className={cn("min-w-0 flex-col text-left", stacked ? "flex" : "hidden sm:flex")}>
        <motion.span className={cn("relative z-20 block max-w-[170px] truncate text-sm font-medium leading-5 text-ink", hidden)} key={shared ? "name-shared" : "name-static"} layoutId={shared ? `${uid}-name` : undefined} transition={transition}>
          {name}
        </motion.span>
        <motion.span className={cn("relative z-20 block max-w-[170px] truncate text-xs leading-4 text-muted", hidden)} key={shared ? "sub-shared" : "sub-static"} layoutId={shared ? `${uid}-sub` : undefined} transition={transition}>
          {sub}
        </motion.span>
      </span>
    </span>
  );
}

function Separator() {
  return <hr className="mx-2.5 my-1.5 h-px border-0 bg-line" />;
}

function ThemeRow({ uid, theme, onChange, reduced }: { uid: string; theme: ThemeMode; onChange: (theme: ThemeMode) => void; reduced: boolean }) {
  return (
    <fieldset aria-label="Theme" className="m-0 flex min-w-0 items-center justify-between border-0 py-1 pr-1 pl-2.5">
      <span className="text-sm text-muted">Theme</span>
      <span className="flex rounded-[10px] bg-soft p-0.5">
        {THEMES.map(({ id, label, Icon }) => {
          const checked = id === theme;
          return (
            <button
              aria-checked={checked}
              aria-label={label}
              className="relative grid h-7 w-9 place-items-center rounded-lg text-muted outline-none transition-colors duration-150 hover:text-ink focus-visible:ring-2 focus-visible:ring-focus-ring aria-checked:text-ink"
              data-menu-item=""
              data-row="theme"
              key={id}
              onClick={() => onChange(id)}
              role="menuitemradio"
              tabIndex={-1}
              title={label}
              type="button"
            >
              {checked && (
                <motion.span className="absolute inset-0 rounded-lg bg-raised shadow-[0_1px_2px_rgb(0_0_0/0.08)]" layoutId={`${uid}-theme`} transition={reduced ? INSTANT : INDICATOR_SPRING} />
              )}
              <Icon className="relative size-3.5" />
            </button>
          );
        })}
      </span>
    </fieldset>
  );
}

export default function AccountMenu({ role, theme, onThemeChange, items }: { role: string | null; theme: ThemeMode; onThemeChange: (theme: ThemeMode) => void; items: AccountMenuItem[] }) {
  const uid = useId();
  const user = useAdminUser();
  const reduced = useReducedMotion() === true;
  const [phase, setPhase] = useState<Phase>("closed");
  const [instant, setInstant] = useState(false);
  const [openSeq, setOpenSeq] = useState(0);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const phaseRef = useRef<Phase>("closed");
  // Declared before the open effect below, so it sees the new phase.
  useLayoutEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  const openIntent = useRef<{ focus: "first" | "last" | "menu"; resume: boolean }>({ focus: "menu", resume: false });
  const closeSeq = useRef(0);

  // The panel's visible box. Both surface layers and the content clip to it, so the menu grows
  // out of the trigger's own rectangle without any layout work per frame.
  const w = useMotionValue(0);
  const h = useMotionValue(0);
  const bodyOpacity = useMotionValue(1);
  const outerClip = useMotionTemplate`inset(0px 0px calc(100% - ${h}px) calc(100% - ${w}px) round ${RADIUS}px)`;
  const innerClip = useMotionTemplate`inset(1px 1px calc(100% - ${h}px + 1px) calc(100% - ${w}px + 1px) round ${RADIUS - 1}px)`;

  const sharedTransition = instant ? INSTANT : SPRING;
  const sharedInPanel = phase === "open";
  const menuId = `${uid}-menu`;
  const sub = roleLabel(role);

  const openMenu = (via: Via, focus: "first" | "last" | "menu") => {
    if (phaseRef.current === "open") return;
    openIntent.current = { focus, resume: phaseRef.current === "closing" };
    closeSeq.current += 1;
    setInstant(via === "keyboard" || reduced);
    setPhase("open");
    setOpenSeq((seq) => seq + 1);
  };

  const closeMenu = (via: Via, returnFocus: boolean) => {
    if (phaseRef.current !== "open") return;
    const trigger = triggerRef.current;
    if (returnFocus) trigger?.focus({ preventScroll: true });
    if (via === "keyboard" || reduced || !trigger) {
      setInstant(true);
      setPhase("closed");
      return;
    }
    setInstant(false);
    setPhase("closing");
    const seq = ++closeSeq.current;
    animate(bodyOpacity, 0, { duration: 0.12, ease: EASE_OUT });
    animate(w, trigger.offsetWidth, SPRING);
    animate(h, trigger.offsetHeight, SPRING).then(() => {
      if (closeSeq.current === seq) setPhase("closed");
    });
  };

  // Opening: size the clip to the trigger, then spring it out to the menu. A keyboard open skips
  // straight to the end. Runs once per open.
  useLayoutEffect(() => {
    const trigger = triggerRef.current;
    const main = mainRef.current;
    if (openSeq === 0 || phaseRef.current !== "open" || !trigger || !main) return;
    const target = main.offsetHeight;
    if (instant) {
      w.jump(PANEL_W);
      h.jump(target);
      bodyOpacity.jump(1);
    } else {
      if (!openIntent.current.resume) {
        w.jump(trigger.offsetWidth);
        h.jump(trigger.offsetHeight);
        bodyOpacity.jump(0);
      }
      animate(w, PANEL_W, SPRING);
      animate(h, target, SPRING);
      animate(bodyOpacity, 1, { duration: 0.2, delay: 0.05, ease: EASE_OUT });
    }
    const list = menuItems(main);
    const targets = { first: list[0], last: list.at(-1), menu: main.querySelector<HTMLElement>("[role=menu]") };
    targets[openIntent.current.focus]?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSeq]);

  // A press anywhere outside closes, with the morph.
  useEffect(() => {
    if (phase !== "open") return;
    const onDown = (event: globalThis.PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) closeMenu("pointer", false);
    };
    // Escape closes from anywhere, not only while focus is inside the panel (as the old menu did).
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") closeMenu("keyboard", true);
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const onPanelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault();
      closeMenu("keyboard", true);
      return;
    }
    if (!NAV_KEYS.has(event.key)) return;
    event.preventDefault();
    nextTarget(menuItems(mainRef.current), document.activeElement, event.key)?.focus({ preventScroll: true });
  };

  // Hovering an item focuses it, so pointer and keyboard share one highlight.
  const onPanelPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse") return;
    const item = (event.target as HTMLElement).closest<HTMLElement>("[data-menu-item]");
    if (item && document.activeElement !== item) item.focus({ preventScroll: true });
  };

  return (
    <div className={cn("relative isolate inline-block", phase !== "closed" && "z-50")} ref={wrapperRef}>
      <button
        aria-controls={sharedInPanel ? menuId : undefined}
        aria-expanded={sharedInPanel}
        aria-haspopup="menu"
        aria-label={`Account: ${user.name}`}
        className="flex items-center gap-2.5 rounded-2xl border border-line bg-surface p-1.5 text-left outline-none transition-colors duration-150 hover:bg-raised focus-visible:ring-2 focus-visible:ring-focus-ring sm:pr-3"
        onClick={(event) => {
          const via = viaOf(event);
          openMenu(via, via === "keyboard" ? "first" : "menu");
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            openMenu("keyboard", event.key === "ArrowDown" ? "first" : "last");
          }
        }}
        ref={triggerRef}
        type="button"
      >
        <span className="min-w-0 flex-1">
          <Identity name={user.name} shared={!sharedInPanel} stacked={false} sub={sub} transition={sharedTransition} uid={uid} />
        </span>
        <ChevronsUpDown aria-hidden="true" className={cn("hidden size-4 shrink-0 text-muted transition-opacity duration-150 sm:block", phase !== "closed" && "opacity-0")} />
      </button>

      {phase !== "closed" && (
        <div className="pointer-events-none absolute top-0 right-0 z-10" style={{ width: PANEL_W }}>
          <div aria-hidden="true" className="absolute inset-0 [filter:drop-shadow(0_12px_24px_rgb(0_0_0/0.10))_drop-shadow(0_2px_4px_rgb(0_0_0/0.05))]">
            <motion.div className="absolute inset-0 bg-line" style={{ clipPath: outerClip }} />
            <motion.div className="absolute inset-0 bg-surface" style={{ clipPath: innerClip }} />
          </div>
          <motion.div
            className={cn("relative", sharedInPanel && "pointer-events-auto")}
            onKeyDown={onPanelKeyDown}
            onPointerMove={onPanelPointerMove}
            style={{ clipPath: innerClip }}
          >
            <div className="p-1.5" ref={mainRef} style={{ width: PANEL_W }}>
              <div className="flex items-start justify-between px-2.5 pt-2.5 pb-3">
                <Identity name={user.name} shared={sharedInPanel} stacked sub={user.email || sub} transition={sharedTransition} uid={uid} />
                <motion.span className="shrink-0 pt-0.5 text-xs text-muted" style={{ opacity: bodyOpacity }}>{sub}</motion.span>
              </div>
              <motion.div aria-label="Account" className="outline-none" id={menuId} role="menu" style={{ opacity: bodyOpacity }} tabIndex={-1}>
                <ThemeRow onChange={onThemeChange} reduced={reduced} theme={theme} uid={uid} />
                {items.length > 0 && <Separator />}
                {items.map((item) => (
                  <button
                    aria-current={item.current ? "page" : undefined}
                    className={ITEM_CLASS}
                    data-menu-item=""
                    data-row={`item-${item.key}`}
                    key={item.key}
                    onClick={(event) => {
                      item.onSelect();
                      closeMenu(viaOf(event), true);
                    }}
                    role="menuitem"
                    tabIndex={-1}
                    type="button"
                  >
                    <span className="text-muted">{item.icon}</span>
                    <span className="flex-1">{item.label}</span>
                    {item.current && <Check aria-hidden="true" className="size-4 text-accent" />}
                  </button>
                ))}
                <Separator />
                <LogoutButton className={ITEM_CLASS} data-menu-item="" data-row="sign-out" role="menuitem" tabIndex={-1}>
                  <LogOut aria-hidden="true" className="size-4 text-muted" />
                  <span className="flex-1">Sign out</span>
                </LogoutButton>
              </motion.div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
