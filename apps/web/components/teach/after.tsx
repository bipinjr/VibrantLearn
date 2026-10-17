"use client";

import { useState } from "react";
import { ApiError } from "@/lib/api/client";
import { rupees, type LiveClass } from "@/lib/api/classes";
import { getSummary, runAgain, type ClassSummary } from "@/lib/api/live";
import { useTeach } from "./data";

/** T6: straight after the class. Class-level numbers only; quiz feedback needs 5+ students. */
export function AfterClass({ c }: { c: LiveClass }) {
  const { reload } = useTeach();
  const [open, setOpen] = useState(false);
  const [s, setS] = useState<ClassSummary | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [again, setAgain] = useState<"idle" | "busy" | "done">("idle");

  function toggle() {
    setOpen((o) => !o);
    if (!s)
      getSummary(c.id)
        .then(setS)
        .catch((e) => setProblem(e instanceof ApiError ? e.message : "Couldn't load the summary."));
  }

  async function repeat() {
    setAgain("busy");
    try {
      await runAgain(c.id, 7);
      setAgain("done");
      reload();
    } catch (e) {
      setAgain("idle");
      setProblem(e instanceof ApiError ? e.message : "Couldn't schedule it again.");
    }
  }

  const day = new Date(new Date(c.starts_at).getTime() + 7 * 86_400_000).toLocaleDateString("en-IN", { weekday: "long" });
  return (
    <div className="mt-2">
      <button type="button" className="text-sm font-medium text-link underline-offset-4 hover:underline" aria-expanded={open} onClick={toggle}>
        {open ? "Hide how it went" : "How it went"}
      </button>
      {open ? (
        <div className="mt-3 grid gap-3 rounded-[var(--radius-input)] bg-text/[0.04] p-4 text-sm">
          {problem ? <p role="alert" className="text-danger">{problem}</p> : null}
          {!s && !problem ? <p role="status" className="text-muted">Loading…</p> : null}
          {s ? (
            <>
              <p>
                <strong>{s.attended}</strong> of {s.interested} interested students joined.
                {s.payout ? (
                  <>
                    {" "}
                    You earned <strong>{rupees(s.payout.net_paise)}</strong> ({rupees(s.payout.gross_paise)} minus {rupees(s.payout.fee_paise)} fee).
                  </>
                ) : (
                  " No payout: the class didn't run."
                )}
              </p>
              <p>{s.ratings ? <>Rated <strong>{s.rating}</strong> out of 5 by {s.ratings} {s.ratings === 1 ? "student" : "students"}.</> : "No ratings yet; students rate after class."}</p>
              {s.quiz_feedback.length ? (
                <ul className="grid gap-1">
                  {s.quiz_feedback.map((q) => (
                    <li key={q.topic}>
                      <strong>{q.struggled} of {q.students}</strong> students who joined scored under 60% on {q.topic} quizzes this fortnight.
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted">Quiz feedback shows once 5 or more of your students have taken quizzes on these topics.</p>
              )}
              <div>
                {again === "done" ? (
                  <p className="font-medium text-done">Scheduled for next {day}. It&rsquo;s in your rooms.</p>
                ) : (
                  <button type="button" className="btn btn-secondary" disabled={again === "busy"} onClick={repeat}>
                    {again === "busy" ? "Scheduling…" : `Run this again ${day}`}
                  </button>
                )}
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
