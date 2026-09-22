// Cloudflare Pages Function — validates admin credentials and issues a signed session cookie.

import { SESSION_COOKIE_NAME, createSessionToken, timingSafeEqual } from "../../_lib/session";

interface Env {
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;
  SESSION_SECRET?: string;
}

interface PagesFunctionContext {
  request: Request;
  env: Env;
}

export const onRequestPost = async ({ request, env }: PagesFunctionContext): Promise<Response> => {
  try {
    if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD || !env.SESSION_SECRET) {
      console.error("[auth] admin login is not configured (ADMIN_USERNAME / ADMIN_PASSWORD / SESSION_SECRET missing)");
      return Response.json({ error: "Sign-in is not available right now." }, { status: 503 });
    }

    const { username, password } = (await request.json()) as { username?: string; password?: string };

    const validUsername = await timingSafeEqual(username?.trim() ?? "", env.ADMIN_USERNAME);
    const validPassword = await timingSafeEqual(password ?? "", env.ADMIN_PASSWORD);

    if (!validUsername || !validPassword) {
      return Response.json({ error: "Invalid username or password." }, { status: 401 });
    }

    const token = await createSessionToken(env.SESSION_SECRET);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=28800`,
      },
    });
  } catch (err) {
    console.error("[auth] login error:", err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
};
