// Next.js Route Handler — validates admin credentials and issues a signed session cookie.
// Replaces the old functions/api/auth/login.ts (Cloudflare Pages Function), which never ran
// because this app deploys as a single OpenNext Worker, not a Cloudflare Pages project.

import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, SESSION_TTL_SECONDS, createSessionToken, timingSafeEqual } from "@/lib/auth/session";

export const runtime = "nodejs";

interface LoginPayload {
  username?: string;
  password?: string;
}

export async function POST(request: Request) {
  try {
    const adminUsername = process.env.ADMIN_USERNAME;
    const adminPassword = process.env.ADMIN_PASSWORD;
    const sessionSecret = process.env.SESSION_SECRET;

    if (!adminUsername || !adminPassword || !sessionSecret) {
      console.error("[auth] admin login is not configured (ADMIN_USERNAME / ADMIN_PASSWORD / SESSION_SECRET missing)");
      return NextResponse.json({ error: "Sign-in is not available right now." }, { status: 503 });
    }

    const { username, password } = (await request.json()) as LoginPayload;

    const validUsername = await timingSafeEqual(username?.trim() ?? "", adminUsername);
    const validPassword = await timingSafeEqual(password ?? "", adminPassword);

    if (!validUsername || !validPassword) {
      return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
    }

    const token = await createSessionToken(sessionSecret);
    const response = NextResponse.json({ success: true });
    response.cookies.set(SESSION_COOKIE_NAME, token, {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: SESSION_TTL_SECONDS,
    });
    return response;
  } catch (err) {
    console.error("[auth] login error:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
