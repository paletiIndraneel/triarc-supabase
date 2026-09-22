// Cloudflare Pages edge middleware — redirects /admin/* to /signin unless the session cookie is valid.

import { SESSION_COOKIE_NAME, readCookie, verifySessionToken } from "../_lib/session";

interface Env {
  SESSION_SECRET?: string;
}

interface PagesFunctionContext {
  request: Request;
  env: Env;
  next: () => Promise<Response>;
}

export const onRequest = async ({ request, env, next }: PagesFunctionContext): Promise<Response> => {
  if (!env.SESSION_SECRET) {
    console.error("[auth] SESSION_SECRET is not configured; blocking /admin access");
    return Response.redirect(new URL("/signin", request.url).toString(), 302);
  }

  const token = readCookie(request, SESSION_COOKIE_NAME);
  const authenticated = await verifySessionToken(token, env.SESSION_SECRET);

  if (!authenticated) {
    return Response.redirect(new URL("/signin", request.url).toString(), 302);
  }

  return next();
};
