import { createBrowserClient } from "@supabase/ssr";

// "implicit" is used only for the reset request: its email link then works in any browser, since
// it does not need the code verifier stored by the browser that asked for it.
export function createClient(options?: { flowType: "implicit" }) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY."
    );
  }

  return createBrowserClient(url, key, options ? { auth: options } : undefined);
}
