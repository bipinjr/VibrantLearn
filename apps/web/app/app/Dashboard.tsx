"use client";

import { ArrowUpRight, Check, Clock3, Play, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";
import { Main, PageHeader, PageTransition } from "@/components/app/Page";
import { MiniPath } from "@/components/learn/MiniPath";
import { ProgressRing } from "@/components/learn/ProgressRing";
import { useDemo } from "@/lib/demo/store";
import { ago, clock, dayInline, dayLabel, timeLeft, timeRange } from "@/lib/format";

const longDate = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long" });

function greeting(now: Date) {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "numeric", hour12: false }).format(now));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function Countdown({ to }: { to: string }) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, new Date(to).getTime() - Date.now()));
    const id = window.setInterval(tick, 1000);
    const first = window.setTimeout(tick, 0);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(first);
    };
  }, [to]);
  if (left === null) return <span className="tabular-nums">--:--:--</span>;
  const s = Math.floor(left / 1000);
  const d = Math.floor(s / 86400);
  const hh = String(Math.floor((s % 86400) / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return (
    <span className="tabular-nums" aria-label={`${d} days ${hh} hours ${mm} minutes left`}>
      {d > 0 ? `${d}d ` : ""}
      {hh}:{mm}:{ss}
    </span>
  );
}

export function Dashboard() {
  const router = useRouter();
  const { state, now, toggleStep, startSession } = useDemo();
  const nowIso = now.toISOString();

  const plans = [...state.plans].sort((a, b) => a.deadline.localeCompare(b.deadline));
  const upcoming = plans
    .flatMap((p) => p.steps.filter((s) => !s.done && s.kind !== "exam").map((s) => ({ plan: p, step: s })))
    .sort((a, b) => a.step.start.localeCompare(b.step.start));
  const next = upcoming[0];

  const allSteps = plans.flatMap((p) => p.steps.filter((s) => s.kind !== "exam"));
  const doneCount = allSteps.filter((s) => s.done).length;
  const weekEnd = now.getTime() + 7 * 86_400_000;
  const plannedWeekMin = allSteps
    .filter((s) => !s.done && s.kind === "block" && new Date(s.start).getTime() < weekEnd)
    .reduce((a, s) => a + (s.minutes ?? 0), 0);

  const replies = Object.values(state.messages).flat().filter((m) => m.role === "assistant");
  const localPct = replies.length ? Math.round((replies.filter((m) => m.servedFrom !== "llm").length / replies.length) * 100) : 0;

  const quick = [
    `${state.profile.course === "BCA" ? "Java" : "Maths"} internal tomorrow 10am`,
    "DBMS test in 3 days, normalization weak",
    "Quiz me on stacks",
    "Explain deadlocks in Kannada",
  ];

  function quickStart(text: string) {
    const id = startSession(text);
    router.push(`/app/s/${id}`, { transitionTypes: ["nav-forward"] });
  }

  return (
    <PageTransition>
      <Main wide>
        <PageHeader
          title={
            <>
              {greeting(now)}, {state.profile.username}
            </>
          }
          sub={`${longDate.format(now)}. ${plans.length} plans running, ${upcoming.length} steps to go.`}
        />

        {/* ---- Next up ---- */}
        {next ? (
          <section aria-labelledby="next-h" className="rise mt-8" style={{ "--i": 1 } as CSSProperties}>
            <div data-theme="dark" className="relative overflow-hidden rounded-[var(--radius-sheet)] bg-ink p-6 text-text sm:p-8">
              <div className="relative grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
                <div>
                  <h2 id="next-h" className="flex items-center gap-2 font-sans text-sm font-medium text-muted">
                    <span className="relative flex size-2">
                      <span className="absolute inset-0 animate-ping rounded-full bg-ember opacity-60 motion-reduce:hidden" />
                      <span className="relative size-2 rounded-full bg-ember" />
                    </span>
                    Next up, {dayInline(next.step.start, nowIso)}
                  </h2>
                  <p className="mt-3 font-display text-2xl leading-tight font-bold sm:text-[2rem]">{next.step.title}</p>
                  <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock3 size={15} strokeWidth={1.75} aria-hidden="true" />
                      {timeRange(next.step.start, next.step.end)}
                    </span>
                    <span>{next.plan.subject}</span>
                    {next.step.unit ? <span>{next.step.unit}</span> : null}
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link href={`/app/s/${next.plan.sessionId}`} transitionTypes={["nav-forward"]} className="btn btn-primary">
                      <Play size={16} strokeWidth={2.25} aria-hidden="true" />
                      Start block
                    </Link>
                    <button type="button" className="btn btn-secondary" onClick={() => toggleStep(next.plan.id, next.step.id)}>
                      <Check size={16} strokeWidth={2.25} aria-hidden="true" />
                      Mark done
                    </button>
                  </div>
                </div>
                <div className="rounded-[var(--radius-card)] border border-line bg-surface/40 p-4 md:min-w-56">
                  <p className="text-sm text-muted">{next.plan.subject.replace(" Programming", "")} exam in</p>
                  <p className="mt-1 font-display text-3xl font-bold">
                    <Countdown to={next.plan.deadline} />
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {dayLabel(next.plan.deadline, nowIso)}, {clock(next.plan.deadline)}
                  </p>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {/* ---- Real progress, computed from the plans ---- */}
        <section aria-label="Your progress" className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            { label: "Steps done", value: `${doneCount} of ${allSteps.length}` },
            { label: "Planned for the next 7 days", value: `${Math.floor(plannedWeekMin / 60)} h ${plannedWeekMin % 60} min` },
            { label: "Answered without an AI call", value: `${localPct}%` },
          ].map((s, i) => (
            <div key={s.label} className="rise rounded-[var(--radius-card)] border border-line bg-surface px-5 py-4" style={{ "--i": i + 2 } as CSSProperties}>
              <p className="text-sm text-muted">{s.label}</p>
              <p className="mt-1 font-display text-2xl font-bold tabular-nums">{s.value}</p>
            </div>
          ))}
        </section>

        {/* ---- Active plans ---- */}
        <section aria-labelledby="plans-h" className="mt-12">
          <div className="flex items-end justify-between">
            <h2 id="plans-h" className="text-2xl font-bold">
              Active plans
            </h2>
            <Link href="/app/plans" className="text-sm font-medium">
              All plans
            </Link>
          </div>
          <ul className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
            {plans.map((p, i) => {
              const steps = p.steps.filter((s) => s.kind !== "exam");
              const pct = steps.length ? steps.filter((s) => s.done).length / steps.length : 0;
              return (
                <li key={p.id} className="rise" style={{ "--i": i + 4 } as CSSProperties}>
                  <Link
                    href={`/app/plans/${p.id}`}
                    transitionTypes={["nav-forward"]}
                    className="lift group grid gap-5 rounded-[var(--radius-card)] border border-line bg-surface p-5 text-text no-underline"
                  >
                    <div className="flex items-start gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{p.subject}</p>
                        <p className="mt-0.5 text-sm text-muted">
                          Exam {dayInline(p.deadline, nowIso)}, {clock(p.deadline)}. {timeLeft(p.deadline, nowIso)} left.
                        </p>
                      </div>
                      <ProgressRing value={pct} size={48} stroke={5} />
                    </div>
                    <MiniPath steps={p.steps} />
                    <p className="flex items-center justify-between text-sm text-muted">
                      <span>{p.mode[0].toUpperCase() + p.mode.slice(1)} plan</span>
                      <ArrowUpRight size={17} strokeWidth={1.75} className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        {/* ---- Quick start + recent ---- */}
        <div className="mt-12 grid gap-10 lg:grid-cols-[1.2fr_1fr]">
          <section aria-labelledby="quick-h">
            <h2 id="quick-h" className="text-2xl font-bold">
              Start something new
            </h2>
            <p className="mt-1 text-muted">One sentence is enough. Tap one or write your own.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {quick.map((q) => (
                <button key={q} type="button" onClick={() => quickStart(q)} className="chip text-sm">
                  <Sparkles size={14} strokeWidth={1.75} className="text-ember" aria-hidden="true" />
                  {q}
                </button>
              ))}
            </div>
          </section>
          <section aria-labelledby="recent-h">
            <h2 id="recent-h" className="text-2xl font-bold">
              Recent sessions
            </h2>
            <ul className="mt-4 divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
              {[...state.sessions]
                .sort((a, b) => b.updated.localeCompare(a.updated))
                .slice(0, 5)
                .map((s) => (
                  <li key={s.id}>
                    <Link href={`/app/s/${s.id}`} transitionTypes={["nav-forward"]} className="flex items-center gap-3 px-4 py-3 text-text no-underline transition-colors hover:bg-text/[0.03]">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{s.title}</span>
                        <span className="block truncate text-xs text-muted">{s.subject || "No subject yet"}</span>
                      </span>
                      <span className="shrink-0 text-xs text-muted">{ago(s.updated, nowIso)}</span>
                    </Link>
                  </li>
                ))}
            </ul>
          </section>
        </div>
      </Main>
    </PageTransition>
  );
}
