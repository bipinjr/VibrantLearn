"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestReset, setNewPassword, type AuthState } from "./actions";

export function ForgotForm({ notice }: { notice?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(requestReset, undefined);
  if (state?.sentTo) {
    return (
      <div role="status">
        <h1 className="text-3xl font-bold">Check your inbox</h1>
        <p className="mt-3 text-muted">
          If there&rsquo;s an account for <strong className="text-text">{state.sentTo}</strong>, we&rsquo;ve sent a link to
          reset the password. Open it in this browser, and use only the newest email: each new one cancels the earlier
          links. It can take a minute; check spam if it doesn&rsquo;t show up.
        </p>
        <Link href="/login" className="mt-6 inline-block text-sm font-medium">Back to sign in</Link>
      </div>
    );
  }
  return (
    <>
      <h1 className="text-3xl font-bold sm:text-4xl">Reset your password</h1>
      <p className="mt-2 text-muted">Enter the email you signed up with and we&rsquo;ll send you a link.</p>
      {notice ? (
        <p role="alert" className="mt-4 rounded-[var(--radius-input)] bg-rose/10 px-3 py-2 text-sm">
          {notice}
        </p>
      ) : null}
      <form action={action} className="mt-8 grid gap-4" noValidate>
        <div className="grid gap-1.5">
          <label htmlFor="email" className="text-sm font-medium">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} className="field" />
        </div>
        {state?.error ? <p role="alert" className="text-sm text-danger">{state.error}</p> : null}
        <button type="submit" className="btn btn-primary w-full" disabled={pending}>
          {pending ? "Sending…" : "Send reset link"}
        </button>
      </form>
      <Link href="/login" className="mt-6 inline-block text-sm font-medium">Back to sign in</Link>
    </>
  );
}

export function NewPasswordForm({ embedded = false, next }: { embedded?: boolean; next?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(setNewPassword, undefined);
  return (
    <>
      {embedded ? (
        <h2 className="text-xl font-bold">Change password</h2>
      ) : (
        <h1 className="text-3xl font-bold sm:text-4xl">Choose a new password</h1>
      )}
      <p className="mt-2 text-muted">At least 10 characters, with a letter and a number.</p>
      {state?.done ? <p role="status" className="mt-3 text-sm font-medium text-done">Password changed.</p> : null}
      <form action={action} className={`${embedded ? "mt-4 max-w-sm" : "mt-8"} grid gap-4`} noValidate>
        <input type="hidden" name="next" value={next ?? ""} />
        <div className="grid gap-1.5">
          <label htmlFor="password" className="text-sm font-medium">New password</label>
          <input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={72} className="field" />
        </div>
        {state?.error ? <p role="alert" className="text-sm text-danger">{state.error}</p> : null}
        <button type="submit" className="btn btn-primary w-full" disabled={pending}>
          {pending ? "Saving…" : "Save new password"}
        </button>
      </form>
    </>
  );
}
