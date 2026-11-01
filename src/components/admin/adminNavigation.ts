const ADMIN_MODULES = ["overview", "cms", "billing", "enquiries", "stations", "access", "cpo-settings", "platforms", "provider-bills"] as const;

export type AdminModule = (typeof ADMIN_MODULES)[number];

// The active module lives in `/?module=...` so refresh and Back keep the user's place.
export function parseAdminModule(value: string | null | undefined): AdminModule {
  return ADMIN_MODULES.find((module) => module === value) ?? "overview";
}

// Modules only full-access admins (partners and IT admins, see @/lib/adminAccess) ever open.
// They are left out of GRANTABLE_MODULES, and listed here as well so a value written straight
// into admin_users.modules still cannot open them. Investors are read-only (owner decision,
// 1 Nov 2026), so billing, stations and platform bills are full access only too.
const FULL_ACCESS_ONLY: readonly AdminModule[] = ["access", "platforms", "billing", "stations", "provider-bills"];

// The modules the Access page can tick for an admin without full access (admin_users.modules;
// the same list as admin_has_module() in Postgres). Overview is always open; full-access admins
// open everything. CPO Settings lets an investor add numbers only, never list or change them.
export const GRANTABLE_MODULES: { key: AdminModule; label: string }[] = [
  { key: "cms", label: "CMS Dashboard" },
  { key: "enquiries", label: "Enquiries" },
  { key: "cpo-settings", label: "CPO Settings (add numbers)" },
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
