"use client";

// Teacher portal building blocks (TEACHER.md): onboarding questionnaire, application steps, cards.

import { Star } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type SubmitEvent } from "react";
import { ApiError } from "@/lib/api/client";
import {
  applyToTeach,
  rupees,
  withdraw,
  type Day,
  type Earnings,
  type Level,
  type Slot,
  type Teacher,
  type TeacherProfile,
  type TeacherStats,
} from "@/lib/api/classes";
import { DOC_TYPES, savePayout, teachSubjects, uploadDocument, type Payout } from "@/lib/api/teachers";
import { useUi } from "@/lib/i18n/context";

export const DAYS: [Day, string][] = [["mon", "Mon"], ["tue", "Tue"], ["wed", "Wed"], ["thu", "Thu"], ["fri", "Fri"], ["sat", "Sat"], ["sun", "Sun"]];
export const SLOTS: [Slot, string][] = [["5-6pm", "5–6 PM"], ["6-7pm", "6–7 PM"], ["7-8pm", "7–8 PM"], ["8-9pm", "8–9 PM"], ["9-10pm", "9–10 PM"]];
export const LEVELS: [Level, string][] = [["beginner", "Beginner friendly"], ["exam_prep", "Exam prep"], ["all", "All levels"]];
export const LANGS: ["en" | "kn" | "hi", string][] = [["en", "English"], ["kn", "Kannada"], ["hi", "Hindi"]];

export function Chips<T extends string>({ legend, name, options, value, onChange, hint }: {
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
export function Questionnaire({ teacher, onDone }: { teacher: Teacher | null; onDone: () => void }) {
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
    organisation: teacher?.organisation ?? "",
  });
  const [consent, setConsent] = useState(Boolean(teacher));
  const [subjectList, setSubjectList] = useState<string[] | null>(null);
  useEffect(() => {
    teachSubjects()
      .then(setSubjectList)
      .catch(() => setSubjectList([]));
  }, []);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof TeacherProfile>(k: K, v: TeacherProfile[K]) => setP((x) => ({ ...x, [k]: v }));

  async function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!p.subjects.length) return setProblem(t("Pick at least one subject you teach."));
    if (!p.languages.length) return setProblem(t("Pick at least one language."));
    if (!p.levels.length) return setProblem(t("Pick at least one level."));
    if (!consent) return setProblem(t("Tick the box to agree to the teacher terms."));
    setBusy(true);
    setProblem(null);
    try {
      await applyToTeach({ ...p, subjects: p.subjects.slice(0, 8), consent: true });
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
          <label htmlFor="organisation" className="text-sm font-medium">{t("College or organisation")}</label>
          <input id="organisation" maxLength={120} value={p.organisation} onChange={(e) => set("organisation", e.target.value)} className="field" placeholder="Seshadripuram College, Bengaluru" />
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
      {subjectList === null ? (
        <p role="status" className="text-sm text-muted">{t("Loading subjects…")}</p>
      ) : (
        <Chips legend="Subjects you can teach" name="subjects" hint="From the BCU syllabus. Up to 8." options={subjectList.map((s) => [s, s] as [string, string])} value={p.subjects} onChange={(v) => set("subjects", v.slice(0, 8))} />
      )}
      <Chips legend="Preferred days" name="days" options={DAYS} value={p.preferred_days} onChange={(v) => set("preferred_days", v)} />
      <Chips legend="Preferred timings" name="slots" hint="Evening slots, India time." options={SLOTS} value={p.preferred_slots} onChange={(v) => set("preferred_slots", v)} />
      <Chips legend="You teach in" name="languages" options={LANGS} value={p.languages} onChange={(v) => set("languages", v)} />
      <Chips legend="Who your classes suit" name="levels" options={LEVELS} value={p.levels} onChange={(v) => set("levels", v)} />
      <div className="grid gap-1.5">
        <label htmlFor="bio" className="text-sm font-medium">{t("About you")}</label>
        <textarea id="bio" maxLength={600} rows={3} value={p.bio} onChange={(e) => set("bio", e.target.value)} className="field" placeholder={t("Where you teach or work, and how you like to explain things.")} />
      </div>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 size-4 accent-[var(--color-violet)]" />
        <span>
          {t("I agree to teach live only, never record students, never ask for contact details, and follow the class rules. I understand my document is checked by the VibrantLearn team.")}{" "}
          <Link href="/privacy">{t("Privacy notice")}</Link>
        </span>
      </label>
      {problem ? <p role="alert" className="text-sm text-danger">{problem}</p> : null}
      <button type="submit" className="btn btn-primary w-fit" disabled={busy}>
        {busy ? t("Saving…") : teacher ? t("Save profile") : t("Save and continue")}
      </button>
    </form>
  );
}

export function Stars({ value }: { value: number }) {
  return (
    <span aria-hidden="true" className="inline-flex gap-0.5 align-middle">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={18} strokeWidth={1.75} className={i <= Math.round(value) ? "fill-ember text-ember" : "text-mist/40"} />
      ))}
    </span>
  );
}

export function ProfileCard({ teacher, stats }: { teacher: Teacher; stats: TeacherStats }) {
  const { t } = useUi();
  const numbers: [string, string][] = [
    [String(stats.classes_done), t("classes taught")],
    [String(stats.students_taught), t("students taught")],
    [String(stats.avg_students), t("students per class")],
    [String(stats.upcoming), t("rooms coming up")],
    [String(stats.interested_total), t("students interested so far")],
  ];
  return (
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

  );
}

export function EarningsCard({ earnings, onChange }: { earnings: Earnings; onChange: (e: Earnings) => void }) {
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
  return (
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
  );
}

/** T1: the two things a reviewer needs besides the profile. Both are shown masked once saved. */
export function Application({ teacher, payout, onDone }: { teacher: Teacher; payout: Payout | null; onDone: () => void }) {
  const { t } = useUi();
  const [docBusy, setDocBusy] = useState(false);
  const [docProblem, setDocProblem] = useState<string | null>(null);
  const [method, setMethod] = useState<"upi" | "bank">(payout?.method ?? "upi");
  const [payBusy, setPayBusy] = useState(false);
  const [payProblem, setPayProblem] = useState<string | null>(null);

  async function pickDoc(file: File | undefined) {
    if (!file) return;
    setDocBusy(true);
    setDocProblem(null);
    try {
      await uploadDocument(file);
      onDone();
    } catch (err) {
      setDocProblem(err instanceof Error ? err.message : t("Couldn't upload. Try again."));
    } finally {
      setDocBusy(false);
    }
  }

  async function submitPayout(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setPayBusy(true);
    setPayProblem(null);
    try {
      await savePayout(
        method === "upi"
          ? { method, upi_id: String(f.get("upi_id") ?? "").trim() }
          : {
              method,
              account_name: String(f.get("account_name") ?? "").trim(),
              account_number: String(f.get("account_number") ?? "").replace(/\s/g, ""),
              ifsc: String(f.get("ifsc") ?? "").trim().toUpperCase(),
            },
      );
      onDone();
    } catch (err) {
      setPayProblem(err instanceof ApiError ? err.message : t("Couldn't save. Check the details and try again."));
    } finally {
      setPayBusy(false);
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section aria-labelledby="doc-h" className="rounded-[var(--radius-card)] border border-line p-5">
        <h3 id="doc-h" className="font-semibold">{teacher.has_document ? t("Document uploaded") : t("Certificate or college ID")}</h3>
        <p className="mt-1 text-sm text-muted">
          {teacher.has_document
            ? t("Only the VibrantLearn review team sees it. Upload again to replace it.")
            : t("A teaching certificate, degree certificate or college staff ID. PDF, JPG or PNG, up to 5 MB.")}
        </p>
        <label className="btn btn-secondary mt-4 w-fit cursor-pointer">
          {docBusy ? t("Uploading…") : teacher.has_document ? t("Replace document") : t("Upload document")}
          <input type="file" accept={Object.keys(DOC_TYPES).join(",")} className="sr-only" disabled={docBusy} onChange={(e) => pickDoc(e.target.files?.[0])} />
        </label>
        {docProblem ? <p role="alert" className="mt-2 text-sm text-danger">{docProblem}</p> : null}
      </section>

      <section aria-labelledby="pay-h" className="rounded-[var(--radius-card)] border border-line p-5">
        <h3 id="pay-h" className="font-semibold">{t("Where we pay you")}</h3>
        {payout ? <p className="mt-1 text-sm text-muted">{t("Saved: {d}", { d: payout.method === "upi" ? `UPI ${payout.display}` : payout.display })}</p> : null}
        <form onSubmit={submitPayout} className="mt-3 grid gap-3">
          <div className="flex gap-2" role="radiogroup" aria-label={t("Payout method")}>
            {(["upi", "bank"] as const).map((m) => (
              <label key={m} className="chip">
                <input type="radio" name="method" checked={method === m} onChange={() => setMethod(m)} />
                {m === "upi" ? "UPI" : t("Bank account")}
              </label>
            ))}
          </div>
          {method === "upi" ? (
            <input name="upi_id" required placeholder="name@okaxis" aria-label={t("UPI ID")} className="field" autoComplete="off" />
          ) : (
            <>
              <input name="account_name" required minLength={2} maxLength={80} placeholder={t("Account holder's name")} aria-label={t("Account holder's name")} className="field" />
              <input name="account_number" required inputMode="numeric" pattern="[0-9 ]{9,22}" placeholder={t("Account number")} aria-label={t("Account number")} className="field" autoComplete="off" />
              <input name="ifsc" required pattern="[A-Za-z]{4}0[A-Za-z0-9]{6}" placeholder="HDFC0001234" aria-label="IFSC" className="field uppercase" autoComplete="off" />
            </>
          )}
          {payProblem ? <p role="alert" className="text-sm text-danger">{payProblem}</p> : null}
          <button type="submit" className="btn btn-secondary w-fit" disabled={payBusy}>{payBusy ? t("Saving…") : payout ? t("Update payout details") : t("Save payout details")}</button>
        </form>
      </section>
    </div>
  );
}

