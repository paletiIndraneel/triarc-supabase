"use client";

import { useEffect, useRef } from "react";
import { Settings2, Sun, Moon, ChevronDown, LogOut, MapPin, ShieldCheck } from "lucide-react";
import AdminUserBadge from "@/components/admin/AdminUserBadge";
import LogoutButton from "@/components/admin/LogoutButton";
import { ADMIN_NAV_ITEMS } from "@/components/admin/adminNavigation";
import { useAdminModule } from "@/components/admin/AdminModuleContext";
import { BUSINESSES, GROUP_NAME, MODULE_BUSINESS, businessName } from "@/components/admin/brand";
import type { AdminModule } from "@/components/admin/adminNavigation";

// Set-up modules live in the account menu, not the top bar.
const MENU_MODULES: { key: AdminModule; label: string; Icon: typeof MapPin }[] = [
  { key: "stations", label: "Stations", Icon: MapPin },
  { key: "access", label: "Access", Icon: ShieldCheck },
  { key: "cpo-settings", label: "CPO Settings", Icon: Settings2 },
];

export default function AdminHeader({ theme, onToggleTheme }: { theme: "light" | "dark"; onToggleTheme: () => void }) {
  const { activeModule, setActiveModule, canOpen } = useAdminModule();
  const accountMenuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function closeOnOutsideClick(event: PointerEvent) {
      const menu = accountMenuRef.current;
      if (menu?.open && event.target instanceof Node && !menu.contains(event.target)) {
        menu.open = false;
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && accountMenuRef.current?.open) {
        accountMenuRef.current.open = false;
      }
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);
  // The active module's business; on group-wide modules (Overview) show it only while there is one business.
  const business = businessName(MODULE_BUSINESS[activeModule]) ?? (BUSINESSES.length === 1 ? BUSINESSES[0].name : null);

  return (
    // Below md the nav drops to its own row and scrolls sideways instead of pushing Sign out off-screen.
    <header className="admin-topbar sticky top-0 z-20 flex w-full flex-wrap items-center gap-x-7 gap-y-2 border-b border-[#e7e4f2] px-4 py-2.5 shadow-[0_1px_3px_rgba(16,24,40,0.04)] sm:px-7 md:h-16 md:flex-nowrap md:py-0">
      <div className="flex shrink-0 items-center gap-[9px] whitespace-nowrap font-bold text-[#172033]">
        <button type="button" onClick={() => setActiveModule("overview")} className="text-[16px] font-bold tracking-tight text-[#172033]">{GROUP_NAME}</button>
        {business && <span className="text-[13px] font-semibold text-[#5d6577]"><span aria-hidden="true" className="mr-[9px] text-[#c4c7d2]">·</span>{business}</span>}
        <span className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-[#7157d9]">ADMIN</span>
      </div>
      <nav className="order-last -mx-1 flex w-full items-center gap-1 overflow-x-auto px-1 md:order-none md:mx-0 md:h-full md:w-auto md:flex-1 md:px-0" aria-label="Admin modules">
        <div className="flex shrink-0 items-center gap-1.5">
        {ADMIN_NAV_ITEMS.filter((item) => canOpen(item.key) && !MENU_MODULES.some((m) => m.key === item.key)).map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setActiveModule(item.key)}
            aria-current={activeModule === item.key ? "page" : undefined}
            className={activeModule === item.key ? "shrink-0 rounded-[10px] bg-[#7157d9] px-[14px] py-[7px] text-[13px] font-semibold transition" : "shrink-0 rounded-[10px] px-[14px] py-[7px] text-[13px] font-semibold transition hover:bg-white"}
            style={{ color: activeModule === item.key ? "#ffffff" : "#172033" }}
          >
            {item.label}
          </button>
        ))}
        </div>
      </nav>
      <div className="ml-auto flex items-center text-[#667085]">
        <details ref={accountMenuRef} className="group relative">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl px-2.5 py-2 text-left transition hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#83999E] [&::-webkit-details-marker]:hidden">
            <span className="hidden sm:block"><AdminUserBadge /></span>
            <span className="text-sm font-semibold text-[#172033] sm:hidden">Account</span>
            <ChevronDown size={16} className="shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-[#83999E]/50 bg-white p-2 shadow-xl">
            <div className="border-b border-[#83999E]/30 px-3 py-3">
              <p className="text-sm font-semibold text-[#172033]">Account settings</p>
              <p className="mt-0.5 text-xs text-[#5d6577]">Appearance and session</p>
            </div>
            {MENU_MODULES.filter((m) => canOpen(m.key)).map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setActiveModule(key);
                  if (accountMenuRef.current) accountMenuRef.current.open = false;
                }}
                aria-current={activeModule === key ? "page" : undefined}
                className={`mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${activeModule === key ? "bg-[#7157d9] text-white" : "text-[#172033] hover:bg-[#CCDBDB]/60"}`}
              >
                <Icon size={17} />
                <span>{label}</span>
              </button>
            ))}
            {MENU_MODULES.some((m) => canOpen(m.key)) && <div className="my-1 border-t border-[#83999E]/30" />}
            <button type="button" onClick={onToggleTheme} className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-[#172033] transition hover:bg-[#CCDBDB]/60">
              {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
              <span>{theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}</span>
            </button>
            <div className="my-1 border-t border-[#83999E]/30" />
            <LogoutButton className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-[#172033] transition hover:bg-[#CCDBDB]/60 hover:text-[#5C6E6F]">
              <LogOut size={17} />
              <span>Sign out</span>
            </LogoutButton>
          </div>
        </details>
      </div>
    </header>
  );
}
