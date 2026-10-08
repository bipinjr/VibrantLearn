"use client";

import { useState, type SubmitEvent } from "react";
import { api, ApiError } from "@/lib/api/client";

export function WaitlistForm({ demo = false }: { demo?: boolean }) {
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state !== "idle") return; // double-submit guard; the API is idempotent too
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    setError(null);
    setState("sending");
    try {
      if (demo) {
        // Demo runs without the API: keep the address in this browser only, and say so.
        if (!/^[^@\s<>]{1,64}@[^@\s<>]+\.[A-Za-z]{2,}$/.test(email)) {
          throw new ApiError(422, "invalid_input", "Enter an email like name@example.com.");
        }
        await new Promise((r) => setTimeout(r, 500));
        try {
          localStorage.setItem("vl-demo-waitlist", email);
        } catch {
          /* storage blocked: nothing to keep */
        }
      } else {
        await api("/waitlist", { method: "POST", auth: false, body: JSON.stringify({ email, source: "landing" }) });
      }
      setState("done");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't add you just now. Try again in a minute.");
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <p role="status" className="font-medium">
        You&rsquo;re on the list. We&rsquo;ll email you once, when teaching opens.{demo ? " (Demo: saved in this browser only.)" : null}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid w-full gap-2 md:w-80" noValidate>
      <label htmlFor="waitlist-email" className="text-sm text-mist/80">
        Your email
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="waitlist-email"
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          className="field border-mist/25 bg-ink text-mist placeholder:text-mist/50"
          placeholder="name@college.edu"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "waitlist-error" : undefined}
        />
        <button type="submit" className="btn btn-primary shrink-0" disabled={state === "sending"}>
          {state === "sending" ? "Adding…" : "Join the waitlist"}
        </button>
      </div>
      <div className="reveal" data-open={Boolean(error)}>
        <p id="waitlist-error" role="alert" className="text-sm text-rose-soft">
          {error}
        </p>
      </div>
    </form>
  );
}
