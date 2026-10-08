"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; sentTo?: string } | undefined;

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const credentials = z.object({
  email: z.email("Enter an email like name@example.com.").max(254),
  password: z.string().min(1, "Enter your password.").max(72),
});

const newAccount = z.object({
  email: z.email("Enter an email like name@example.com.").max(254),
  password: z
    .string()
    .min(10, "Use at least 10 characters.")
    .max(72, "Use 72 characters or fewer.")
    .regex(/[A-Za-z]/, "Add at least one letter.")
    .regex(/\d/, "Add at least one number."),
});

export async function signIn(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "email_not_confirmed") {
      return { error: "Confirm your email first. Open the link we sent you, then sign in." };
    }
    if (error.status === 429) return { error: "Too many attempts. Wait a few minutes and try again." };
    return { error: "That email and password don't match. Check them and try again." };
  }
  redirect(safeNext(form.get("next")));
}

export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = newAccount.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: `${SITE}/auth/callback?next=/onboarding` },
  });
  if (error) {
    if (error.code === "weak_password") {
      return { error: "That password is too common or weak. Try a longer one with letters and numbers." };
    }
    if (error.status === 429) return { error: "Too many sign-ups from here. Wait a few minutes and try again." };
    return { error: "Couldn't create the account. Check the email and try again." };
  }
  // Same message whether or not the email already had an account (no account enumeration).
  return { sentTo: parsed.data.email };
}

export async function signInWithGoogle(form: FormData): Promise<void> {
  if (process.env.GOOGLE_AUTH_ENABLED !== "true") redirect("/login");
  const next = safeNext(form.get("next"), "/onboarding");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${SITE}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) redirect("/login?error=google");
  redirect(data.url);
}
