import type { AdminModule } from "./adminNavigation";

// Triarc Group is the company; each business it runs is listed here.
// To add a business (e.g. CMS Software), add an entry and map its modules below.
export const GROUP_NAME = "Triarc Group";

export const BUSINESSES = [
  { key: "ev-hub", name: "EV Hub" },
  // { key: "cms-software", name: "CMS Software" },
] as const;

export type BusinessKey = (typeof BUSINESSES)[number]["key"];

// Which business each admin module belongs to; null = group-wide (e.g. Overview).
export const MODULE_BUSINESS: Record<AdminModule, BusinessKey | null> = {
  overview: null,
  cms: "ev-hub",
  billing: "ev-hub",
  enquiries: "ev-hub",
  "cpo-settings": "ev-hub",
};

export const businessName = (key: BusinessKey | null) =>
  BUSINESSES.find((b) => b.key === key)?.name ?? null;

// Browser tab: "TRIARC GROUP | Admin" or "TRIARC GROUP | Billing · EV Hub".
export function adminTabTitle(moduleLabel: string, module: AdminModule) {
  const business = businessName(MODULE_BUSINESS[module]);
  return `${GROUP_NAME.toUpperCase()} | ${moduleLabel}${business ? ` · ${business}` : ""}`;
}
