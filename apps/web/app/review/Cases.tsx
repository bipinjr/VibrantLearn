"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { decideAppeal, decideReport, getCases, type Cases as CasesT } from "@/lib/api/live";

/** Appeals and reports waiting for the team. Every decision needs a reason the person will see. */
export function Cases() {
  const [cases, setCases] = useState<CasesT | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const load = useCallback(() => {
    getCases()
      .then(setCases)
      .catch(() => setCases({ appeals: [], reports: [] }));
  }, []);
  useEffect(load, [load]);

  async function decide(kind: "appeal" | "report", id: number, yes: boolean) {
    const outcome = (notes[`${kind}-${id}`] ?? "").trim();
    if (outcome.length < 3) return setProblem("Write a short reason first; the person sees it.");
    setProblem(null);
    try {
      await (kind === "appeal" ? decideAppeal(id, yes, outcome) : decideReport(id, yes, outcome));
      load();
    } catch (e) {
      setProblem(e instanceof ApiError ? e.message : "Couldn't save. Try again.");
    }
  }

  if (!cases) return null;
  const note = (key: string, label: string) => (
    <input
      aria-label={label}
      placeholder="Reason they will see"
      maxLength={300}
      value={notes[key] ?? ""}
      onChange={(e) => setNotes((n) => ({ ...n, [key]: e.target.value }))}
      className="field min-w-0 flex-1"
    />
  );
  return (
    <div className="mt-12 grid gap-10">
      {problem ? <p role="alert" className="text-sm text-danger">{problem}</p> : null}
      <section aria-labelledby="ap-h">
        <h2 id="ap-h" className="text-2xl font-bold">Appeals ({cases.appeals.length})</h2>
        {cases.appeals.length === 0 ? (
          <p className="mt-2 text-muted">No open appeals.</p>
        ) : (
          <ul className="mt-3 grid gap-4">
            {cases.appeals.map((a) => (
              <li key={a.id} className="rounded-[var(--radius-card)] border border-line p-5">
                <p className="text-sm text-muted">{a.email}, warning: {a.reason}</p>
                <p className="mt-2">{a.body}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {note(`appeal-${a.id}`, `Reason for appeal from ${a.email}`)}
                  <button type="button" className="btn btn-primary" onClick={() => decide("appeal", a.id, true)}>Remove warning</button>
                  <button type="button" className="btn btn-secondary" onClick={() => decide("appeal", a.id, false)}>Keep warning</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="rp-h">
        <h2 id="rp-h" className="text-2xl font-bold">Reports ({cases.reports.length})</h2>
        {cases.reports.length === 0 ? (
          <p className="mt-2 text-muted">No open reports.</p>
        ) : (
          <ul className="mt-3 grid gap-4">
            {cases.reports.map((r) => (
              <li key={r.id} className="rounded-[var(--radius-card)] border border-line p-5">
                <p className="text-sm text-muted">
                  {r.reporter} reported {r.reported ?? "someone"}
                  {r.class_topic ? ` in ${r.class_topic}` : ""}: {r.reason}
                </p>
                {r.message ? <blockquote className="mt-2 border-l-2 border-line pl-3">{r.message}</blockquote> : null}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {note(`report-${r.id}`, `Outcome for report ${r.id}`)}
                  <button type="button" className="btn btn-primary" onClick={() => decide("report", r.id, true)}>Take action</button>
                  <button type="button" className="btn btn-secondary" onClick={() => decide("report", r.id, false)}>No action</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
