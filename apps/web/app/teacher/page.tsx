"use client";

import { Star } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, type SubmitEvent } from "react";
import { Main, PageHeader, PageTransition } from "@/components/app/Page";
import { ApiError } from "@/lib/api/client";
import {
  applyToTeach,
  cancelClass,
  listClasses,
  myTeaching,
  postClass,
  rupees,
  withdraw,
  type Day,
  type Earnings,
  type Level,
  type LiveClass,
  type Slot,
  type Teacher,
  type TeacherProfile,
  type TeacherStats,
} from "@/lib/api/classes";
import { SUBJECTS } from "@/lib/demo/syllabus";
import { clock, dayLabel } from "@/lib/format";
import { useUi } from "@/lib/i18n/context";

const DAYS: [Day, string][] = [["mon", "Mon"], ["tue", "Tue"], ["wed", "Wed"], ["thu", "Thu"], ["fri", "Fri"], ["sat", "Sat"], ["sun", "Sun"]];
const SLOTS: [Slot, string][] = [["5-6pm", "5–6 PM"], ["6-7pm", "6–7 PM"], ["7-8pm", "7–8 PM"], ["8-9pm", "8–9 PM"], ["9-10pm", "9–10 PM"]];
const LEVELS: [Level, string][] = [["beginner", "Beginner friendly"], ["exam_prep", "Exam prep"], ["all", "All levels"]];
const LANGS: ["en" | "kn" | "hi", string][] = [["en", "English"], ["kn", "Kannada"], ["hi", "Hindi"]];

/** Local "YYYY-MM-DDTHH:MM" for <input type="datetime-local">, one hour from now, on the half hour. */
function defaultStart(): string {
  const d = new Date(Date.now() + 60 * 60_000);
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function Chips<T extends string>({ legend, name, options, value, onChange, hint }: {
  legend: string; name: string; options: [T, string][]; value: T[]; onChange: (v: T[]) => void; hint?: string;
}) {
  const { t } = useUi();
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium">{t(legend)}</legend>
      {hint ? <p className="-mt-1 mb-1 text-sm text-muted">{t(hint)}</p> : null}
      <div className="flex flex-wrap gap-2">
        {options.map(([id, label]) => (
          <label key={id} className="chip">
            <input
              type="checkbox"
              name={name}
              checked={value.includes(id)}
              onChange={(e) => onChange(e.target.checked ? [...value, id] : value.filter((x) => x !== id))}
            />
            {t(label)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** The teacher sign-up questionnaire, like the students' setup. Also used to edit the profile. */
function Questionnaire({ teacher, onDone }: { teacher: Teacher | null; onDone: () => void }) {
  const { t } = useUi();
  const [p, setP] = useState<TeacherProfile>({
    display_name: teacher?.display_name ?? "",
    bio: teacher?.bio ?? "",
    subjects: teacher?.subjects ?? [],
    qualification: teacher?.qualification ?? "",
    experience_years: teacher?.experience_years ?? 0,
    languages: teacher?.languages ?? ["en"],
    preferred_days: teacher?.preferred_days ?? [],
    preferred_slots: teacher?.preferred_slots ?? [],
    levels: teacher?.levels ?? ["all"],
  });
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof TeacherProfile>(k: K, v: TeacherProfile[K]) => setP((x) => ({ ...x, [k]: v }));

  async function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!p.subjects.length) return setProblem(t("Pick at least one subject you teach."));
    if (!p.languages.length) return setProblem(t("Pick at least one language."));
    if (!p.levels.length) return setProblem(t("Pick at least one level."));
    setBusy(true);
    setProblem(null);
    try {
      await applyToTeach({ ...p, subjects: p.subjects.slice(0, 8) });
      onDone();
    } catch (err) {
      setProblem(err instanceof ApiError ? err.message : t("Couldn't save your profile. Try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 grid max-w-2xl gap-7">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <label htmlFor="display_name" className="text-sm font-medium">{t("Name students will see")}</label>
          <input id="display_name" required minLength={2} maxLength={60} value={p.display_name} onChange={(e) => set("display_name", e.target.value)} className="field" placeholder="Ravi Kumar" />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="qualification" className="text-sm font-medium">{t("Highest qualification")}</label>
          <input id="qualification" maxLength={120} value={p.qualification} onChange={(e) => set("qualification", e.target.value)} className="field" placeholder="MCA, M.Sc Computer Science" />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="experience" className="text-sm font-medium">{t("Years of teaching")}</label>
          <input id="experience" type="number" min={0} max={60} value={p.experience_years} onChange={(e) => set("experience_years", Math.max(0, Math.min(60, Number(e.target.value) || 0)))} className="field" />
        </div>
      </div>
      <Chips legend="Subjects you focus on" name="subjects" hint="Up to 8. Students filter rooms by subject." options={SUBJECTS.map((s) => [s, s] as [string, string])} value={p.subjects} onChange={(v) => set("subjects", v.slice(0, 8))} />
      <Chips legend="Preferred days" name="days" options={DAYS} value={p.preferred_days} onChange={(v) => set("preferred_days", v)} />
      <Chips legend="Preferred timings" name="slots" hint="Evening slots, India time." options={SLOTS} value={p.preferred_slots} onChange={(v) => set("preferred_slots", v)} />
      <Chips legend="You teach in" name="languages" options={LANGS} value={p.languages} onChange={(v) => set("languages", v)} />
      <Chips legend="Who your classes suit" name="levels" options={LEVELS} value={p.levels} onChange={(v) => set("levels", v)} />
      <div className="grid gap-1.5">
        <label htmlFor="bio" className="text-sm font-medium">{t("About you")}</label>
        <textarea id="bio" maxLength={600} rows={3} value={p.bio} onChange={(e) => set("bio", e.target.value)} className="field" placeholder={t("Where you teach or work, and how you like to explain things.")} />
      </div>
      {problem ? <p role="alert" className="text-sm text-danger">{problem}</p> : null}
      <button type="submit" className="btn btn-primary w-fit" disabled={busy}>
        {busy ? t("Saving…") : teacher ? t("Save profile") : t("Finish setup")}
      </button>
    </form>
  );
}

function CreateRoom({ subjects, onDone, onClose }: { subjects: string[]; onDone: () => void; onClose: () => void }) {
  const { t } = useUi();
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
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
      onDone();
    } catch (err) {
      setProblem(err instanceof ApiError ? err.message : t("Couldn't create the room. Try again."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-labelledby="create-h" className="rounded-[var(--radius-sheet)] border border-line p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="create-h" className="text-2xl font-bold">{t("Create a room")}</h2>
        <button type="button" className="btn btn-secondary" onClick={onClose}>{t("Close")}</button>
      </div>
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
            {LEVELS.map(([id, label]) => <option key={id} value={id}>{t(label)}</option>)}
          </select>
        </div>
        <p className="self-end text-sm text-muted">
          {t("No link to share: students find the room in VibrantLearn, mark Interested and join here. You earn {net} per class.", { net: rupees(160_000) })}
        </p>
        {problem ? <p role="alert" className="text-sm text-danger sm:col-span-2">{problem}</p> : null}
        <button type="submit" className="btn btn-primary w-fit" disabled={busy}>{busy ? t("Creating…") : t("Create room")}</button>
      </form>
    </section>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span aria-hidden="true" className="inline-flex gap-0.5 align-middle">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={18} strokeWidth={1.75} className={i <= Math.round(value) ? "fill-ember text-ember" : "text-mist/40"} />
      ))}
    </span>
  );
}

function Dashboard({ teacher, stats, earnings, onChange }: { teacher: Teacher; stats: TeacherStats; earnings: Earnings; onChange: (e: Earnings) => void }) {
  const { t } = useUi();
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function ask() {
    setBusy(true);
    setProblem(null);
    try {
      onChange((await withdraw()).earnings);
    } catch (err) {
      setProblem(err instanceof ApiError ? err.message : t("Couldn't request the withdrawal. Try again."));
    } finally {
      setBusy(false);
    }
  }
  const numbers: [string, string][] = [
    [String(stats.classes_done), t("classes taught")],
    [String(stats.students_taught), t("students taught")],
    [String(stats.avg_students), t("students per class")],
    [String(stats.upcoming), t("rooms coming up")],
    [String(stats.interested_total), t("students interested so far")],
  ];
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <section aria-labelledby="profile-h" className="rounded-[var(--radius-sheet)] bg-ink p-6 text-mist sm:p-8" data-theme="dark">
        <h2 id="profile-h" className="font-display text-3xl font-bold">{teacher.display_name}</h2>
        <p className="mt-1 text-mist/75">
          {[teacher.qualification, teacher.experience_years ? t("{n} years teaching", { n: teacher.experience_years }) : ""].filter(Boolean).join(", ")}
        </p>
        <div className="mt-6 flex flex-wrap items-baseline gap-x-8 gap-y-3">
          <p>
            <span className="font-display text-5xl font-bold tabular-nums">{stats.rating ?? "–"}</span>{" "}
            {stats.rating ? <Stars value={stats.rating} /> : null}
            <span className="block text-sm text-mist/75">
              {stats.ratings ? t("from {n} student ratings", { n: stats.ratings }) : t("No ratings yet. Students rate after each class.")}
            </span>
          </p>
          <p>
            <span className="text-sm text-mist/75">{t("Focused subject")}</span>
            <span className="block text-xl font-semibold">{stats.focused_subject ?? teacher.subjects[0] ?? "–"}</span>
          </p>
        </div>
        <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-mist/15 pt-6 sm:grid-cols-3">
          {numbers.map(([n, label]) => (
            <div key={label}>
              <dt className="text-sm text-mist/75">{label}</dt>
              <dd className="font-display text-2xl font-bold tabular-nums">{n}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="earn-h" className="flex flex-col rounded-[var(--radius-sheet)] border border-line p-6 sm:p-8">
        <h2 id="earn-h" className="text-xl font-bold">{t("Earnings")}</h2>
        <p className="mt-3 font-display text-4xl font-bold tabular-nums">{rupees(earnings.to_be_paid_paise)}</p>
        <p className="text-sm text-muted">{t("ready to withdraw")}</p>
        <dl className="mt-4 grid gap-1 text-sm">
          <div className="flex justify-between"><dt className="text-muted">{t("Withdrawal requested")}</dt><dd className="tabular-nums">{rupees(earnings.requested_paise)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">{t("Paid so far")}</dt><dd className="tabular-nums">{rupees(earnings.paid_paise)}</dd></div>
        </dl>
        {problem ? <p role="alert" className="mt-3 text-sm text-danger">{problem}</p> : null}
        <button type="button" className="btn btn-primary mt-5 w-fit" disabled={busy || earnings.to_be_paid_paise === 0} onClick={ask}>
          {busy ? t("Requesting…") : t("Withdraw {amount}", { amount: rupees(earnings.to_be_paid_paise) })}
        </button>
        <p className="mt-3 text-xs text-muted">
          {t("Online payouts aren't switched on yet. We pay requested amounts by bank transfer within 7 days.")}
          {earnings.warnings ? ` ${t("Missed classes: {n} of {max} before suspension.", { n: earnings.warnings, max: earnings.warnings_to_suspend })}` : ""}
        </p>
      </section>
    </div>
  );
}

export default function TeacherHome() {
  const { t, lang } = useUi();
  const [teacher, setTeacher] = useState<Teacher | null | undefined>(undefined);
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [stats, setStats] = useState<TeacherStats | null>(null);
  const [mine, setMine] = useState<LiveClass[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);

  const load = useCallback(() => {
    myTeaching()
      .then((r) => {
        setTeacher(r.teacher);
        setEarnings(r.earnings);
        setStats(r.stats);
        setProblem(null);
        if (r.teacher?.status === "verified") return listClasses().then((c) => setMine(c.filter((x) => x.mine_teaching)));
      })
      .catch((e) => setProblem(e instanceof ApiError ? e.message : t("Couldn't load your dashboard. Check your connection.")));
  }, [t]);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 30_000); // rooms go live and fill up by the minute
    return () => window.clearInterval(id);
  }, [load]);

  async function cancel(id: string) {
    try {
      await cancelClass(id);
      load();
    } catch (e) {
      setProblem(e instanceof ApiError ? e.message : t("Couldn't cancel. Try again."));
    }
  }

  const nowIso = new Date().toISOString();
  const verified = teacher?.status === "verified";

  return (
    <PageTransition>
      <title>{`${t("Teacher dashboard")} | VibrantLearn`}</title>
      <Main wide>
        <PageHeader
          title={teacher === null ? t("Set up your teacher profile") : t("Your dashboard")}
          sub={teacher === null ? t("A few questions so students know who's teaching and when. Takes two minutes.") : t("Create a room, pick a time, and students join from VibrantLearn. No links to share.")}
          actions={verified && !creating ? <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>{t("Create a room")}</button> : null}
        />
        {problem ? (
          <p role="alert" className="mt-8 rounded-[var(--radius-input)] bg-rose/10 px-4 py-3 text-sm">{problem}</p>
        ) : teacher === undefined ? (
          <p role="status" className="mt-8 text-muted">{t("Loading…")}</p>
        ) : teacher === null ? (
          <Questionnaire teacher={null} onDone={load} />
        ) : teacher.status === "suspended" ? (
          <p className="mt-8 max-w-xl">{t("Your teaching account is suspended after 3 missed classes. Write to us if you think this is wrong.")}</p>
        ) : (
          <div className="mt-8 grid gap-10">
            {teacher.status === "pending" ? (
              <p className="max-w-2xl rounded-[var(--radius-input)] bg-violet/10 px-4 py-3">
                {t("Your profile is being reviewed. We check every teacher before they can create rooms; it usually takes a day.")}
              </p>
            ) : null}
            {creating ? (
              <CreateRoom
                subjects={teacher.subjects.length ? teacher.subjects : ["Java Programming"]}
                onClose={() => setCreating(false)}
                onDone={() => {
                  setCreating(false);
                  load();
                }}
              />
            ) : null}
            {stats && earnings ? <Dashboard teacher={teacher} stats={stats} earnings={earnings} onChange={setEarnings} /> : null}

            {verified ? (
              <section aria-labelledby="mine-h">
                <h2 id="mine-h" className="text-2xl font-bold">{t("Your rooms")}</h2>
                {mine.length === 0 ? (
                  <p className="mt-3 text-muted">{t("No rooms yet. Use Create a room to pick a time.")}</p>
                ) : (
                  <ul className="mt-3 divide-y divide-line">
                    {mine.map((c) => (
                      <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                        <span>
                          <span className="block font-semibold">{c.topic}</span>
                          <span className="text-sm text-muted">
                            {c.subject}. {dayLabel(c.starts_at, nowIso, lang)}, {clock(c.starts_at)}. {t("{n} interested", { n: c.interested })}
                            {c.interested < c.min_students && c.phase === "upcoming" ? `, ${t("needs {min} to run", { min: c.min_students })}` : ""}.
                            {c.phase === "cancelled" ? ` ${c.cancel_reason ?? ""}` : ""}
                            {c.phase === "done" ? ` ${t("Finished.")}` : ""}
                          </span>
                        </span>
                        {c.phase === "teacher_early" || c.phase === "grace" || c.phase === "open" ? (
                          <Link href={`/teacher/room/${c.id}`} className="btn btn-primary">{t("Start the class")}</Link>
                        ) : c.phase === "upcoming" ? (
                          <button type="button" className="btn btn-secondary" onClick={() => cancel(c.id)}>{t("Cancel room")}</button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ) : null}

            <section aria-labelledby="prof-h">
              <div className="flex items-center justify-between gap-3">
                <h2 id="prof-h" className="text-2xl font-bold">{t("Profile")}</h2>
                {!editing ? <button type="button" className="btn btn-secondary" onClick={() => setEditing(true)}>{t("Edit profile")}</button> : null}
              </div>
              {editing ? (
                <Questionnaire
                  teacher={teacher}
                  onDone={() => {
                    setEditing(false);
                    load();
                  }}
                />
              ) : (
                <p className="mt-2 max-w-2xl text-muted">
                  {teacher.subjects.join(", ")}. {t("Prefers {slots} on {days}.", {
                    slots: teacher.preferred_slots.map((s) => SLOTS.find((x) => x[0] === s)?.[1] ?? s).join(", ") || t("any time"),
                    days: teacher.preferred_days.map((d) => DAYS.find((x) => x[0] === d)?.[1] ?? d).join(", ") || t("any day"),
                  })}
                </p>
              )}
            </section>
          </div>
        )}
      </Main>
    </PageTransition>
  );
}
