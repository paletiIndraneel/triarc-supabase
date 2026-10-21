import { supabase } from "@/lib/supabase/billing";
import { normalizeMobile } from "./transactionFilters";

// Which session mobiles are CPO Settings numbers. Only the matches come back (the
// cpo_mobile_matches function), so investor admins never receive the list itself. Answers
// are kept for the tab; CPO Settings clears them after every add/edit/delete.
const known = new Map<string, boolean>();

export async function matchCpoMobiles(mobiles: Iterable<string | null | undefined>): Promise<Set<string>> {
  const wanted = new Set<string>();
  for (const mobile of mobiles) {
    const normalized = normalizeMobile(mobile);
    if (normalized) wanted.add(normalized);
  }
  const unknown = [...wanted].filter((mobile) => !known.has(mobile));
  for (let i = 0; i < unknown.length; i += 1000) {
    const chunk = unknown.slice(i, i + 1000);
    const { data, error } = await supabase.rpc("cpo_mobile_matches", { p_mobiles: chunk });
    if (error) {
      // Same as before: without the numbers, untyped sessions count as regular customers.
      console.error("[cms] CPO number lookup failed:", error.message);
      break;
    }
    const hits = new Set((data as string[] | null) ?? []);
    for (const mobile of chunk) known.set(mobile, hits.has(mobile));
  }
  return new Set([...wanted].filter((mobile) => known.get(mobile)));
}

export function invalidateCpoMobileNumbers() {
  known.clear();
}
