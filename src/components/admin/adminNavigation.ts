const ADMIN_MODULES = ["overview", "cms", "billing", "enquiries", "stations", "access", "cpo-settings"] as const;

export type AdminModule = (typeof ADMIN_MODULES)[number];

// The active module lives in `/admin?module=...` so refresh and Back keep the user's place.
export function parseAdminModule(value: string | null | undefined): AdminModule {
  return ADMIN_MODULES.find((module) => module === value) ?? "overview";
}

// The modules the Access page can tick for an admin without full access (admin_users.modules;
// RLS and the API check the same list). Overview is always open; Access stays with full-access
// admins (partners and IT admins, see @/lib/adminAccess), who open everything.
export const GRANTABLE_MODULES: { key: AdminModule; label: string }[] = [
  { key: "cms", label: "CMS Dashboard" },
  { key: "billing", label: "Billing" },
  { key: "enquiries", label: "Enquiries" },
  { key: "stations", label: "Stations" },
  { key: "cpo-settings", label: "CPO Settings" },
];

export function canOpenModule(module: AdminModule, isPartner: boolean, modules: readonly string[] = []) {
  return isPartner || module === "overview" || (module !== "access" && modules.includes(module));
}

export type AdminNavItem = {
  label: string;
  key: AdminModule;
};

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { label: "Overview", key: "overview" },
  { label: "CMS Dashboard", key: "cms" },
  { label: "Billing", key: "billing" },
  { label: "Enquiries", key: "enquiries" },
  { label: "Stations", key: "stations" },
  { label: "Access", key: "access" },
];
