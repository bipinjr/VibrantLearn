"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { demoAccount, type DemoRole } from "@/lib/demo/accounts";
import { DEMO_COOKIE, demoEnabled, secureCookies } from "@/lib/demo/mode";
import { createClient } from "@/lib/supabase/server";

export async function enterDemo(): Promise<void> {
  if (!demoEnabled()) redirect("/login");
  (await cookies()).set(DEMO_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookies,
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  redirect("/app");
}

/** One-click sign-in to a shared demo account; the credentials never leave the server. */
export async function signInDemoAccount(form: FormData): Promise<void> {
  const role: DemoRole = form.get("role") === "teacher" ? "teacher" : "student";
  const signInPage = role === "teacher" ? "/teach/login" : "/login";
  const account = demoAccount(role);
  if (!account) redirect(signInPage);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(account);
  if (error) {
    console.error("demo sign-in failed", { role, code: error.code, status: error.status, name: error.name, message: error.message });
    redirect(`${signInPage}?error=demo`);
  }
  (await cookies()).delete(DEMO_COOKIE); // a real session replaces the local demo
  redirect(role === "teacher" ? "/teach" : "/app");
}
