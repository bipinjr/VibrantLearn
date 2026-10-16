import "server-only";
import type { NextRequest } from "next/server";
import { DEMO_COOKIE, demoEnabled } from "@/lib/demo/mode";

/**
 * Who may use the demo's AI routes (/api/notes, /api/demo/chat): the local demo only. Signed-in
 * students get AI through the FastAPI message pipeline (shared cache, usage log, limits), so these
 * routes never need to accept a real account's token. Off in production (demoEnabled). Null = refuse.
 */
export async function callerKey(request: NextRequest): Promise<string | null> {
  if (demoEnabled() && request.cookies.get(DEMO_COOKIE)?.value === "1") return `demo:${request.headers.get("x-forwarded-for") ?? "local"}`;
  return null;
}
