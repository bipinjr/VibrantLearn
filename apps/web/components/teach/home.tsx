"use client";

import { Flame } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { rupees } from "@/lib/api/classes";
import { getDemand, nextPayoutDate, type Demand } from "@/lib/api/live";
import { useTeach } from "./data";
import type { Prefill } from "./rooms";

const DAY = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short" });

/** T2, money first: this month, pending vs paid, the payout date as a real date, the last class. */
export function EarningsStrip() {
  const { earnings } = useTeach();
  if (!earnings) return null;
  const now = new Date();
  const month = earnings.classes
    .filter((c) => {
      const d = new Date(c.starts_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((n, c) => n + c.net_paise, 0);
  const pending = earnings.to_be_paid_paise + earnings.requested_paise;
  const last = earnings.classes[0];
  return (
    <section aria-label="Earnings" className="grid gap-px overflow-hidden rounded-[var(--radius-card)] border border-line bg-line sm:grid-cols-4">
      {[
        ["Earned this month", rupees(month)],
        ["Pending", rupees(pending)],
        ["Paid so far", rupees(earnings.paid_paise)],
        ["Next payout", DAY.format(nextPayoutDate(now))],
      ].map(([label, value]) => (
        <div key={label} className="bg-surface px-5 py-4">
          <p className="text-sm text-muted">{label}</p>
          <p className="font-display text-2xl font-bold tabular-nums">{value}</p>
        </div>
      ))}
      <p className="bg-surface px-5 py-3 text-sm text-muted sm:col-span-4">
        {last ? (
          <>
            Last class: <span className="text-text">{last.topic}</span>, {last.students} students, {rupees(last.net_paise)}.{" "}
          </>
        ) : (
          "No classes taught yet. "
        )}
        Withdrawals are paid by UPI or bank transfer on the 1st of each month. <Link href="/teach/earnings">Earnings</Link>
      </p>
    </section>
  );
}

function hoursUntil(iso: string): number {
  return Math.max(1, Math.round((new Date(iso).getTime() - Date.now()) / 3_600_000));
}

/** T2: what students are panicking about tonight. Aggregates only; the server hides groups under 5. */
export function DemandBoard({ onPick }: { onPick: (p: Prefill) => void }) {
  const { teacher } = useTeach();
  const [demand, setDemand] = useState<Demand[] | null>(null);
  const [problem, setProblem] = useState(false);
  useEffect(() => {
    getDemand()
      .then((r) => setDemand(r.demand))
      .catch(() => setProblem(true));
  }, []);

  return (
    <section aria-labelledby="demand-h" className="grid content-start gap-4">
      <div>
        <h2 id="demand-h" className="text-2xl font-bold">Tonight&rsquo;s demand</h2>
        <p className="text-sm text-muted">Students with an exam this week, counted without names. Groups under 5 are never shown.</p>
      </div>
      {problem ? (
        <p role="alert" className="text-sm text-danger">Couldn&rsquo;t load demand. It refreshes when you reload the page.</p>
      ) : demand === null ? (
        <ul className="grid gap-3" aria-busy="true" aria-label="Loading demand">
          {[0, 1].map((i) => (
            <li key={i} className="skeleton h-28" />
          ))}
        </ul>
      ) : demand.length === 0 ? (
        <article className="rounded-[var(--radius-card)] border border-dashed border-line p-5">
          <p className="font-semibold">No subject has 5 or more students with an exam this week yet.</p>
          <p className="mt-1 text-sm text-muted">
            Internals come in waves. Rooms in {teacher?.subjects.slice(0, 2).join(" or ") || "your subjects"} on weekday evenings fill best; create one and it reaches every student studying that subject.
          </p>
          {teacher?.subjects[0] ? (
            <button type="button" className="btn btn-secondary mt-3" onClick={() => onPick({ subject: teacher.subjects[0], topic: "" })}>
              Post a {teacher.subjects[0]} class
            </button>
          ) : null}
        </article>
      ) : (
        <ul className="grid gap-3">
          {demand.slice(0, 6).map((d) => {
            const weak = d.weak_topics[0];
            const urgent = d.within_48h > 0;
            return (
              <li key={d.subject} className="lift msg-in rounded-[var(--radius-card)] border border-line bg-surface p-5">
                <p className={`flex items-center gap-1.5 text-sm font-semibold ${urgent ? "text-now" : "text-muted"}`}>
                  {urgent ? <Flame size={16} strokeWidth={2} aria-hidden="true" /> : null}
                  {urgent ? `Exam within ${Math.min(48, hoursUntil(d.soonest_at))} hours` : "Exam this week"}
                  {d.yours ? <span className="ml-2 rounded-full bg-violet/10 px-2 py-0.5 text-xs font-medium text-link">Your subject</span> : null}
                </p>
                <p className="mt-2 text-lg">
                  <strong>{d.students} students</strong> have a {d.subject} exam {urgent ? "within 48 hours" : "this week"}.
                  {weak ? (
                    <>
                      {" "}
                      <strong>{weak.students}</strong> flagged {weak.topic} as weak.
                    </>
                  ) : null}
                </p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-sm text-muted">Teach this: est. {rupees(d.est_net_paise)} if 10+ join</span>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => onPick({ subject: d.subject, topic: weak ? `${weak.topic[0].toUpperCase()}${weak.topic.slice(1)}: exam crash class` : `${d.subject}: exam crash class`, weak: weak?.topic })}
                  >
                    Post this class
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
