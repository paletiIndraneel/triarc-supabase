import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isBot, NO_INDEX } from "@/lib/bots";

export const config = {
  // Every route except built assets: bots are refused everywhere. Only the admin itself (/,
  // modules are ?module=…) needs a signed-in admin; /signin, /unauthorized and /api check their own.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Crawlers, AI agents and preview fetchers get nothing (robots.txt stays readable so polite ones see the "no").
  if (pathname !== "/robots.txt" && isBot(request.headers.get("user-agent"))) {
    return new NextResponse("Not available.", { status: 403, headers: { "X-Robots-Tag": NO_INDEX } });
  }
  // Pages get a per-request script nonce (the API serves JSON and keeps next.config's CSP).
  const csp = pathname.startsWith("/api/") ? null : contentSecurityPolicy();
  const next = () => {
    if (!csp) return NextResponse.next({ request });
    const headers = new Headers(request.headers);
    headers.set("Content-Security-Policy", csp);
    const res = NextResponse.next({ request: { headers } });
    res.headers.set("Content-Security-Policy", csp);
    return res;
  };
  if (pathname !== "/") return next();

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    console.error("[auth] Supabase environment variables are missing.");
    return redirectToSignIn(request);
  }

  let response = next();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },

      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = next();

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data, error: claimsError } = await supabase.auth.getClaims();

  // User must be authenticated.
  if (claimsError || !data?.claims?.sub) {
    return redirectToSignIn(request);
  }

  const userId = data.claims.sub;

  // User must also be an active admin.
  const { data: admin, error: adminError } = await supabase
    .from("admin_users")
    .select("role, active")
    .eq("user_id", userId)
    .eq("role", "admin")
    .eq("active", true)
    .maybeSingle();

  if (adminError) {
    console.error("[auth] Failed to verify admin access:", adminError);
    return redirectToUnauthorized(request);
  }

  if (!admin) {
    return redirectToUnauthorized(request);
  }

  return response;
}

// Only scripts carrying this request's nonce run, plus what they load ('strict-dynamic');
// Next.js reads the nonce from the request header and adds it to its own scripts. Styles and
// connections stay open (inline motion styles, Supabase). Pages must render per request, see
// connection() in the root layout, or a prebuilt page would carry no nonce and stay blank.
function contentSecurityPolicy() {
  const nonce = btoa(crypto.randomUUID());
  const dev = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";
  return `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev}; frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'`;
}

function redirectToSignIn(request: NextRequest) {
  const signInUrl = new URL("/signin", request.url);

  signInUrl.searchParams.set(
    "callbackUrl",
    `${request.nextUrl.pathname}${request.nextUrl.search}`
  );

  return NextResponse.redirect(signInUrl);
}

function redirectToUnauthorized(request: NextRequest) {
  const unauthorizedUrl = new URL("/unauthorized", request.url);

  unauthorizedUrl.searchParams.set(
    "callbackUrl",
    `${request.nextUrl.pathname}${request.nextUrl.search}`
  );

  return NextResponse.redirect(unauthorizedUrl);
}