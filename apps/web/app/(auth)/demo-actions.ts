"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_COOKIE, demoEnabled, secureCookies } from "@/lib/demo/mode";

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
