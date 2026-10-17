"use client";

import { useCallback, useEffect, useState } from "react";
import AdminHeader from "@/components/admin/AdminHeader";
import CmsDashboard from "@/app/admin/cms/CmsDashboard";
import CpoSettings from "@/app/admin/cpo-settings/CpoSettings";
import Overview from "@/app/admin/overview/Overview";
import EVBilling from "@/app/admin/billing/EVBilling";
import EnquiriesTable from "@/app/admin/enquiries/EnquiriesTable";
import { ToastProvider } from "@/components/BillingToast";
import { AdminModuleContext } from "@/components/admin/AdminModuleContext";
import { ADMIN_NAV_ITEMS, canOpenModule, parseAdminModule, type AdminModule } from "@/components/admin/adminNavigation";
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

export default function AdminApp({ enquiries, enquiryError, initialModule, isPartner }: { enquiries: Enquiry[]; enquiryError: boolean; initialModule: AdminModule; isPartner: boolean }) {
  const [moduleState, setModuleState] = useState<AdminModule>(initialModule);
  // A module the user may not open (e.g. an investor following a ?module=billing link) shows the Overview.
  const activeModule = canOpenModule(moduleState, isPartner) ? moduleState : "overview";

  const setActiveModule = useCallback((module: AdminModule) => {
    if (!canOpenModule(module, isPartner)) return;
    setModuleState(module);
    const url = new URL(window.location.href);
    if (url.searchParams.get("module") === module) return;
    url.searchParams.set("module", module);
    window.history.pushState(null, "", url);
  }, [isPartner]);

  // Back/Forward move between modules instead of leaving the admin.
  useEffect(() => {
    const onPopState = () => setModuleState(parseAdminModule(new URL(window.location.href).searchParams.get("module")));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  return (
    <AdminModuleContext.Provider value={{ activeModule, setActiveModule, isPartner }}>
      <div className={adminStyles.adminShell}>
      <AdminHeader />
      {activeModule === "overview" && <Overview enquiries={enquiries} />}
      {activeModule === "cms" && <CmsDashboard />}
      {activeModule === "billing" && (
        <div className={styles.billingScope}>
          <ToastProvider><EVBilling /></ToastProvider>
        </div>
      )}
      {activeModule === "enquiries" && (
        <main className="min-h-screen bg-[#f8f9ff] text-slate-900">
          <div className="mx-auto max-w-[1440px] px-6 pb-12 pt-8">
            <div className="mb-7">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Enquiries</h1>
              <p className="mt-1 text-sm text-slate-500">View and manage enquiries submitted through the Triarc website.</p>
            </div>
            <EnquiriesTable enquiries={enquiries} error={enquiryError} />
          </div>
        </main>
      )}
      {activeModule === "cpo-settings" && <CpoSettings />}
      </div>
    </AdminModuleContext.Provider>
  );
}
