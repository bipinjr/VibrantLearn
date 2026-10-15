/**
 * Only same-site relative paths. Everything else falls back, so a crafted `?next=` can never
 * bounce a student to another site after they sign in (SECURITY.md T7).
 *
 * Browsers strip tab, newline, carriage return and other control characters BEFORE resolving a
 * URL, so "/\t/evil.com" resolves to "//evil.com" → https://evil.com. Checking for a leading "//"
 * alone is not enough: reject every control character and backslash first, then resolve against a
 * throwaway origin and keep the value only if it stayed on that origin.
 */
const UNSAFE = /[\u0000- \u007F-\u009F\\]/;
const BASE = "https://vibrantlearn.invalid";

export function safeNext(next: unknown, fallback = "/app"): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//")) return fallback;
  if (UNSAFE.test(next)) return fallback;
  try {
    const url = new URL(next, BASE);
    // "/..//evil.com" normalises to the protocol-relative "//evil.com", so check the result too.
    if (url.origin !== BASE || url.pathname.startsWith("//")) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
