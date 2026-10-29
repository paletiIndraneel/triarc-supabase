// The charging platforms (CMS providers) the admin knows. The id is stored on every session
// (cms_transactions.provider) and on billing customers (session_source). Safe to import in
// the browser: the dashboard filter and the billing "Charging sessions from" list read it.
// To add a platform: add it here, write its connector and register it in ./provider.ts.
// Pure, so tests/ can load it.

export type ProviderInfo = {
  id: string;
  label: string;
  // Put in front of the platform's session ids so they never clash with another platform's
  // (its name, shortened if long). It is only in the stored ids: everything that calls the
  // platform's API or shows the id strips it again (platformSessionId), so the platform
  // always gets its own id back. ChargeMOD's meter-values API fails on any other id.
  idPrefix: string;
  // The Worker variables the platform's connector needs, by name only. The Platforms page says
  // which of these are missing; the values stay on the Worker and never reach the browser.
  credentialEnv: string[];
};

export const PROVIDERS: ProviderInfo[] = [
  {
    id: "chargemod",
    label: "ChargeMOD",
    idPrefix: "chrgmod_",
    credentialEnv: ["CMS_OPERATOR_DASHBOARD_ENABLED", "CMS_API_URL", "CMS_API_USERNAME", "CMS_API_PASSWORD"],
  },
];

export function providerLabel(id: string | null | undefined) {
  return PROVIDERS.find((p) => p.id === id)?.label ?? id ?? "Unknown";
}

// A platform's own session id -> the id stored here, and back.
export function storedSessionId(info: ProviderInfo, id: string) {
  return id && info.idPrefix ? `${info.idPrefix}${id}` : id;
}

export function platformSessionId(info: ProviderInfo, id: string) {
  return info.idPrefix && id.startsWith(info.idPrefix) ? id.slice(info.idPrefix.length) : id;
}

// The id to show people: a stored id without its platform prefix.
export function displaySessionId(provider: string | null | undefined, id: string) {
  const info = PROVIDERS.find((p) => p.id === provider);
  return info ? platformSessionId(info, id) : id;
}
