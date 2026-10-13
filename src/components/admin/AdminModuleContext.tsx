"use client";

import { createContext, useContext } from "react";

export type AdminModule = "cms" | "billing" | "inventory" | "enquiries" | "cpo-settings";

type AdminModuleContextValue = {
  activeModule: AdminModule;
  setActiveModule: (module: AdminModule) => void;
};

export const AdminModuleContext = createContext<AdminModuleContextValue | null>(null);

export function useAdminModule() {
  const context = useContext(AdminModuleContext);
  if (!context) throw new Error("useAdminModule must be used inside AdminModuleContext");
  return context;
}
