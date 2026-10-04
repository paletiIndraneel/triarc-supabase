export type AdminNavItem = {
  label: string;
  href: string;
  key: string;
};

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { label: "CMS Dashboard", href: "/admin", key: "cms" },
  { label: "Billing", href: "/admin/billing", key: "billing" },
  { label: "Inventory", href: "/admin/inventory", key: "inventory" },
  { label: "Enquiries", href: "/admin/enquiries", key: "enquiries" },
];
