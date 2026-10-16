"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type SubmitEvent } from "react";
import { Main, PageHeader, PageTransition } from "@/components/app/Page";
import { ApiError } from "@/lib/api/client";
import { applyToTeach, cancelClass, listClasses, myTeaching, postClass, rupees, type Earnings, type LiveClass, type Teacher } from "@/lib/api/classes";
import { useDemo } from "@/lib/demo/store";
import { clock, dayLabel } from "@/lib/format";
import { useUi } from "@/lib/i18n/context";

/** Local "YYYY-MM-DDTHH:MM" for <input type="datetime-local">, one hour from now, on the half hour. */
function defaultStart(): string {
  const d = new Date(Date.now() + 60 * 60_000);
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function Apply({ teacher, onDone }: { teacher: Teacher | null; onDone: () => void }) {
  const { t } = useUi();
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setProblem(null);
    try {
      await applyToTeach({
        display_name: String(f.get("display_name") ?? ""),
        bio: String(f.get("bio") ?? ""),
        subjects: String(f.get("subjects") ?? "").split(",").map((s) => s.trim()).filter((s) => s.length >= 2).slice(0, 8),
      });
      onDone();
    } catch (err) {
      setProblem(err instanceof ApiError ? err.message : t("Couldn't send your application. Try again."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="mt-8 grid max-w-xl gap-4">
      <div className="grid gap-1.5">
        <label htmlFor="display_name" className="text-sm font-medium">{t("Name students will see")}</label>
        <input id="display_name" name="display_name" required minLength={2} maxLength={60} defaultValue={teacher?.display_name} className="field" />
      </div>
      <div className="grid gap-1.5">
        <label htmlFor="subjects" className="text-sm font-medium">{t("Subjects you teach")}</label>
        <input id="subjects" name="subjects" required maxLength={600} defaultValue={teacher?.subjects.join(", ")} placeholder="Java Programming, Database Management Systems" className="field" aria-describedby="subjects-hint" />
        <p id="subjects-hint" className="text-sm text-muted">{t("Separate them with commas. Up to 8.")}</p>
      </div>
      <div className="grid gap-1.5">
        <label htmlFor="bio" className="text-sm font-medium">{t("About you")}</label>
        <textarea id="bio" name="bio" maxLength={600} rows={4} defaultValue={teacher?.bio} className="field" placeholder={t("Where you teach or work, and how long you've taught these subjects.")} />
      </div>
      {problem ? <p role="alert" className="text-sm text-danger">{problem}</p> : null}
      <button type="submit" className="btn btn-primary w-fit" disabled={busy}>{busy ? t("Sending…") : teacher ? t("Update application") : t("Apply to teach")}</button>
    </form>
  );
}

function PostClass({ subjects, onDone }: { subjects: string[]; onDone: () => void }) {
  const { t } = useUi();
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true);
    setProblem(null);
    try {
      await postClass({
        subject: String(f.get("subject")),
        topic: String(f.get("topic")),
        level: String(f.get("level")),
        starts_at: new Date(String(f.get("starts_at"))).toISOString(),
        duration_min: Number(f.get("duration_min")),
      });
      form.reset();
      onDone();
    } catch (err) {
      setProblem(err instanceof ApiError ? err.message : t("Couldn't post the class. Try again."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <div className="grid gap-1.5">
        <label htmlFor="subject" className="text-sm font-medium">{t("Subject")}</label>
        <select id="subject" name="subject" required className="field">
          {subjects.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div className="grid gap-1.5">
        <label htmlFor="topic" className="text-sm font-medium">{t("Topic")}</label>
        <input id="topic" name="topic" required minLength={2} maxLength={160} className="field" placeholder="Unit 3: Inheritance and method overriding" />
      </div>
      <div className="grid gap-1.5">
        <label htmlFor="starts_at" className="text-sm font-medium">{t("Starts")}</label>
        <input id="starts_at" name="starts_at" type="datetime-local" required defaultValue={defaultStart()} className="field" />
      </div>
      <div className="grid gap-1.5">
        <label htmlFor="duration_min" className="text-sm font-medium">{t("Length")}</label>
        <select id="duration_min" name="duration_min" defaultValue="60" className="field">
          {[30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{t("{m} min", { m })}</option>)}
        </select>
      </div>
      <div className="grid gap-1.5">
        <label htmlFor="level" className="text-sm font-medium">{t("Level")}</label>
        <select id="level" name="level" defaultValue="all" className="field">
          <option value="all">{t("All levels")}</option>
          <option value="beginner">{t("Beginner friendly")}</option>
          <option value="exam_prep">{t("Exam prep")}</option>
        </select>
      </div>
      <p className="self-end text-sm text-muted">
        {t("Runs with 10 to 40 students. You earn {net} per class ({gross} minus the 20% platform fee), paid out later.", { net: rupees(160_000), gross: rupees(200_000) })}
      </p>
      {problem ? <p role="alert" className="text-sm text-danger sm:col-span-2">{problem}</p> : null}
      <button type="submit" className="btn btn-primary w-fit" disabled={busy}>{busy ? t("Posting…") : t("Post class")}</button>
    </form>
  );
}

export default function TeachPage() {
  const { mode, now } = useDemo();
  const { t, lang } = useUi();
  const [teacher, setTeacher] = useState<Teacher | null | undefined>(undefined);
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [mine, setMine] = useState<LiveClass[]>([]);
  const [problem, setProblem] = useState<string | null>(null);

  const load = useCallback(() => {
    myTeaching()
      .then((r) => {
        setTeacher(r.teacher);
        setEarnings(r.earnings);
        if (r.teacher?.status === "verified") listClasses().then((c) => setMine(c.filter((x) => x.mine_teaching)));
      })
      .catch((e) => setProblem(e instanceof ApiError ? e.message : t("Couldn't load this page. Check your connection.")));
  }, [t]);

  useEffect(() => {
    if (mode === "account") load();
  }, [mode, load]);

  async function cancel(id: string) {
    try {
      await cancelClass(id);
      load();
    } catch (e) {
      setProblem(e instanceof ApiError ? e.message : t("Couldn't cancel. Try again."));
    }
  }

  return (
    <PageTransition>
      <title>{`${t("Teach")} | VibrantLearn`}</title>
      <Main>
        <PageHeader title={t("Teach a live class")} sub={t("Evening classes for BCA students, 10 to 40 at a time. Live only, never recorded.")} />
        {mode !== "account" ? (
          <p className="mt-8 text-muted">{t("Teaching needs a real account.")} <Link href="/signup">{t("Create a free account")}</Link></p>
        ) : problem ? (
          <p role="alert" className="mt-8 rounded-[var(--radius-input)] bg-rose/10 px-4 py-3 text-sm">{problem}</p>
        ) : teacher === undefined ? (
          <p role="status" className="mt-8 text-muted">{t("Loading…")}</p>
        ) : teacher === null ? (
          <Apply teacher={null} onDone={load} />
        ) : teacher.status === "pending" ? (
          <div className="mt-8 max-w-xl">
            <p className="font-semibold">{t("Your application is being reviewed.")}</p>
            <p className="mt-1 text-muted">{t("We check every teacher before they can post. You can still edit what you sent.")}</p>
            <Apply teacher={teacher} onDone={load} />
          </div>
        ) : teacher.status === "suspended" ? (
          <p className="mt-8 max-w-xl">{t("Your teaching account is suspended after 3 missed classes. Write to us if you think this is wrong.")}</p>
        ) : (
          <div className="mt-8 grid gap-12">
            <section aria-labelledby="post-h">
              <h2 id="post-h" className="mb-4 text-2xl font-bold">{t("Post a class")}</h2>
              <PostClass subjects={teacher.subjects.length ? teacher.subjects : ["Java Programming"]} onDone={load} />
            </section>
            <section aria-labelledby="mine-h">
              <h2 id="mine-h" className="text-2xl font-bold">{t("Your classes")}</h2>
              {mine.length === 0 ? (
                <p className="mt-3 text-muted">{t("Nothing scheduled. Post your first class above.")}</p>
              ) : (
                <ul className="mt-3 divide-y divide-line">
                  {mine.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                      <span>
                        <span className="block font-semibold">{c.topic}</span>
                        <span className="text-sm text-muted">
                          {dayLabel(c.starts_at, now.toISOString(), lang)}, {clock(c.starts_at)}. {t("{n} interested", { n: c.interested })}.
                          {c.phase === "cancelled" ? ` ${c.cancel_reason ?? ""}` : ""}
                        </span>
                      </span>
                      {c.phase === "teacher_early" || c.phase === "grace" || c.phase === "open" ? (
                        <Link href={`/app/classes/${c.id}`} className="btn btn-primary">{t("Open the room")}</Link>
                      ) : c.phase === "upcoming" ? (
                        <button type="button" className="btn btn-secondary" onClick={() => cancel(c.id)}>{t("Cancel class")}</button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
            {earnings ? (
              <section aria-labelledby="earn-h">
                <h2 id="earn-h" className="text-2xl font-bold">{t("Earnings")}</h2>
                <p className="mt-2">
                  {t("{amount} to be paid", { amount: rupees(earnings.to_be_paid_paise) })}. <span className="text-muted">{t("{amount} paid so far.", { amount: rupees(earnings.paid_paise) })}</span>
                </p>
                <p className="mt-1 text-sm text-muted">
                  {t("Payouts aren't switched on yet; every class you teach is recorded here and paid once they are.")}{" "}
                  {earnings.warnings ? t("Missed classes: {n} of {max} before suspension.", { n: earnings.warnings, max: earnings.warnings_to_suspend }) : null}
                </p>
                {earnings.classes.length ? (
                  <ul className="mt-3 divide-y divide-line text-sm">
                    {earnings.classes.map((e) => (
                      <li key={e.class_id} className="flex justify-between gap-3 py-2">
                        <span>{e.topic} <span className="text-muted">({t("{n} students", { n: e.students })})</span></span>
                        <span className="tabular-nums">{rupees(e.net_paise)}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ) : null}
          </div>
        )}
      </Main>
    </PageTransition>
  );
}
