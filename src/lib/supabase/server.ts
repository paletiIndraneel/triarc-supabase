import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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
export async function getAdminClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, isPartner: false };

  const { data: admin, error } = await supabase
    .from("admin_users")
    .select("access")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .eq("active", true)
    .maybeSingle();

  // Partners have the whole admin; investors only the CMS dashboard and enquiries.
  return { supabase, user: !error && admin ? user : null, isPartner: !error && admin?.access === "partner" };
}
