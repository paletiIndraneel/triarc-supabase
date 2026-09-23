// Next.js Route Handler — clears the admin session cookie.
// Replaces the old functions/api/auth/logout.ts (Cloudflare Pages Function; see login/route.ts).

import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return response;
}
