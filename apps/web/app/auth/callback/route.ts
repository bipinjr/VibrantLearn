import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/safe-next";
import { SIGNUP_AS_COOKIE } from "@/lib/theme";
import { createClient } from "@/lib/supabase/server";

/** Lands here from Google sign-in and from the email confirmation link (PKCE code exchange). */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const res = NextResponse.redirect(new URL(next, url.origin));
      res.cookies.delete(SIGNUP_AS_COOKIE);
      return res;
    }
  }
  if (next.startsWith("/reset-password")) return NextResponse.redirect(new URL("/forgot-password?error=expired", url.origin));
  const teacher = next.startsWith("/teach") || request.cookies.get(SIGNUP_AS_COOKIE)?.value === "teacher";
  return NextResponse.redirect(new URL(teacher ? "/teach/login?error=link" : "/login?error=link", url.origin));
}
