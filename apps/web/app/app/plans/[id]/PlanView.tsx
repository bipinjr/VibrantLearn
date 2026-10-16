"use client";

import { ArrowLeft, MessageSquareText, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Main, PageHeader, PageTransition } from "@/components/app/Page";
import { PlanTimeline } from "@/components/learn/PlanTimeline";
import { ProgressRing } from "@/components/learn/ProgressRing";
import { useDemo } from "@/lib/demo/store";
import { useUi } from "@/lib/i18n/context";
import { MODE_LABEL } from "@/lib/i18n/ui";
import { clock, dayInline, timeLeft } from "@/lib/format";

export function PlanView({ id }: { id: string }) {
  const { state, now, toggleStep, replan } = useDemo();
  const { t, lang } = useUi();
  const [replanned, setReplanned] = useState(false);
  const plan = state.plans.find((p) => p.id === id);
  const nowIso = now.toISOString();

  if (!plan) {
    return (
      <Main>
        <PageHeader title={t("Plan not found")} sub={t("It may have been replaced by a newer plan in its session.")} />
        <Link href="/app/plans" className="btn btn-secondary mt-6">
          {t("Back to plans")}
        </Link>
      </Main>
    );
  }

  const steps = plan.steps.filter((s) => s.kind !== "exam");
  const done = steps.filter((s) => s.done).length;
  const behind = plan.steps.filter((s) => !s.done && s.kind !== "exam" && new Date(s.end ?? s.start) < now).length;
  const minutesLeft = plan.steps.filter((s) => !s.done && s.kind !== "exam").reduce((a, s) => a + (s.minutes ?? 0), 0);

  return (
    <PageTransition>
      <title>{`${plan.subject} plan | VibrantLearn`}</title>
      <Main>
        <Link href="/app/plans" transitionTypes={["nav-back"]} className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted no-underline hover:text-text">
          <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" /> {t("Plans")}
        </Link>
        <PageHeader
          title={plan.subject}
          sub={t("Exam {day} at {time}. {left} to go.", { day: dayInline(plan.deadline, nowIso, lang), time: clock(plan.deadline), left: timeLeft(plan.deadline, nowIso, lang) })}
          actions={
            <>
              <Link href={`/app/s/${plan.sessionId}`} transitionTypes={["nav-forward"]} className="btn btn-secondary">
                <MessageSquareText size={16} strokeWidth={1.75} aria-hidden="true" /> {t("Open session")}
              </Link>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  replan(plan.id);
                  setReplanned(true);
                }}
              >
                <RefreshCw size={16} strokeWidth={2} aria-hidden="true" /> {t("Replan from now")}
              </button>
            </>
          }
        />

        <div className="rise mt-8 grid gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:grid-cols-[auto_1fr] sm:items-center" style={{ "--i": 1 } as React.CSSProperties}>
          <ProgressRing value={steps.length ? done / steps.length : 0} size={72} stroke={7} />
          <div className="grid gap-1 text-sm">
            <p className="text-base font-semibold">
              {t("{done} of {total} steps done", { done, total: steps.length })}
            </p>
            <p className="text-muted">
              {t("About {h} h {m} min of study left.", { h: Math.floor(minutesLeft / 60), m: minutesLeft % 60 })} {t(MODE_LABEL[plan.mode])}.
            </p>
            <div className="reveal" data-open={behind > 0 || replanned}>
              <div>
                <p className="mt-1 rounded-[var(--radius-input)] bg-amber/15 px-3 py-2">
                  {replanned
                    ? t("Replanned. Finished steps stay ticked; everything else now starts from the current time, highest-mark topics first.")
                    : t(behind === 1 ? "{n} step is behind schedule. Replan from now to fit the time you have left." : "{n} steps are behind schedule. Replan from now to fit the time you have left.", { n: behind })}
                </p>
              </div>
            </div>
          </div>
        </div>

        <section aria-label={t("Timeline")} className="mt-8">
          <PlanTimeline key={plan.steps.map((s) => s.id).join()} plan={plan} nowIso={nowIso} onToggle={(stepId) => toggleStep(plan.id, stepId)} />
        </section>
      </Main>
    </PageTransition>
  );
}
