// Tab-lifetime cache of the CPO Settings numbers used by the CMS dashboard. CPO Settings
// clears it after every add/edit/delete, so the dashboard picks changes up at once.
let memo: Promise<Set<string>> | null = null;

async function fetchFresh(): Promise<Set<string>> {
  try {
    const response = await fetch("/api/admin/cpo-numbers", { cache: "no-store" });
    if (!response.ok) throw new Error("cpo-numbers request failed");
    const data = (await response.json()) as { numbers?: Array<{ normalizedMobile?: string }> };
    return new Set(
      (data.numbers ?? []).map((row) => row.normalizedMobile).filter((v): v is string => Boolean(v))
    );
  } catch {
    memo = null; // don't keep a failed answer
    return new Set();
  }
}

export function getCpoMobileNumbers(): Promise<Set<string>> {
  memo ??= fetchFresh();
  return memo;
}

export function invalidateCpoMobileNumbers() {
  memo = null;
}
