"use client";

import { Settings2, MapPin, ShieldCheck } from "lucide-react";
import AccountMenu, { type ThemeMode } from "@/components/admin/AccountMenu";
import SlidingTabs from "@/components/ui/SlidingTabs";
import { ADMIN_NAV_ITEMS } from "@/components/admin/adminNavigation";
import { useAdminModule } from "@/components/admin/AdminModuleContext";
import { BUSINESSES, GROUP_NAME, MODULE_BUSINESS, businessName } from "@/components/admin/brand";
import type { AdminModule } from "@/components/admin/adminNavigation";

export type { ThemeMode };

// Set-up modules live in the account menu, not the top bar.
const MENU_MODULES: { key: AdminModule; label: string; Icon: typeof MapPin }[] = [
  { key: "stations", label: "Stations", Icon: MapPin },
  { key: "access", label: "Access", Icon: ShieldCheck },
  { key: "cpo-settings", label: "CPO Settings", Icon: Settings2 },
];

export default function AdminHeader({ themeMode, onThemeChange }: { themeMode: ThemeMode; onThemeChange: (mode: ThemeMode) => void }) {
  const { activeModule, setActiveModule, canOpen, access } = useAdminModule();
  // The active module's business; on group-wide modules (Overview) show it only while there is one business.
  const business = businessName(MODULE_BUSINESS[activeModule]) ?? (BUSINESSES.length === 1 ? BUSINESSES[0].name : null);
  const navItems = ADMIN_NAV_ITEMS.filter((item) => canOpen(item.key) && !MENU_MODULES.some((m) => m.key === item.key));

  return (
    // Below md the nav drops to its own row and scrolls sideways instead of pushing the account menu off-screen.
    <header className="admin-topbar sticky top-0 z-40 flex w-full flex-wrap items-center gap-x-7 gap-y-2 border-b border-line px-4 py-2.5 shadow-[0_1px_3px_rgba(16,24,40,0.04)] sm:px-7 md:h-16 md:flex-nowrap md:py-0">
      <div className="flex shrink-0 items-center gap-[9px] whitespace-nowrap font-bold text-ink">
        <button type="button" onClick={() => setActiveModule("overview")} className="text-[16px] font-bold tracking-tight text-ink">{GROUP_NAME}</button>
        {business && <span className="text-[13px] font-semibold text-muted"><span aria-hidden="true" className="mr-[9px] text-muted">·</span>{business}</span>}
      </div>
      <nav className="order-last -mx-1 flex w-full items-center overflow-x-auto px-1 md:order-none md:mx-0 md:w-auto md:flex-1 md:px-0" aria-label="Admin modules">
        <SlidingTabs
          items={navItems.map((item) => ({ id: item.key, label: item.label }))}
          label="Admin modules"
          mode="nav"
          onChange={setActiveModule}
          value={navItems.some((item) => item.key === activeModule) ? activeModule : null}
        />
      </nav>
      <div className="ml-auto flex items-center">
        <AccountMenu
          items={MENU_MODULES.filter((m) => canOpen(m.key)).map(({ key, label, Icon }) => ({
            key,
            label,
            icon: <Icon aria-hidden="true" className="size-4" />,
            current: activeModule === key,
            onSelect: () => setActiveModule(key),
          }))}
          onThemeChange={onThemeChange}
          role={access}
          theme={themeMode}
        />
      </div>
    </header>
  );
}
