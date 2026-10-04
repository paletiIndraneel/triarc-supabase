"use client";

import { useState } from "react";
import AdminHeader from "@/components/admin/AdminHeader";
import CmsDashboard from "@/app/admin/cms/page";
import EVBilling from "@/app/admin/billing/EVBilling";
import EnquiriesTable from "@/app/admin/enquiries/EnquiriesTable";
import { ToastProvider } from "@/components/BillingToast";
import { AdminModuleContext, type AdminModule } from "@/components/admin/AdminModuleContext";
import styles from "@/app/admin/billing/billing.module.css";

type Enquiry = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  status: "New" | "Contacted" | "Closed";
  created_at: string;
};

export default function AdminApp({ enquiries, enquiryError }: { enquiries: Enquiry[]; enquiryError: boolean }) {
  const [activeModule, setActiveModule] = useState<AdminModule>("cms");

  return (
    <AdminModuleContext.Provider value={{ activeModule, setActiveModule }}>
      <AdminHeader />
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
      {activeModule === "inventory" && (
        <main className="min-h-screen bg-[#f8f9ff] px-6 py-8 text-slate-900">
          <div className="mx-auto max-w-[1440px]">
            <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
            <p className="mt-1 text-sm text-slate-500">Inventory module is available from the Admin shell.</p>
          </div>
        </main>
      )}
    </AdminModuleContext.Provider>
  );
}
