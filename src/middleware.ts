import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error("[auth] Supabase environment variables are missing.");
    return redirectToSignIn(request);
  }

  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },

      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({
          request,
        });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // User must be authenticated.
  if (!user) {
    return redirectToSignIn(request);
  }

  // User must also be an active admin.
  const { data: admin, error: adminError } = await supabase
    .from("admin_users")
    .select("role, active")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .eq("active", true)
    .maybeSingle();

  if (adminError) {
    console.error("[auth] Failed to verify admin access:", adminError);
    return new NextResponse("Forbidden", { status: 403 });
  }

  if (!admin) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  return response;
}

function redirectToSignIn(request: NextRequest) {
  const signInUrl = new URL("/signin", request.url);

  signInUrl.searchParams.set(
    "callbackUrl",
    `${request.nextUrl.pathname}${request.nextUrl.search}`
  );

  return NextResponse.redirect(signInUrl);
}
