"use client";

import { useEffect, useState, type SubmitEvent } from "react";
import { ApiError } from "@/lib/api/client";
import { appealWarning, getHealth, type Report, type Warning } from "@/lib/api/live";

const DAY = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
const REPORT_STATUS = { open: "Being reviewed", actioned: "Action taken", dismissed: "No action needed" } as const;

function AppealForm({ w, onDone }: { w: Warning; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = String(new FormData(e.currentTarget).get("body") ?? "").trim();
    setBusy(true);
    setProblem(null);
    try {
      await appealWarning(w.id, body);
      onDone();
    } catch (err) {
      setProblem(err instanceof ApiError ? err.message : "Couldn't send the appeal. Try again.");
    } finally {
      setBusy(false);
    }
  }
  if (!open)
    return (
      <button type="button" className="btn btn-secondary mt-3" onClick={() => setOpen(true)}>
        Appeal this warning
      </button>
    );
  return (
    <form onSubmit={submit} className="mt-3 grid gap-2">
      <label htmlFor={`appeal-${w.id}`} className="text-sm font-medium">What happened? The team reads every appeal.</label>
      <textarea id={`appeal-${w.id}`} name="body" required minLength={10} maxLength={1000} rows={3} className="field" />
      {problem ? <p role="alert" className="text-sm text-danger">{problem}</p> : null}
      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Sending…" : "Send appeal"}</button>
        <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}

/** T9: warnings with their reason, a real appeal path, and the outcome of your reports. */
export default function TeachHealth() {
  const [data, setData] = useState<{ warnings: Warning[]; reports: Report[] } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const load = () =>
    getHealth()
      .then(setData)
      .catch((e) => setProblem(e instanceof ApiError ? e.message : "Couldn't load your account health."));
  useEffect(() => {
    load();
  }, []);
  const counting = data?.warnings.filter((w) => w.appeal?.status !== "removed").length ?? 0;

  return (
    <div className="mx-auto grid max-w-3xl gap-8 px-4 py-8 sm:px-8">
      <title>Account health | VibrantLearn</title>
      <div>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Account health</h1>
        <p className="mt-2 text-muted">Three warnings suspend teaching. Every warning can be appealed, and a warning removed on appeal stops counting.</p>
      </div>
      {problem ? <p role="alert" className="text-danger">{problem}</p> : null}
      {!data && !problem ? <div className="skeleton h-32" aria-busy="true" aria-label="Loading" /> : null}
      {data ? (
        <>
          <section aria-labelledby="w-h">
            <h2 id="w-h" className="text-xl font-bold">
              Warnings <span className="font-normal text-muted">({counting} of 3)</span>
            </h2>
            {data.warnings.length === 0 ? (
              <p className="mt-2 rounded-[var(--radius-card)] bg-leaf/10 px-4 py-3 text-done">No warnings. Your account is in good standing.</p>
            ) : (
              <ul className="mt-3 grid gap-3">
                {data.warnings.map((w) => (
                  <li key={w.id} className="rounded-[var(--radius-card)] border border-line p-5">
                    <p className="font-semibold">{w.reason}</p>
                    <p className="text-sm text-muted">
                      {DAY.format(new Date(w.at))}
                      {w.class_topic ? `, class: ${w.class_topic}` : ""}
                    </p>
                    {w.appeal ? (
                      <p className="mt-2 text-sm">
                        Appeal:{" "}
                        <strong>{w.appeal.status === "open" ? "being reviewed" : w.appeal.status === "removed" ? "warning removed" : "warning kept"}</strong>
                        {w.appeal.outcome ? `. ${w.appeal.outcome}` : ""}
                      </p>
                    ) : (
                      <AppealForm w={w} onDone={load} />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section aria-labelledby="r-h">
            <h2 id="r-h" className="text-xl font-bold">Your reports</h2>
            <p className="text-sm text-muted">Report a student from the class chat. You see the outcome here.</p>
            {data.reports.length === 0 ? (
              <p className="mt-2 text-muted">You haven&rsquo;t reported anyone.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {data.reports.map((r) => (
                  <li key={r.id} className="py-3 text-sm">
                    <p>
                      <strong>{r.reason}</strong> {r.class_topic ? <span className="text-muted">in {r.class_topic}</span> : null}
                    </p>
                    <p className="text-muted">
                      {DAY.format(new Date(r.at))}: {REPORT_STATUS[r.status]}
                      {r.outcome ? `. ${r.outcome}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
