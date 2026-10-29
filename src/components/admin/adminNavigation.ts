const ADMIN_MODULES = ["overview", "cms", "billing", "enquiries", "stations", "access", "cpo-settings", "platforms"] as const;

export type AdminModule = (typeof ADMIN_MODULES)[number];

// The active module lives in `/?module=...` so refresh and Back keep the user's place.
export function parseAdminModule(value: string | null | undefined): AdminModule {
  return ADMIN_MODULES.find((module) => module === value) ?? "overview";
}

// Modules only full-access admins (partners and IT admins, see @/lib/adminAccess) ever open.
// They are left out of GRANTABLE_MODULES, and listed here as well so a value written straight
// into admin_users.modules still cannot open them. Platforms switches a charging platform off
// for everyone, so it belongs with Access.
const FULL_ACCESS_ONLY: readonly AdminModule[] = ["access", "platforms"];

// The modules the Access page can tick for an admin without full access (admin_users.modules;
// RLS and the API check the same list). Overview is always open; full-access admins open
// everything.
export const GRANTABLE_MODULES: { key: AdminModule; label: string }[] = [
  { key: "cms", label: "CMS Dashboard" },
  { key: "billing", label: "Billing" },
  { key: "enquiries", label: "Enquiries" },
  { key: "stations", label: "Stations" },
  { key: "cpo-settings", label: "CPO Settings" },
];

export function canOpenModule(module: AdminModule, isPartner: boolean, modules: readonly string[] = []) {
  return isPartner || module === "overview" || (!FULL_ACCESS_ONLY.includes(module) && modules.includes(module));
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
