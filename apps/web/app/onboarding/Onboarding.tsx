"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type SubmitEvent } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { api, ApiError } from "@/lib/api/client";
import { usernameProblem } from "@/lib/username";
import { FORMAT_LABELS, SAMPLE_NOTE, type Format, type Lang, type Style } from "./preview-copy";

export type ProfileDraft = {
  username: string;
  university: string;
  course: string;
  semester: number;
  scheme: string;
  language: Lang;
  style: Style;
  formats: Format[];
};

const COURSES = ["BCA", "BCom", "BSc", "PU", "Other"] as const;
const SCHEMES = ["SEP", "NEP", "Other"] as const;
const LANGS: { id: Lang; label: string }[] = [
  { id: "en", label: "English" },
  { id: "kn", label: "ಕನ್ನಡ Kannada" },
  { id: "hi", label: "हिन्दी Hindi" },
];

type Check = { state: "idle" | "checking" | "ok" | "bad"; message?: string };

export function Onboarding({ initial, startAt }: { initial: ProfileDraft; startAt: 1 | 2 }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(startAt);
  const [draft, setDraft] = useState(initial);
  const [consent, setConsent] = useState(false);
  const [check, setCheck] = useState<Check>({ state: "idle" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const set = <K extends keyof ProfileDraft>(k: K, v: ProfileDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  // Live username check: local rules first, then the API. Debounced so typing isn't punished.
  useEffect(() => {
    if (step !== 1) return;
    const name = draft.username;
    if (!name) return;
    const local = usernameProblem(name);
    const t = window.setTimeout(async () => {
      if (local) return setCheck({ state: "bad", message: local });
      setCheck({ state: "checking" });
      try {
        const r = await api<{ available: boolean; reason: string | null }>(
          `/usernames/available?u=${encodeURIComponent(name)}`,
        );
        setCheck(r.available ? { state: "ok", message: "That name is free." } : { state: "bad", message: r.reason ?? "That name is taken." });
      } catch (e) {
        setCheck({ state: "idle", message: e instanceof ApiError ? e.message : undefined });
      }
    }, 450);
    return () => window.clearTimeout(t);
  }, [draft.username, step]);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  async function save(body: Record<string, unknown>, then: () => void) {
    setSaving(true);
    setError(null);
    try {
      await api("/me", { method: "PATCH", body: JSON.stringify(body) });
      then();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const finish = () => {
    router.push("/app");
    router.refresh();
  };

  function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (step === 1) {
      const problem = usernameProblem(draft.username);
      if (problem) return setCheck({ state: "bad", message: problem });
      if (!consent) return setError("Tick the box to accept the privacy notice.");
      return save({ username: draft.username, consent: true }, () => setStep(2));
    }
    if (step === 2) {
      return save(
        { university: draft.university, course: draft.course, semester: draft.semester, scheme: draft.scheme },
        () => setStep(3),
      );
    }
    return save(
      { language: draft.language, style: draft.style, formats: draft.formats, finish_onboarding: true },
      finish,
    );
  }

  const usernameMsgId = "username-msg";

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col px-4 py-6 sm:px-10">
        <Wordmark height={24} href={null} />
        <main id="main" className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <p className="text-sm text-muted">Step {step} of 3</p>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-line" aria-hidden="true">
            <div
              className="h-full origin-left rounded-full bg-text transition-transform duration-[var(--dur-slow)] ease-[var(--ease-out)]"
              style={{ transform: `scaleX(${step / 3})` }}
            />
          </div>

          <form onSubmit={submit} className="mt-8 grid gap-6" noValidate>
            {step === 1 ? (
              <>
                <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-bold outline-none sm:text-4xl">
                  Pick a username
                </h1>
                <div className="grid gap-1.5">
                  <label htmlFor="username" className="text-sm font-medium">
                    Username
                  </label>
                  <input
                    id="username"
                    name="username"
                    className="field"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    maxLength={30}
                    value={draft.username}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      set("username", v);
                      if (!v) setCheck({ state: "idle" });
                    }}
                    aria-invalid={check.state === "bad" || undefined}
                    aria-describedby={usernameMsgId}
                  />
                  <p id={usernameMsgId} aria-live="polite" className={`min-h-5 text-sm ${check.state === "ok" ? "text-done" : check.state === "bad" ? "text-danger" : "text-muted"}`}>
                    {check.state === "checking" ? "Checking…" : (check.message ?? "Letters, numbers, dots and |. For example bipin.jr")}
                  </p>
                </div>
                <label className="flex items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5 size-5 shrink-0 accent-[var(--link)]"
                  />
                  <span>
                    I&rsquo;ve read the{" "}
                    <a href="/privacy" target="_blank" rel="noopener noreferrer">
                      privacy notice
                    </a>{" "}
                    and agree to VibrantLearn storing my profile and study data to make my plans.
                  </span>
                </label>
              </>
            ) : null}

            {step === 2 ? (
              <>
                <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-bold outline-none sm:text-4xl">
                  What are you studying?
                </h1>
                <div className="grid gap-1.5">
                  <label htmlFor="university" className="text-sm font-medium">
                    University or board
                  </label>
                  <input id="university" className="field" maxLength={120} value={draft.university} onChange={(e) => set("university", e.target.value)} />
                </div>
                <fieldset className="grid gap-2">
                  <legend className="mb-2 text-sm font-medium">Course</legend>
                  <div className="flex flex-wrap gap-2">
                    {COURSES.map((c) => (
                      <label key={c} className="chip">
                        <input type="radio" name="course" checked={draft.course === c} onChange={() => set("course", c)} />
                        {c}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="grid gap-1.5">
                  <label htmlFor="semester" className="text-sm font-medium">
                    Semester
                  </label>
                  <select id="semester" className="field" value={draft.semester} onChange={(e) => set("semester", Number(e.target.value))}>
                    {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        Semester {n}
                      </option>
                    ))}
                  </select>
                </div>
                <fieldset className="grid gap-2">
                  <legend className="mb-2 text-sm font-medium">Syllabus scheme</legend>
                  <div className="flex flex-wrap gap-2">
                    {SCHEMES.map((s) => (
                      <label key={s} className="chip">
                        <input type="radio" name="scheme" checked={draft.scheme === s} onChange={() => set("scheme", s)} />
                        {s}
                      </label>
                    ))}
                  </div>
                </fieldset>
              </>
            ) : null}

            {step === 3 ? (
              <>
                <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-bold outline-none sm:text-4xl">
                  How do you like to study?
                </h1>
                <fieldset className="grid gap-2">
                  <legend className="mb-2 text-sm font-medium">Explain things in</legend>
                  <div className="flex flex-wrap gap-2">
                    {LANGS.map((l) => (
                      <label key={l.id} className="chip">
                        <input type="radio" name="language" checked={draft.language === l.id} onChange={() => set("language", l.id)} />
                        {l.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="grid gap-2">
                  <legend className="mb-2 text-sm font-medium">Notes should be</legend>
                  <div className="flex flex-wrap gap-2">
                    {(["short", "detailed"] as const).map((s) => (
                      <label key={s} className="chip">
                        <input type="radio" name="style" checked={draft.style === s} onChange={() => set("style", s)} />
                        {s === "short" ? "Short" : "Detailed"}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="grid gap-2">
                  <legend className="mb-2 text-sm font-medium">I like (pick any)</legend>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(FORMAT_LABELS) as Format[]).map((f) => (
                      <label key={f} className="chip">
                        <input
                          type="checkbox"
                          checked={draft.formats.includes(f)}
                          onChange={(e) =>
                            set("formats", e.target.checked ? [...draft.formats, f] : draft.formats.filter((x) => x !== f))
                          }
                        />
                        {FORMAT_LABELS[f]}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="lg:hidden">
                  <NotePreview language={draft.language} style={draft.style} />
                </div>
              </>
            ) : null}

            <div className="reveal" data-open={Boolean(error)}>
              <p role="alert" className="rounded-[var(--radius-input)] bg-rose/10 px-3 py-2 text-sm">
                {error}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <button type="submit" className="btn btn-primary" disabled={saving || (step === 1 && check.state === "bad")}>
                {saving ? "Saving…" : step === 3 ? "Finish setup" : "Continue"}
              </button>
              {step > 1 ? (
                <button
                  type="button"
                  className="rounded-md px-2 py-2 font-medium text-link underline-offset-4 hover:underline"
                  onClick={() => save({ finish_onboarding: true }, finish)}
                  disabled={saving}
                >
                  Skip for now
                </button>
              ) : null}
            </div>
          </form>
        </main>
      </div>

      <aside className="hidden items-center bg-surface p-12 lg:flex" aria-label="Preview of your notes">
        <div className="mx-auto w-full max-w-md">
          <p className="text-sm text-muted">This is how your notes will look</p>
          <NotePreview language={draft.language} style={draft.style} formats={draft.formats} />
        </div>
      </aside>
    </div>
  );
}

function NotePreview({ language, style, formats }: { language: Lang; style: Style; formats?: Format[] }) {
  return (
    <div className="mt-3 rounded-[var(--radius-card)] border border-line bg-bg p-5">
      <p className="text-sm text-muted">Java Programming, Unit 3</p>
      <h2 className="mt-1 text-xl font-bold">Method overriding</h2>
      <p key={`${language}-${style}`} lang={language} className="mt-3 animate-[fade_var(--dur-base)_var(--ease-out)]">
        {SAMPLE_NOTE[language][style]}
      </p>
      {formats && formats.length > 0 ? (
        <ul className="mt-5 flex flex-wrap gap-2" aria-label="Also in your plan">
          {formats.map((f) => (
            <li key={f} className="rounded-[var(--radius-chip)] bg-surface px-3 py-1 text-xs">
              {FORMAT_LABELS[f]}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
