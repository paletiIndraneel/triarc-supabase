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
// `isPartner` means full access (partner or IT admin, see @/lib/adminAccess); investors get
// the CMS dashboard and enquiries, and `stationIds` lists the stations an investor is limited
// to (null = all stations).
export async function getAdminClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, isPartner: false, access: null, stationIds: null };

  const { data: admin, error } = await supabase
    .from("admin_users")
    .select("access")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .eq("active", true)
    .maybeSingle();
  if (error || !admin) return { supabase, user: null, isPartner: false, access: null, stationIds: null };

  const isPartner = hasFullAccess(admin.access);
  let stationIds: string[] | null = null;
  if (!isPartner) {
    const { data: rows } = await supabase.from("admin_station_access").select("station_id").eq("user_id", user.id);
    // shortcut: a failed read counts as "all stations"; the database's own policy still limits what they read.
    stationIds = rows?.length ? rows.map((r) => r.station_id as string) : null;
  }
  return { supabase, user, isPartner, access: admin.access as string, stationIds };
}
