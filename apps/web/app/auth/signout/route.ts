import { NextResponse, type NextRequest } from "next/server";
import { DEMO_COOKIE } from "@/lib/demo/mode";
import { createClient } from "@/lib/supabase/server";

// POST only (a GET link could be triggered cross-site to log people out).
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const res = NextResponse.redirect(new URL("/", request.nextUrl.origin), { status: 303 });
  res.cookies.delete(DEMO_COOKIE);
  return res;
}
