// Edge middleware — protects /admin and its nested routes before any page is rendered.
// Runs inside the same Cloudflare Worker as the app (see @opennextjs/cloudflare's populateProcessEnv),
// so process.env.SESSION_SECRET resolves to the Wrangler secret at request time.

import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};

export async function middleware(request: NextRequest) {
  const secret = process.env.SESSION_SECRET;

  if (!secret) {
    console.error("[auth] SESSION_SECRET is not configured; blocking /admin access");
    return redirectToSignIn(request);
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const authenticated = await verifySessionToken(token, secret);

  if (!authenticated) {
    return redirectToSignIn(request);
  }

  return NextResponse.next();
}

function redirectToSignIn(request: NextRequest) {
  const signInUrl = new URL("/signin", request.url);
  signInUrl.searchParams.set("callbackUrl", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(signInUrl);
}
