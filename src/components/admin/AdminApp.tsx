"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import AdminHeader, { type ThemeMode } from "@/components/admin/AdminHeader";
import CmsDashboard from "@/app/admin/cms/CmsDashboard";
import CpoSettings from "@/app/admin/cpo-settings/CpoSettings";
import Platforms from "@/app/admin/platforms/Platforms";
import ProviderBills from "@/app/admin/provider-bills/ProviderBills";
import Overview from "@/app/admin/overview/Overview";
import EVBilling from "@/app/admin/billing/EVBilling";
import EnquiriesTable from "@/app/admin/enquiries/EnquiriesTable";
import Stations from "@/app/admin/stations/Stations";
import Access from "@/app/admin/access/Access";
import { ToastProvider } from "@/components/BillingToast";
import { AdminModuleContext } from "@/components/admin/AdminModuleContext";
import { ADMIN_NAV_ITEMS, canOpenModule, parseAdminModule, type AdminModule } from "@/components/admin/adminNavigation";

// Set-up modules sit in the account menu, not ADMIN_NAV_ITEMS, so their tab titles are named here.
const SETUP_TITLES: Partial<Record<AdminModule, string>> = { "cpo-settings": "CPO Settings", platforms: "Platforms", "provider-bills": "Platform Bills" };
import { adminTabTitle } from "@/components/admin/brand";
import styles from "@/app/admin/billing/billing.module.css";
import adminStyles from "@/components/admin/admin.module.css";

type Enquiry = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  status: "New" | "Contacted" | "Closed";
  created_at: string;
};

const THEME_EVENT = "triarc-admin-theme-change";
let sessionTheme: ThemeMode = "system";
function readThemeMode(): ThemeMode {
  try {
    const stored = window.localStorage.getItem("triarc-admin-theme") ?? window.localStorage.getItem("triarc-cms-theme");
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return sessionTheme;
  }
}
function subscribeThemeMode(onChange: () => void) {
  window.addEventListener(THEME_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(THEME_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
const darkQuery = () => window.matchMedia("(prefers-color-scheme: dark)");
const readSystemDark = () => darkQuery().matches;
function subscribeSystemDark(onChange: () => void) {
  const media = darkQuery();
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

export default function AdminApp({ enquiries, enquiryError, initialModule, isPartner, access, modules }: { enquiries: Enquiry[]; enquiryError: boolean; initialModule: AdminModule; isPartner: boolean; access: string | null; modules: string[] }) {
  const [moduleState, setModuleState] = useState<AdminModule>(initialModule);
  // The saved choice and the device setting are read as external stores: the server renders light,
  // and "system" (nothing saved) follows the device. A change in another tab applies here too.
  const themeMode = useSyncExternalStore(subscribeThemeMode, readThemeMode, () => "system" as ThemeMode);
  const systemDark = useSyncExternalStore(subscribeSystemDark, readSystemDark, () => false);
  const theme = themeMode === "system" ? (systemDark ? "dark" : "light") : themeMode;

  // The palette tokens in globals.css switch on <html data-theme>, which also reaches dialogs mounted on <body>.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    return () => { delete document.documentElement.dataset.theme; };
  }, [theme]);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    try {
      window.localStorage.removeItem("triarc-cms-theme");
      if (mode === "system") window.localStorage.removeItem("triarc-admin-theme");
      else window.localStorage.setItem("triarc-admin-theme", mode);
    } catch {
      // Storage blocked: the choice lasts for this page only.
      sessionTheme = mode;
    }
    window.dispatchEvent(new Event(THEME_EVENT));
  }, []);
  // A module the user may not open (e.g. an investor following a ?module=billing link) shows the Overview.
  const canOpen = useCallback((module: AdminModule) => canOpenModule(module, isPartner, modules), [isPartner, modules]);
  const activeModule = canOpen(moduleState) ? moduleState : "overview";

  const setActiveModule = useCallback((module: AdminModule) => {
    if (!canOpen(module)) return;
    setModuleState(module);
    const url = new URL(window.location.href);
    if (url.searchParams.get("module") === module) return;
    url.searchParams.set("module", module);
    window.history.pushState(null, "", url);
  }, [canOpen]);

  // Tab title follows the module, e.g. "TRIARC GROUP | Billing · EV Hub".
  useEffect(() => {
    const label = SETUP_TITLES[activeModule] ?? ADMIN_NAV_ITEMS.find((item) => item.key === activeModule)?.label ?? "Admin";
    document.title = adminTabTitle(label, activeModule);
  }, [activeModule]);

  // Back/Forward move between modules instead of leaving the admin.
  useEffect(() => {
    const onPopState = () => setModuleState(parseAdminModule(new URL(window.location.href).searchParams.get("module")));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  return (
    <AdminModuleContext.Provider value={{ activeModule, setActiveModule, isPartner, access, canOpen }}>
      <div data-admin-theme={theme} className={adminStyles.adminShell}>
      <AdminHeader themeMode={themeMode} onThemeChange={setThemeMode} />
      {activeModule === "overview" && <Overview enquiries={enquiries} />}
      {activeModule === "cms" && <CmsDashboard />}
      {activeModule === "billing" && (
        <div className={styles.billingScope}>
          <ToastProvider><EVBilling /></ToastProvider>
        </div>
      )}
      {activeModule === "enquiries" && (
        <main className="min-h-screen bg-page text-ink">
          <div className="mx-auto max-w-[1440px] px-6 pb-12 pt-8">
            <div className="mb-7">
              <h1 className="text-3xl font-bold tracking-tight text-ink">Enquiries</h1>
              <p className="mt-1 text-sm text-muted">View and manage enquiries submitted through the Triarc website.</p>
            </div>
            <EnquiriesTable enquiries={enquiries} error={enquiryError} />
          </div>
        </main>
      )}
      {activeModule === "stations" && <Stations />}
      {activeModule === "access" && <Access />}
      {activeModule === "cpo-settings" && <CpoSettings />}
      {activeModule === "platforms" && <Platforms />}
      {activeModule === "provider-bills" && <ProviderBills />}
      </div>
    </AdminModuleContext.Provider>
  );
}
