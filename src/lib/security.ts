/**
 * Small, dependency-free security helpers shared by the admin UI.
 * Everything here is a pure function so it can be unit-tested without a browser.
 */

/**
 * Returns a same-origin path (plus query/hash) that is safe to navigate to after
 * sign-in, or `fallback` when `raw` is missing or could leave the site.
 *
 * Browsers convert "\" to "/" and silently drop tab/CR/LF inside URLs, so values
 * such as "/\evil.example" or "/<TAB>/evil.example" resolve to "//evil.example"
 * even though they do not literally start with "//". Those are rejected, and the
 * final check resolves the value exactly like the browser would.
 */
export function getSafeCallbackUrl(
  raw: string | null | undefined,
  origin: string,
  fallback = "/admin"
): string {
  if (!raw) return fallback;
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;

  try {
    const base = new URL(origin);
    const parsed = new URL(raw, base);
    if (parsed.origin !== base.origin) return fallback;
    const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    // Dot segments can normalise "/..//evil.example" into the protocol-relative "//evil.example".
    if (path.startsWith("//") || new URL(path, base).origin !== base.origin) return fallback;
    return path;
  } catch {
    return fallback;
  }
}

// Plain numbers / phone numbers such as "-12.5" or "+91 98765-43210". Excel treats
// these as harmless numbers, so they are left exactly as they are in exports.
const NUMERIC_LIKE = /^[+-]?[0-9][0-9\s().-]*$/;

/**
 * Prevents CSV/spreadsheet formula injection. A text value that starts with
 * "=", "@", a tab or a carriage return, or with "+"/"-" and is not a plain
 * number, is prefixed with a single quote so spreadsheet apps show it as text
 * instead of evaluating it. Numbers and booleans are never modified.
 */
export function neutralizeCsvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  if (typeof value !== "string") return text;

  if (/^[=@\t\r]/.test(text)) return `'${text}`;
  if (/^[+-]/.test(text) && !NUMERIC_LIKE.test(text)) return `'${text}`;
  return text;
}

/**
 * Builds a mailto: link that cannot carry extra headers. Ordinary addresses are
 * returned unchanged; anything unusual (for example "a@b.co?bcc=x%40y.z") is
 * percent-encoded so "?" and "&" stay part of the address instead of becoming
 * bcc/cc/subject/body parameters.
 */
export function safeMailtoHref(email: string): string {
  const value = email.trim();
  return /^[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+$/.test(value)
    ? `mailto:${value}`
    : `mailto:${encodeURIComponent(value)}`;
}

/** Builds a tel: link containing only dialable characters. */
export function safeTelHref(phone: string): string {
  return `tel:${phone.replace(/[^0-9+*#,;]/g, "")}`;
}
