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
    <header className={`admin-topbar sticky top-0 z-20 flex w-full flex-wrap items-center gap-x-7 gap-y-2 border-b px-4 py-2.5 shadow-[0_1px_3px_rgba(16,24,40,0.04)] sm:px-7 md:h-16 md:flex-nowrap md:py-0 ${theme === "dark" ? "border-[#263b34] bg-[#0b1713]" : "border-[#e7e4f2] bg-white"}`}>
      <div className={`flex shrink-0 items-center gap-[9px] whitespace-nowrap font-bold ${theme === "dark" ? "text-[#f1f5f2]" : "text-[#172033]"}`}>
        <button type="button" onClick={() => setActiveModule("overview")} className={`text-[16px] font-bold tracking-tight ${theme === "dark" ? "text-[#f1f5f2]" : "text-[#172033]"}`}>{GROUP_NAME}</button>
        {business && <span className={`text-[13px] font-semibold ${theme === "dark" ? "text-[#a7b7ae]" : "text-[#5d6577]"}`}><span aria-hidden="true" className={`mr-[9px] ${theme === "dark" ? "text-[#52665c]" : "text-[#c4c7d2]"}`}>·</span>{business}</span>}
        <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wider ${theme === "dark" ? "bg-[#25382f] text-[#f4c76b]" : "bg-white text-[#7157d9]"}`}>ADMIN</span>
      </div>
      <nav className="order-last -mx-1 flex w-full items-center gap-1 overflow-x-auto px-1 md:order-none md:mx-0 md:h-full md:w-auto md:flex-1 md:px-0" aria-label="Admin modules">
        <div className="flex shrink-0 items-center gap-1.5">
        {ADMIN_NAV_ITEMS.filter((item) => canOpenModule(item.key, isPartner)).map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setActiveModule(item.key)}
            aria-current={activeModule === item.key ? "page" : undefined}
            className={activeModule === item.key ? `shrink-0 rounded-[10px] px-[14px] py-[7px] text-[13px] font-semibold transition ${theme === "dark" ? "border border-[#8c6d2f] bg-[#26352c] text-[#f4c76b]" : "bg-[#7157d9] text-white"}` : `shrink-0 rounded-[10px] px-[14px] py-[7px] text-[13px] font-semibold transition ${theme === "dark" ? "text-[#c5d0c9] hover:bg-[#1b2a23]" : "text-[#172033] hover:bg-white"}`}
          >
            {item.label}
          </button>
        ))}

        {isPartner && <button
          type="button"
          onClick={() => setActiveModule("cpo-settings")}
          aria-current={activeModule === "cpo-settings" ? "page" : undefined}
          className={`inline-flex shrink-0 items-center gap-2 rounded-[10px] px-[14px] py-[7px] text-[13px] font-semibold transition ${activeModule === "cpo-settings" ? (theme === "dark" ? "border border-[#8c6d2f] bg-[#26352c] text-[#f4c76b]" : "bg-[#7157d9] text-white") : (theme === "dark" ? "text-[#c5d0c9] hover:bg-[#1b2a23]" : "text-[#172033] hover:bg-white")}`}
        >
          <Settings2 size={15} /> CPO Settings
        </button>}
        </div>
      </nav>
      <div className="ml-auto flex items-center gap-4 text-[#667085]">

        <span className="hidden sm:block"><AdminUserBadge /></span>

        <button type="button" onClick={onToggleTheme} aria-label={"Switch to " + (theme === "dark" ? "light" : "dark") + " mode"} title={"Switch to " + (theme === "dark" ? "light" : "dark") + " mode"} className={`inline-flex items-center gap-1.5 rounded-[10px] border px-2.5 py-[7px] text-[13px] font-semibold transition ${theme === "dark" ? "border-[#35483e] text-[#e0e9e3] hover:bg-[#1b2a23]" : "border-[#e2e4ec] text-[#172033] hover:bg-white"}`}>{theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}<span className="hidden lg:inline">{theme === "dark" ? "Light" : "Dark"}</span></button>

        <LogoutButton className={`rounded-[10px] border px-[12px] py-[7px] text-[13px] font-semibold transition ${theme === "dark" ? "border-[#35483e] text-[#e0e9e3] hover:bg-[#1b2a23] hover:text-[#f4c76b]" : "border-[#e2e4ec] text-[#172033] hover:bg-white hover:text-[#7157d9]"}`} />

      </div>
    </header>
  );
}
