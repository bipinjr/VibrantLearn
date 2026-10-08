// Demo mode: browse the whole app with sample data, no account. Server-only flag, and always off on
// Vercel production so it can never become a way around real sign-in.
export const DEMO_COOKIE = "vl_demo";

export function demoEnabled(): boolean {
  return process.env.DEMO_MODE === "true" && process.env.VERCEL_ENV !== "production";
}

/** Email/Google sign-in only shows once a real Supabase project is configured. */
export function emailAuthEnabled(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return url.startsWith("http") && !/YOUR-PROJECT-REF|\.invalid\b/.test(url);
}

/** Cookies get the Secure flag whenever the site is served over HTTPS. */
export const secureCookies = (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://");
