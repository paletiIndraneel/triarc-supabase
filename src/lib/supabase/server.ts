import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { hasFullAccess } from "@/lib/adminAccess";

export async function createClient() {
  const cookieStore = await cookies();

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY."
    );
  }

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot always write cookies.
          // Middleware handles session cookie refresh.
        }
      },
    },
  });
}

// Route handlers aren't covered by the /admin proxy guard, so each one calls this.
// Returns the cookie-bound client plus the user when they are an active admin.
// `isPartner` means full access (partner or IT admin, see @/lib/adminAccess); other roles open
// the `modules` ticked for them on the Access page (admin_users.modules), and `stationIds` lists
// the station records such an admin is limited to (admin_users.station_ids; null = all stations).
export async function getAdminClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, isPartner: false, access: null, modules: [] as string[], stationIds: null };

  const { data: admin, error } = await supabase
    .from("admin_users")
    .select("access, station_ids, modules")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .eq("active", true)
    .maybeSingle();
  if (error || !admin) return { supabase, user: null, isPartner: false, access: null, modules: [] as string[], stationIds: null };

  const isPartner = hasFullAccess(admin.access);
  const limited = (admin.station_ids as string[] | null) ?? [];
  const stationIds = !isPartner && limited.length ? limited : null;
  return { supabase, user, isPartner, access: admin.access as string, modules: (admin.modules as string[] | null) ?? [], stationIds };
}
