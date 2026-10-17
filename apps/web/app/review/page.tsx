"use client";

import { useCallback, useEffect, useState } from "react";
import { Main, PageHeader } from "@/components/app/Page";
import { ApiError } from "@/lib/api/client";
import { Cases } from "./Cases";
import { DOC_KINDS, reviewQueue, reviewTeacher, type ReviewItem } from "@/lib/api/teachers";

/** TEACHER.md T1: manual verification. Approve, or reject with a reason the teacher sees. */
export default function ReviewPage() {
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    reviewQueue()
      .then((r) => {
        setItems(r);
        setProblem(null);
      })
      .catch((e) => setProblem(e instanceof ApiError && e.status === 404 ? "This page is for the VibrantLearn review team." : "Couldn't load the queue. Check your connection."));
  }, []);
  useEffect(load, [load]);

  async function decide(id: string, decision: "verify" | "reject") {
    setBusy(id);
    try {
      await reviewTeacher(id, decision, notes[id] ?? "");
      load();
    } catch (e) {
      setProblem(e instanceof ApiError ? e.message : "Couldn't save. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Main>
      <title>Teacher review | VibrantLearn</title>
      <PageHeader title="Teachers waiting for review" sub="We promise teachers an answer within 2 days. Open the document before approving." />
      {problem ? (
        <p role="alert" className="mt-8 rounded-[var(--radius-input)] bg-rose/10 px-4 py-3 text-sm">{problem}</p>
      ) : items === null ? (
        <p role="status" className="mt-8 text-muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="mt-8 text-muted">Nobody is waiting. New applications show up here.</p>
      ) : (
        <ul className="mt-8 grid gap-6">
          {items.map((x) => (
            <li key={x.user_id} className="rounded-[var(--radius-card)] border border-line p-5">
              <p className="text-lg font-semibold">
                {x.display_name} <span className="text-sm font-normal text-muted">{x.email}</span>
              </p>
              <p className="text-sm text-muted">
                {[x.organisation, x.qualification, x.experience_years ? `${x.experience_years} years teaching` : ""].filter(Boolean).join(", ")}
              </p>
              <p className="mt-2 text-sm">{x.subjects.join(", ")}</p>
              {x.bio ? <p className="mt-2 text-sm text-muted">{x.bio}</p> : null}
              {x.status === "rejected" ? <p className="mt-2 text-sm text-danger">Rejected before: {x.review_note}</p> : null}
              {x.institution_code ? <p className="mt-2 text-sm">Institution code: {x.institution_code}</p> : null}
              {x.documents.length ? (
                <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                  {x.documents.map((d) => (
                    <li key={d.kind}>
                      <a href={d.url} target="_blank" rel="noopener noreferrer">
                        {DOC_KINDS.find((k) => k.kind === d.kind)?.label ?? d.kind} (opens in a new tab)
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-danger">No certificates uploaded yet</p>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <input
                  aria-label={`Reason if rejecting ${x.display_name}`}
                  placeholder="Reason, if rejecting"
                  maxLength={300}
                  value={notes[x.user_id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [x.user_id]: e.target.value }))}
                  className="field min-w-0 flex-1"
                />
                <button type="button" className="btn btn-primary" disabled={busy === x.user_id || !x.documents.some((d) => d.kind === "degree")} onClick={() => decide(x.user_id, "verify")} aria-label={`Approve ${x.display_name}`}>Approve</button>
                <button type="button" className="btn btn-secondary" disabled={busy === x.user_id} onClick={() => decide(x.user_id, "reject")} aria-label={`Reject ${x.display_name}`}>Reject</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {problem ? null : <Cases />}
    </Main>
  );
}
