import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getRuntimeEnv } from "@/lib/cms/operator";

// Server-only Supabase client with the project's secret key (sb_secret_..., the replacement for
// the legacy service-role key). It bypasses RLS, so only server code may import this file, and
// SUPABASE_SECRET_KEY must stay out of next.config.ts `env` (that list is built into the
// browser bundle). The key is read at request time: a Cloudflare Worker secret in production,
// a Vercel env var on Vercel. Null when it is not set.
let cached: { key: string; client: SupabaseClient } | null = null;

export async function getServiceClient(): Promise<SupabaseClient | null> {
  const env = await getRuntimeEnv();
  const key = String(env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SECRET_KEY ?? "");
  const url = process.env.SUPABASE_URL;
  if (!key || !url) return null;
  if (cached?.key !== key) {
    cached = { key, client: createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) };
  }
  return cached.client;
}
