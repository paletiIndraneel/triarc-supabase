// Cloudflare Pages Function — POST /api/auth/logout clears the admin session cookie.

import { SESSION_COOKIE_NAME } from "../../_lib/session";

export const onRequestPost = async (): Promise<Response> => {
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
    },
  });
};
