import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

/** Email links that carry a token hash (Supabase templates using {{ .TokenHash }}). Unlike the
 * PKCE code in /auth/callback, these work in any browser, e.g. a phone's mail app. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(url.searchParams.get("next"), type === "recovery" ? "/reset-password" : "/app");
  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  const to = type === "recovery" ? "/forgot-password?error=expired" : "/login?error=link";
  return NextResponse.redirect(new URL(to, url.origin));
}
