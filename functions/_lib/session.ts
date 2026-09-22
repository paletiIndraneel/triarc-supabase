// Signs/verifies the admin session cookie. Underscore-prefixed folder keeps this out of Cloudflare Pages routing.

const encoder = new TextEncoder();

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export const SESSION_COOKIE_NAME = "triarc_admin_session";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

export async function createSessionToken(secret: string): Promise<string> {
  const payloadB64 = base64UrlEncode(encoder.encode(JSON.stringify({ exp: Date.now() + SESSION_TTL_MS })));
  const key = await hmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadB64));
  return `${payloadB64}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export async function verifySessionToken(token: string | undefined, secret: string): Promise<boolean> {
  if (!token) return false;
  const [payloadB64, signatureB64] = token.split(".");
  if (!payloadB64 || !signatureB64) return false;

  const key = await hmacKey(secret);
  const valid = await crypto.subtle.verify("HMAC", key, base64UrlDecode(signatureB64), encoder.encode(payloadB64));
  if (!valid) return false;

  try {
    const { exp } = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64))) as { exp: number };
    return typeof exp === "number" && Date.now() < exp;
  } catch {
    return false;
  }
}

export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("Cookie") ?? request.headers.get("cookie");
  if (!header) return undefined;
  const match = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return match?.slice(name.length + 1);
}

// Compares SHA-256 digests byte-by-byte to avoid short-circuit timing leaks.
export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const [digestA, digestB] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);
  const bytesA = new Uint8Array(digestA);
  const bytesB = new Uint8Array(digestB);
  let diff = 0;
  for (let i = 0; i < bytesA.length; i++) {
    diff |= bytesA[i] ^ bytesB[i];
  }
  return diff === 0;
}
