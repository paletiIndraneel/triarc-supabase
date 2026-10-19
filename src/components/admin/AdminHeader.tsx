"use client";

import { Settings2, Sun, Moon } from "lucide-react";
import AdminUserBadge from "@/components/admin/AdminUserBadge";
import LogoutButton from "@/components/admin/LogoutButton";
import { ADMIN_NAV_ITEMS, canOpenModule } from "@/components/admin/adminNavigation";
import { useAdminModule } from "@/components/admin/AdminModuleContext";
import { BUSINESSES, GROUP_NAME, MODULE_BUSINESS, businessName } from "@/components/admin/brand";

export default function AdminHeader({ theme, onToggleTheme }: { theme: "light" | "dark"; onToggleTheme: () => void }) {
  const { activeModule, setActiveModule, isPartner } = useAdminModule();
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
        {ADMIN_NAV_ITEMS.filter((item) => canOpenModule(item.key, isPartner)).map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setActiveModule(item.key)}
            aria-current={activeModule === item.key ? "page" : undefined}
            className={activeModule === item.key ? "admin-nav-item shrink-0 rounded-[10px] bg-[#7157d9] px-[14px] py-[7px] text-[13px] font-semibold transition" : "admin-nav-item shrink-0 rounded-[10px] px-[14px] py-[7px] text-[13px] font-semibold transition"}
            style={{ color: activeModule === item.key ? "#ffffff" : theme === "dark" ? "#ffffff" : "#172033" }}
          >
            {item.label}
          </button>
        ))}

        {isPartner && <button
          type="button"
          onClick={() => setActiveModule("cpo-settings")}
          aria-current={activeModule === "cpo-settings" ? "page" : undefined}
          className={`inline-flex shrink-0 items-center gap-2 rounded-[10px] px-[14px] py-[7px] text-[13px] font-semibold transition ${activeModule === "cpo-settings" ? "bg-[#7157d9] text-white" : "text-[#172033] hover:bg-white"}`}
        >
          <Settings2 size={15} /> CPO Settings
        </button>}
        </div>
      </nav>
      <div className="ml-auto flex items-center gap-4 text-[#667085]">

        <span className="hidden sm:block"><AdminUserBadge /></span>

        <button type="button" onClick={onToggleTheme} aria-label={"Switch to " + (theme === "dark" ? "light" : "dark") + " mode"} title={"Switch to " + (theme === "dark" ? "light" : "dark") + " mode"} className="inline-flex items-center gap-1.5 rounded-[10px] border border-[#e2e4ec] px-2.5 py-[7px] text-[13px] font-semibold text-[#172033] transition hover:bg-white">{theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}<span className="hidden lg:inline">{theme === "dark" ? "Light" : "Dark"}</span></button>

        <LogoutButton className="rounded-[10px] border border-[#e2e4ec] px-[12px] py-[7px] text-[13px] font-semibold text-[#172033] transition hover:bg-white hover:text-[#7157d9]" />

      </div>
    </header>
  );
}
