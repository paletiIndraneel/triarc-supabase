"use client";

import { createContext, useContext } from "react";

import type { AdminModule } from "@/components/admin/adminNavigation";

export type { AdminModule };

type AdminModuleContextValue = {
  activeModule: AdminModule;
  setActiveModule: (module: AdminModule) => void;
  isPartner: boolean; // full access: partner or IT admin
  access: string | null; // admin_users.access, for labels
  canOpen: (module: AdminModule) => boolean; // canOpenModule for this admin
};

export const AdminModuleContext = createContext<AdminModuleContextValue | null>(null);

export function useAdminModule() {
  const context = useContext(AdminModuleContext);
  if (!context) throw new Error("useAdminModule must be used inside AdminModuleContext");
  return context;
}
