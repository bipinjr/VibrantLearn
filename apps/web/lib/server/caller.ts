import "server-only";
import type { NextRequest } from "next/server";
import { DEMO_COOKIE, demoEnabled, emailAuthEnabled } from "@/lib/demo/mode";
import { getUserId } from "@/lib/supabase/server";

/** Who may use the AI routes: a signed-in student (verified JWT) or the local demo. Null = refuse. */
export async function callerKey(request: NextRequest): Promise<string | null> {
  if (emailAuthEnabled()) {
    const userId = await getUserId().catch(() => null);
    if (userId) return `user:${userId}`;
  }
  if (demoEnabled() && request.cookies.get(DEMO_COOKIE)?.value === "1") return `demo:${request.headers.get("x-forwarded-for") ?? "local"}`;
  return null;
}
