"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, signInWithGoogle, signUp, type AuthState } from "./actions";
import { enterDemo } from "./demo-actions";

type Props = { mode: "signin" | "signup"; next?: string; googleEnabled: boolean; notice?: string; demo: boolean; emailEnabled: boolean; teacher?: boolean };

export function AuthForm({ mode, next, googleEnabled, notice, demo, emailEnabled, teacher = false }: Props) {
  const [state, action, pending] = useActionState<AuthState, FormData>(mode === "signin" ? signIn : signUp, undefined);
  const error = state?.error ?? notice;

  if (state?.sentTo) {
    return (
      <div role="status">
        <h1 className="text-3xl font-bold">Check your inbox</h1>
        <p className="mt-3 text-muted">
          We sent a confirmation link to <strong className="text-text">{state.sentTo}</strong>. Open it on this device to
          finish creating your account. It can take a minute; check spam if it doesn&rsquo;t show up.
        </p>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-3xl font-bold sm:text-4xl">
        {teacher ? (mode === "signin" ? "Teacher sign in" : "Create a teacher account") : mode === "signin" ? "Welcome back" : "Create your account"}
      </h1>
      <p className="mt-2 text-muted">
        {teacher
          ? mode === "signin"
            ? "Sign in to create rooms and run your live classes."
            : "Teach small evening classes to BCA students. Takes under a minute."
          : mode === "signin"
            ? "Sign in to pick up your plans."
            : "Free while we're in beta. Takes under a minute."}
      </p>

      {demo && !teacher ? (
        <form action={enterDemo} className="mt-8 grid gap-2 rounded-[var(--radius-card)] border border-line bg-surface p-4">
          <p className="font-semibold">Try it with the demo account</p>
          <p className="text-sm text-muted">Sample plans, notes and quizzes for a 3rd-semester BCA student. Everything works; nothing is saved on our side.</p>
          <button type="submit" className="btn btn-primary mt-2 w-full">
            Continue with the demo account
          </button>
        </form>
      ) : null}

      {!emailEnabled ? (
        <p className="mt-6 text-sm text-muted">Email and Google sign-in open once the database is connected.</p>
      ) : null}

      {emailEnabled && googleEnabled ? (
        <form action={signInWithGoogle} className="mt-8">
          <input type="hidden" name="next" value={next ?? ""} />
          <button type="submit" className="btn btn-secondary w-full">
            Continue with Google
          </button>
          <p className="my-6 text-center text-sm text-muted">or use your email</p>
        </form>
      ) : null}

      {emailEnabled ? (
      <form action={action} className={`${googleEnabled ? "" : "mt-8"} grid gap-4`} noValidate>
        <input type="hidden" name="next" value={next ?? ""} />
        <div className="grid gap-1.5">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} className="field" />
        </div>
        <div className="grid gap-1.5">
          <span className="flex items-baseline justify-between">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            {mode === "signin" ? (
              <Link href="/forgot-password" className="text-sm">
                Forgot your password?
              </Link>
            ) : null}
          </span>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            required
            minLength={mode === "signup" ? 10 : undefined}
            maxLength={72}
            aria-describedby={mode === "signup" ? "password-hint" : undefined}
            className="field"
          />
          {mode === "signup" ? (
            <p id="password-hint" className="text-sm text-muted">
              At least 10 characters, with a letter and a number.
            </p>
          ) : null}
        </div>

        <div className="reveal" data-open={Boolean(error)}>
          <p role="alert" className="rounded-[var(--radius-input)] bg-rose/10 px-3 py-2 text-sm text-text">
            {error}
          </p>
        </div>

        <button type="submit" className="btn btn-primary mt-2 w-full" disabled={pending}>
          {pending ? (mode === "signin" ? "Signing in…" : "Creating account…") : mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>
      ) : null}

      {mode === "signup" ? (
        <p className="mt-4 text-sm text-muted">
          We store your email and study data only to make your plans. You choose what to share during setup.{" "}
          By creating an account you agree to the <Link href="/terms">terms of use</Link>. <Link href="/privacy">Privacy notice</Link>
        </p>
      ) : null}

      <p className="mt-8 text-sm">
        {mode === "signin" ? (
          <>
            New here? <Link href={teacher ? "/teach/signup" : "/signup"}>{teacher ? "Create a teacher account" : "Create an account"}</Link>
          </>
        ) : (
          <>
            Already have an account? <Link href={teacher ? "/teach/login" : "/login"}>Sign in</Link>
          </>
        )}
      </p>
      <p className="mt-2 text-sm text-muted">
        {teacher ? (
          <>
            Studying? <Link href="/login">Student sign in</Link>
          </>
        ) : (
          <>
            Teaching? <Link href="/teach/login">Teacher sign in</Link>
          </>
        )}
      </p>
    </>
  );
}
