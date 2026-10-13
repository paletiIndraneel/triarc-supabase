import type { AdminModule } from "@/components/admin/AdminModuleContext";

export type AdminNavItem = {
  label: string;
  key: AdminModule;
};

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { label: "CMS Dashboard", key: "cms" },
  { label: "Billing", key: "billing" },
  { label: "Inventory", key: "inventory" },
  { label: "Enquiries", key: "enquiries" },
];
