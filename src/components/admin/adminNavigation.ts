const ADMIN_MODULES = ["cms", "billing", "enquiries", "cpo-settings"] as const;

export type AdminModule = (typeof ADMIN_MODULES)[number];

// The active module lives in `/admin?module=...` so refresh and Back keep the user's place.
export function parseAdminModule(value: string | null | undefined): AdminModule {
  return ADMIN_MODULES.find((module) => module === value) ?? "cms";
}

// Investors see only the CMS dashboard and enquiries; RLS and the API enforce the same split.
const PARTNER_ONLY_MODULES: AdminModule[] = ["billing", "cpo-settings"];

export function canOpenModule(module: AdminModule, isPartner: boolean) {
  return isPartner || !PARTNER_ONLY_MODULES.includes(module);
}

export type AdminNavItem = {
  label: string;
  key: AdminModule;
};

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { label: "CMS Dashboard", key: "cms" },
  { label: "Billing", key: "billing" },
  { label: "Enquiries", key: "enquiries" },
];
