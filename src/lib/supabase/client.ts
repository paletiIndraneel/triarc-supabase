import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY."
    );
  }

  return createBrowserClient(url, key);
}
