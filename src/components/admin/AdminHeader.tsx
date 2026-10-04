"use client";

import { Bell, Search } from "lucide-react";
import AdminUserBadge from "@/components/admin/AdminUserBadge";
import { ADMIN_NAV_ITEMS } from "@/components/admin/adminNavigation";
import { useAdminModule } from "@/components/admin/AdminModuleContext";

export default function AdminHeader() {
  const { activeModule, setActiveModule } = useAdminModule();

  return (
    <header className="sticky top-0 z-20 flex h-16 w-full items-center gap-7 border-b border-[#e8e9f0] bg-white px-7 shadow-[0_1px_3px_rgba(16,24,40,0.04)]">
      <div className="flex min-w-[230px] shrink-0 items-center gap-[9px] whitespace-nowrap font-bold text-[#172033]">
        <button type="button" onClick={() => setActiveModule("cms")} className="text-[16px] font-bold tracking-tight text-[#172033]">Triarc EV</button>
        <span className="rounded-md bg-[#eeeaff] px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-[#7157d9]">ADMIN</span>
      </div>
      <nav className="flex h-full flex-1 items-center gap-1" aria-label="Admin modules">
        {ADMIN_NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setActiveModule(item.key as "cms" | "billing" | "inventory" | "enquiries")}
            className={activeModule === item.key ? "rounded-[10px] bg-[#7157d9] px-[14px] py-[9px] text-[13px] font-semibold transition" : "rounded-[10px] px-[14px] py-[9px] text-[13px] font-semibold transition hover:bg-[#f5f3ff]"}
            style={{ color: activeModule === item.key ? "#ffffff" : "#172033" }}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="flex items-center gap-4 text-[#667085]">
        <div className="flex h-9 w-[190px] items-center gap-2 rounded-[10px] border border-[#e2e4ec] px-[11px] text-xs text-[#98a2b3]"><Search size={16} /><span>Search portal...</span></div>
        <Bell size={18} />
        <AdminUserBadge />
      </div>
    </header>
  );
}
