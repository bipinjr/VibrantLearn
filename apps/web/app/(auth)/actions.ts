"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isDemoEmail } from "@/lib/demo/accounts";
import { DEMO_COOKIE } from "@/lib/demo/mode";
import { SIGNUP_AS_COOKIE } from "@/lib/theme";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; sentTo?: string; done?: boolean } | undefined;

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const credentials = z.object({
  email: z.email("Enter an email like name@example.com.").max(254),
  password: z.string().min(1, "Enter your password.").max(72),
});

const newAccount = z.object({
  email: z.email("Enter an email like name@example.com.").max(254),
  password: z
    .string()
    .min(12, "Use at least 12 characters.")
    .max(72, "Use 72 characters or fewer.")
    .regex(/[a-z]/, "Add a lowercase letter.")
    .regex(/[A-Z]/, "Add a capital letter.")
    .regex(/\d/, "Add a number.")
    .regex(/[^A-Za-z0-9]/, "Add a symbol, like ! or #."),
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
  (await cookies()).delete(DEMO_COOKIE); // a real account replaces any demo session
  redirect(safeNext(form.get("next")));
}

export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = newAccount.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: `${SITE}/auth/callback?next=${encodeURIComponent(safeNext(form.get("next"), "/onboarding"))}` },
  });
  if (error) {
    if (error.code === "weak_password") {
      return { error: "That password is too common or weak. Try a longer one with letters and numbers." };
    }
    if (error.status === 429) return { error: "Too many sign-ups from here. Wait a few minutes and try again." };
    return { error: "Couldn't create the account. Check the email and try again." };
  }
  // Remember a teacher sign-up, so the confirmation link lands in the teacher portal even when
  // Supabase falls back to the Site URL (proxy.ts). A hint for routing only, never a permission.
  if (safeNext(form.get("next"), "/onboarding").startsWith("/teach")) {
    (await cookies()).set(SIGNUP_AS_COOKIE, "teacher", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 });
  }
  // Same message whether or not the email already had an account (no account enumeration).
  return { sentTo: parsed.data.email };
}

export async function signInWithGoogle(form: FormData): Promise<void> {
  const next = safeNext(form.get("next"), "/onboarding");
  const signInPage = next.startsWith("/teach") ? "/teach/login" : "/login";
  if (process.env.GOOGLE_AUTH_ENABLED !== "true") redirect(signInPage);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${SITE}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) redirect(`${signInPage}?error=google`);
  redirect(data.url);
}

const emailOnly = z.object({ email: z.email("Enter an email like name@example.com.").max(254) });

/** Step 1 of a password reset. Same answer whether or not the email has an account. */
export async function requestReset(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = emailOnly.safeParse({ email: form.get("email") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${SITE}/auth/callback?next=/reset-password`,
  });
  if (error?.status === 429) return { error: "Too many reset emails. Wait a few minutes and try again." };
  // No enumeration: success, unknown email and most errors all look the same.
  return { sentTo: parsed.data.email };
}

/** Step 2: the email link signed the student in (auth/callback); now set the new password. */
export async function setNewPassword(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = newAccount.shape.password.safeParse(form.get("password"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return { error: "This reset link has expired. Ask for a new one." };
  if (isDemoEmail(data.claims.email)) return { error: "The demo account is shared, so its password can't be changed." };
  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) {
    if (error.code === "weak_password") return { error: "That password is too common or weak. Try a longer one with letters and numbers." };
    if (error.code === "same_password") return { error: "Use a password you haven't used here before." };
    return { error: "Couldn't change the password. Ask for a new reset link and try again." };
  }
  // From Settings: stay on the page and say so. From the emailed link: into the app.
  if (form.get("next")) return { done: true };
  redirect("/app");
}
