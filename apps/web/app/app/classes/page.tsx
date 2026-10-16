"use client";

import { Star } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Main, PageHeader, PageTransition } from "@/components/app/Page";
import { ApiError } from "@/lib/api/client";
import { listClasses, rateClass, setInterest, type LiveClass } from "@/lib/api/classes";
import { useDemo } from "@/lib/demo/store";
import { clock, dayLabel } from "@/lib/format";
import { useUi } from "@/lib/i18n/context";

const LEVEL = { beginner: "Beginner friendly", exam_prep: "Exam prep", all: "All levels" } as const;

/** Students who sat in a class rate it afterwards; the teacher's dashboard shows the average. */
function Rate({ classId, initial }: { classId: string; initial: number | null }) {
  const { t } = useUi();
  const [stars, setStars] = useState(initial);
  const [problem, setProblem] = useState<string | null>(null);
  async function pick(n: number) {
    setProblem(null);
    try {
      await rateClass(classId, n);
      setStars(n);
    } catch (e) {
      setProblem(e instanceof ApiError ? e.message : t("Couldn't save your rating. Try again."));
    }
  }
  return (
    <fieldset className="mt-2">
      <legend className="mb-1">{stars ? t("Your rating") : t("How was this class?")}</legend>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => pick(n)} aria-pressed={stars === n} aria-label={t("{n} of 5 stars", { n })} className="rounded p-1 hover:bg-text/5">
            <Star size={20} strokeWidth={1.75} aria-hidden="true" className={stars && n <= stars ? "fill-ember text-ember" : "text-muted"} />
          </button>
        ))}
      </div>
      {problem ? <p role="alert" className="text-danger">{problem}</p> : null}
    </fieldset>
  );
}

function Row({ c, nowIso, onChange }: { c: LiveClass; nowIso: string; onChange: () => void }) {
  const { t, lang } = useUi();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const live = c.phase === "grace" || c.phase === "open" || (c.mine_teaching && c.phase === "teacher_early");
  const short = c.interested < c.min_students;

  async function toggle() {
    setBusy(true);
    setProblem(null);
    try {
      await setInterest(c.id, !c.mine_interested);
      onChange();
    } catch (e) {
      setProblem(e instanceof ApiError ? e.message : t("Couldn't save that. Try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li id={`c-${c.id}`} className="grid scroll-mt-24 gap-2 py-5 target:bg-violet/5 sm:grid-cols-[7.5rem_1fr_auto] sm:items-start sm:gap-6">
      <p className="text-sm text-muted tabular-nums">
        <span className="block font-semibold text-text">{clock(c.starts_at)}</span>
        {dayLabel(c.starts_at, nowIso, lang)}, {t("{m} min", { m: c.duration_min })}
      </p>
      <div className="min-w-0">
        <p className="font-semibold">{c.topic}</p>
        <p className="text-sm text-muted">
          {c.subject}, {t("with {name}", { name: c.teacher })}. {t(LEVEL[c.level])}.
        </p>
        {c.phase === "cancelled" ? (
          <p className="mt-1 text-sm text-danger">{c.cancel_reason ?? t("Cancelled.")}</p>
        ) : c.phase === "done" || c.phase === "ended" ? (
          <div className="mt-1 text-sm">
            <p className="text-muted">{t("Finished.")}</p>
            {c.seated ? <Rate classId={c.id} initial={c.my_rating} /> : null}
          </div>
        ) : (
          <p className="mt-1 text-sm">
            {t("{n} interested", { n: c.interested })}
            <span className="text-muted">
              {short ? `. ${t("Needs {min} to run.", { min: c.min_students })}` : `. ${t("Up to {max} seats.", { max: c.max_students })}`}
            </span>
            {c.mine_interested && c.position ? <span className="text-muted">. {t("You're number {n} in the queue.", { n: c.position })}</span> : null}
          </p>
        )}
        {problem ? <p role="alert" className="mt-1 text-sm text-danger">{problem}</p> : null}
      </div>
      <div className="flex gap-2 sm:justify-end">
        {live ? (
          <Link href={`/app/classes/${c.id}`} className="btn btn-primary">
            {c.mine_teaching ? t("Open the room") : t("Join class")}
          </Link>
        ) : c.phase === "upcoming" || c.phase === "teacher_early" ? (
          c.mine_teaching ? (
            <span className="text-sm text-muted">{t("You're teaching")}</span>
          ) : (
            <button type="button" className={c.mine_interested ? "btn btn-secondary" : "btn btn-primary"} onClick={toggle} disabled={busy} aria-pressed={c.mine_interested}>
              {c.mine_interested ? t("Interested") : t("I'm interested")}
            </button>
          )
        ) : null}
      </div>
    </li>
  );
}

export default function ClassesPage() {
  const { mode, now } = useDemo();
  const { t } = useUi();
  const [classes, setClasses] = useState<LiveClass[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const load = useCallback(() => {
    listClasses()
      .then((c) => {
        setClasses(c);
        setProblem(null);
      })
      .catch((e) => setProblem(e instanceof ApiError ? e.message : t("Couldn't load classes. Check your connection.")));
  }, [t]);

  useEffect(() => {
    if (mode !== "account") return;
    load();
    const id = window.setInterval(load, 30_000); // seats and phases change by the minute
    return () => window.clearInterval(id);
  }, [mode, load]);

  return (
    <PageTransition>
      <title>{`${t("Live classes")} | VibrantLearn`}</title>
      <Main>
        <PageHeader
          title={t("Live classes")}
          sub={t("Small live classes, 10 to 40 students, taught by college teachers in the evening. Mark the ones you want; interested students get the first seats.")}
        />
        {mode !== "account" ? (
          <div className="mt-10 rounded-[var(--radius-sheet)] border border-dashed border-line p-8">
            <p className="font-display text-2xl font-bold">{t("Live classes need a real account")}</p>
            <p className="mt-2 max-w-[60ch] text-muted">
              {t("The demo can't seat you in a real class with real people. Create a free account to join one.")}
            </p>
            <Link href="/signup" className="btn btn-primary mt-5">{t("Create a free account")}</Link>
          </div>
        ) : problem ? (
          <p role="alert" className="mt-8 rounded-[var(--radius-input)] bg-rose/10 px-4 py-3 text-sm">{problem}</p>
        ) : classes === null ? (
          <ul className="mt-8 grid gap-4" aria-busy="true" aria-label={t("Loading classes")}>
            {[0, 1, 2].map((i) => (
              <li key={i} className="h-16 animate-pulse rounded-[var(--radius-card)] bg-text/[0.05] motion-reduce:animate-none" />
            ))}
          </ul>
        ) : classes.length === 0 ? (
          <div className="mt-10 rounded-[var(--radius-sheet)] border border-dashed border-line p-8">
            <p className="font-display text-2xl font-bold">{t("No classes scheduled yet")}</p>
            <p className="mt-2 text-muted">{t("Teachers create evening rooms here. Check back tonight.")}</p>
          </div>
        ) : (
          <ul className="mt-6 divide-y divide-line">
            {classes.map((c) => (
              <Row key={c.id} c={c} nowIso={now.toISOString()} onChange={load} />
            ))}
          </ul>
        )}
      </Main>
    </PageTransition>
  );
}
