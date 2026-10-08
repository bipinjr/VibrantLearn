"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { Main, PageHeader, PageTransition } from "@/components/app/Page";
import { MiniPath } from "@/components/learn/MiniPath";
import { ProgressRing } from "@/components/learn/ProgressRing";
import { useDemo } from "@/lib/demo/store";
import { clock, dayInline, timeLeft } from "@/lib/format";

export default function PlansPage() {
  const { state, now } = useDemo();
  const nowIso = now.toISOString();
  const plans = [...state.plans].sort((a, b) => a.deadline.localeCompare(b.deadline));

  return (
    <PageTransition>
      <title>Plans | VibrantLearn</title>
      <Main wide>
        <PageHeader title="Plans" sub="Every plan you're working on, soonest exam first." actions={<Link href="/app/new" className="btn btn-primary">New plan</Link>} />
        {plans.length === 0 ? (
          <div className="mt-10 rounded-[var(--radius-sheet)] border border-dashed border-line p-10 text-center">
            <p className="font-display text-2xl font-bold">No plans yet</p>
            <p className="mt-2 text-muted">Tell us your next test and the plan appears in a few seconds.</p>
            <Link href="/app/new" className="btn btn-primary mt-5">
              Plan my next test
            </Link>
          </div>
        ) : (
          <ul className="mt-8 grid gap-4">
            {plans.map((p, i) => {
              const steps = p.steps.filter((s) => s.kind !== "exam");
              const done = steps.filter((s) => s.done).length;
              return (
                <li key={p.id} className="rise" style={{ "--i": i } as CSSProperties}>
                  <Link href={`/app/plans/${p.id}`} transitionTypes={["nav-forward"]} className="lift group grid gap-5 rounded-[var(--radius-card)] border border-line bg-surface p-5 text-text no-underline sm:grid-cols-[auto_1fr_auto] sm:items-center sm:p-6">
                    <ProgressRing value={steps.length ? done / steps.length : 0} size={60} stroke={6} />
                    <div className="min-w-0">
                      <p className="text-lg font-semibold">{p.subject}</p>
                      <p className="text-sm text-muted">
                        Exam {dayInline(p.deadline, nowIso)} at {clock(p.deadline)}. {timeLeft(p.deadline, nowIso)} left, {done} of {steps.length} steps done.
                      </p>
                      <div className="mt-4 max-w-xl">
                        <MiniPath steps={p.steps} />
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-link">
                      Open <ArrowUpRight size={16} strokeWidth={1.75} className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Main>
    </PageTransition>
  );
}
