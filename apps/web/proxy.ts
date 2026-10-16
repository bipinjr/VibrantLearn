import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { DEMO_COOKIE, demoEnabled } from "@/lib/demo/mode";
import { SIGNUP_AS_COOKIE } from "@/lib/theme";

const PROTECTED = ["/app", "/onboarding", "/review"];
const AUTH_ONLY_FOR_GUESTS = ["/login", "/signup"];
const TEACHER_GUEST_PAGES = ["/teach/login", "/teach/signup"];

function csp(nonce: string): string {
  const dev = process.env.NODE_ENV === "development";
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const wsSupabase = supabase.replace(/^http/, "ws");
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' ${dev ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    // React style={{}} props (CSS variables for animation offsets). No user data goes there.
    "style-src-attr 'unsafe-inline'",
    `connect-src 'self' ${supabase} ${wsSupabase}`,
    `img-src 'self' data: blob: ${supabase} https://lh3.googleusercontent.com`,
    "font-src 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://") ? "upgrade-insecure-requests" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export async function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const policy = csp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  // Refresh the Supabase session cookie and read verified claims (getClaims checks the signature).
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
        },
      },
    },
  );
  const { data } = await supabase.auth.getClaims();
  const demo = demoEnabled() && request.cookies.get(DEMO_COOKIE)?.value === "1";
  const signedIn = Boolean(data?.claims?.sub) || demo;
  const path = request.nextUrl.pathname;

  const redirect = (to: string, next?: string) => {
    const url = request.nextUrl.clone();
    url.pathname = to;
    url.search = next ? `?next=${encodeURIComponent(next)}` : "";
    const r = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => r.cookies.set(c));
    return r;
  };

  // Supabase falls back to the Site URL ("/") when a redirect isn't allow-listed: finish sign-in there.
  const code = request.nextUrl.searchParams.get("code");
  if (path === "/" && code) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    const teacher = request.cookies.get(SIGNUP_AS_COOKIE)?.value === "teacher";
    url.search = `?code=${encodeURIComponent(code)}&next=${encodeURIComponent(teacher ? "/teach" : "/onboarding")}`;
    return NextResponse.redirect(url);
  }

  const teacherPage = (path === "/teach" || path.startsWith("/teach/")) && !TEACHER_GUEST_PAGES.includes(path);
  if (teacherPage && !data?.claims?.sub) return redirect("/teach/login", path);
  if (!signedIn && PROTECTED.some((p) => path === p || path.startsWith(`${p}/`))) {
    return redirect("/login", path);
  }
  // Only a real account skips the teacher sign-in: the demo has no teacher portal.
  if (data?.claims?.sub && TEACHER_GUEST_PAGES.includes(path)) {
    return redirect("/teach");
  }
  if (signedIn && AUTH_ONLY_FOR_GUESTS.includes(path)) {
    return redirect("/app");
  }

  response.headers.set("Content-Security-Policy", policy);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api/|_next/static|_next/image|brand/|icon.svg|apple-icon.png|robots.txt).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
