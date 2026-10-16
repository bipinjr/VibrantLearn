import { Check, FileText, Lock, ShieldCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { PlanPath } from "@/components/learn/PlanPath";
import { HeroDemo } from "@/components/marketing/HeroDemo";
import { LanguageNote } from "@/components/marketing/LanguageNote";
import { LiveTonight } from "@/components/marketing/LiveTonight";
import { demoEnabled } from "@/lib/demo/mode";
import { enterDemo } from "../(auth)/demo-actions";

const HEADLINE = "Tell us your exam. We’ll plan the hours you have.";
const SUBJECTS = ["Java Programming", "Python Programming", "DBMS", "Data Structures", "Computer Networks", "Operating Systems"];

function PrimaryCta({ demo, label }: { demo: boolean; label: string }) {
  return demo ? (
    <form action={enterDemo}>
      <button type="submit" className="btn btn-primary min-h-12 px-6 text-lg">
        {label}
      </button>
    </form>
  ) : (
    <Link href="/signup" className="btn btn-primary min-h-12 px-6 text-lg">
      Build my study plan
    </Link>
  );
}

export default function LandingPage() {
  const demo = demoEnabled();
  return (
    <>
      {/* ---- Hero ---- */}
      <section className="mx-auto grid max-w-6xl items-center gap-14 px-4 pt-10 pb-20 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pt-20 lg:pb-28">
        <div className="max-w-xl">
          <h1 className="text-[2.75rem] leading-[1.02] font-extrabold tracking-[-0.03em] sm:text-6xl lg:text-[4.75rem]">
            {HEADLINE.split(" ").map((w, i) => (
              <span key={i} className="hero-word" style={{ "--w": i } as CSSProperties}>
                {w}&nbsp;
              </span>
            ))}
          </h1>
          <p className="hero-fade mt-6 max-w-md text-lg text-muted" style={{ "--d": "700ms" } as CSSProperties}>
            Type what you&rsquo;re studying and when the test is. Get a timed plan with checkpoints, short notes, likely
            questions and quick quizzes, in English, Kannada or Hindi.
          </p>
          <div className="hero-fade mt-8 flex flex-wrap items-center gap-x-5 gap-y-3" style={{ "--d": "820ms" } as CSSProperties}>
            <PrimaryCta demo={demo} label="Try the live demo" />
            <Link href="/signup" className="font-medium">
              Create an account
            </Link>
          </div>
          {demo ? (
            <p className="hero-fade mt-4 text-sm text-muted" style={{ "--d": "900ms" } as CSSProperties}>
              The demo opens a sample account. No sign-up, nothing saved on our side.
            </p>
          ) : null}
        </div>
        <div className="scroll-recede">
          <HeroDemo />
        </div>
      </section>

      {/* ---- Syllabus ready for ---- */}
      <section aria-label="Subjects with a ready syllabus" className="border-y border-line bg-surface/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-5 sm:px-6">
          <p className="text-sm font-medium text-muted">Syllabus ready for BCU BCA</p>
          <ul className="flex flex-wrap gap-2">
            {SUBJECTS.map((s) => (
              <li key={s} className="rounded-full border border-line bg-surface px-3 py-1 text-sm">
                {s}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---- How it works (a real sequence, so it is numbered) ---- */}
      <section id="how" aria-labelledby="how-h" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6">
        <div className="scroll-in max-w-2xl">
          <h2 id="how-h" className="text-4xl font-bold sm:text-5xl">
            From one sentence to a plan you can finish
          </h2>
          <p className="mt-4 text-lg text-muted">Three steps. The first takes about ten seconds.</p>
        </div>
        <ol className="mt-14 grid gap-12 md:grid-cols-3 md:gap-8">
          <li className="scroll-in grid content-start gap-4">
            <p className="font-display text-5xl font-extrabold text-ember">1</p>
            <h3 className="text-xl font-bold">Tell us the exam</h3>
            <p className="text-muted">Subject, deadline, how you like to study. Plain words are fine, even Kanglish.</p>
            <div className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
              <p className="rounded-[var(--radius-input)] bg-bg px-3 py-2 text-sm">nale DBMS test ide, normalization weak</p>
              <p className="mt-3 text-sm text-muted">How many hours can you study tonight?</p>
              <div className="mt-2 flex flex-wrap gap-2" aria-hidden="true">
                {["2 hours", "3 hours", "4 hours"].map((h, i) => (
                  <span key={h} className={`chip pointer-events-none text-sm ${i === 1 ? "border-link bg-link/10" : ""}`}>
                    {h}
                  </span>
                ))}
              </div>
            </div>
          </li>
          <li className="scroll-in grid content-start gap-4">
            <p className="font-display text-5xl font-extrabold text-orchid">2</p>
            <h3 className="text-xl font-bold">Get your hours planned</h3>
            <p className="text-muted">Topics that carry the most marks come first, sized to the time you actually have.</p>
            <div className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
              <PlanPath
                compact
                label="Example DBMS plan"
                steps={[
                  { kind: "block", time: "7:00 – 7:50 PM", title: "Normal forms 1NF to BCNF", minutes: 50, state: "now" },
                  { kind: "block", time: "8:00 – 8:40 PM", title: "Functional dependencies", minutes: 40 },
                  { kind: "checkpoint", time: "8:45 PM", title: "Normalise one table yourself" },
                ]}
              />
            </div>
          </li>
          <li className="scroll-in grid content-start gap-4">
            <p className="font-display text-5xl font-extrabold text-violet">3</p>
            <h3 className="text-xl font-bold">Study, quiz, tick off</h3>
            <p className="text-muted">Each block has notes and a short quiz. Tick it off and the plan moves on.</p>
            <div className="grid gap-2 rounded-[var(--radius-card)] border border-line bg-surface p-4 text-sm" aria-hidden="true">
              <p className="font-medium">A table in 2NF can still have…</p>
              <p className="rounded-[var(--radius-input)] border border-line px-3 py-2">Partial dependencies</p>
              <p className="flex items-center justify-between rounded-[var(--radius-input)] border border-leaf bg-leaf/15 px-3 py-2 font-medium">
                Transitive dependencies <Check size={16} strokeWidth={2.5} />
              </p>
              <p className="rounded-[var(--radius-input)] border border-line px-3 py-2">Repeating groups</p>
            </div>
          </li>
        </ol>
      </section>

      {/* ---- What you get ---- */}
      <section aria-labelledby="get-h" className="bg-surface/60 py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="scroll-in max-w-2xl">
            <h2 id="get-h" className="text-4xl font-bold sm:text-5xl">
              Open any block and the studying is already there
            </h2>
          </div>
          <div className="mt-12 grid gap-x-12 gap-y-8 lg:grid-cols-[1fr_16rem]">
            <article className="scroll-in rounded-[var(--radius-sheet)] border border-line bg-surface p-5 shadow-[var(--shadow-float)] sm:p-8">
              <p className="text-sm text-muted">Java Programming, Unit 3</p>
              <h3 className="mt-1 text-2xl font-bold">Inheritance and method overriding</h3>
              <LanguageNote />
              <div className="mt-8 grid gap-8 md:grid-cols-2">
                <div>
                  <h4 className="font-display text-lg font-bold">Important questions</h4>
                  <ul className="mt-3 grid gap-3 text-sm">
                    {[
                      ["2 marks", "Define method overriding."],
                      ["5 marks", "Differentiate method overloading and method overriding with examples."],
                      ["10 marks", "Explain dynamic method dispatch with a Java program."],
                    ].map(([m, q]) => (
                      <li key={q} className="grid grid-cols-[4.25rem_1fr] gap-2">
                        <span className="text-muted">{m}</span> {q}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-display text-lg font-bold">Quick quiz</h4>
                  <p className="mt-3 text-sm font-medium">Which keyword calls the parent class version of an overridden method?</p>
                  <ul className="mt-3 grid grid-cols-2 gap-2 text-sm" aria-label="Options">
                    {["this", "super", "extends", "final"].map((o) => (
                      <li key={o} className={`rounded-[var(--radius-input)] border px-3 py-2 font-mono ${o === "super" ? "border-leaf bg-leaf/15 font-semibold" : "border-line"}`}>
                        {o}
                        {o === "super" ? <span className="sr-only"> (correct)</span> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </article>
            <aside className="grid content-start gap-7 text-sm text-muted lg:mt-12">
              {[
                ["Your language.", "Notes in English, Kannada or Hindi. Technical words stay in English, the way your exam asks them."],
                ["Marked like your paper.", "Questions come as 2, 5 and 10 mark answers, in your university's style."],
                ["Wrong answers come back.", "Miss a quiz question and it lands in a “Revise these” list before your next checkpoint."],
              ].map(([t, d]) => (
                <p key={t} className="scroll-in border-l-2 border-line pl-4">
                  <strong className="block text-base text-text">{t}</strong> {d}
                </p>
              ))}
            </aside>
          </div>
        </div>
      </section>

      {/* ---- Your notes ---- */}
      <section id="notes" aria-labelledby="notes-h" className="mx-auto grid max-w-6xl scroll-mt-20 gap-12 px-4 py-24 sm:px-6 lg:grid-cols-2 lg:items-center">
        <div className="scroll-in max-w-md">
          <h2 id="notes-h" className="text-4xl font-bold sm:text-5xl">
            Ask your own notes
          </h2>
          <p className="mt-4 text-lg text-muted">
            Upload your lecturer&rsquo;s PDF, slides or photos of your notebook. Ask about them by name and every answer
            shows which page it came from. If your notes don&rsquo;t cover it, we say so instead of guessing.
          </p>
          <p className="mt-4 text-sm text-muted">PDF, Word, PowerPoint, text, code files and photos, up to 50 MB each.</p>
        </div>
        <div className="scroll-in grid gap-4 rounded-[var(--radius-sheet)] border border-line bg-surface p-5 shadow-[var(--shadow-float)] sm:p-6">
          <p className="flex w-fit items-center gap-2 rounded-[var(--radius-chip)] border border-line px-3 py-1.5 text-sm">
            <FileText size={16} strokeWidth={1.75} aria-hidden="true" />
            Unit3_Inheritance.pdf
            <span className="flex items-center gap-1 text-done">
              <Check size={14} strokeWidth={2.5} aria-hidden="true" /> Ready
            </span>
          </p>
          <p className="ml-auto max-w-[85%] rounded-[16px] rounded-br-[6px] bg-ink px-4 py-2.5 text-sm text-mist">in unit3 notes, explain method overriding</p>
          <div className="text-sm">
            <p>
              Your notes define overriding as a subclass giving its own body to a method it inherits, with the same name,
              parameters and return type. The example on page 4 overrides <code className="font-mono">area()</code> in{" "}
              <code className="font-mono">Circle extends Shape</code>.
            </p>
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-bg px-3 py-1 text-xs text-muted">
              <FileText size={13} strokeWidth={1.75} aria-hidden="true" /> Unit3_Inheritance.pdf · p. 4
            </p>
          </div>
        </div>
      </section>

      <LiveTonight />

      {/* ---- Privacy ---- */}
      <section id="privacy" aria-labelledby="privacy-h" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
        <h2 id="privacy-h" className="scroll-in text-4xl font-bold sm:text-5xl">
          Your data, plainly
        </h2>
        <ul className="mt-10 grid gap-8 md:grid-cols-3">
          {[
            { icon: Lock, t: "We don't sell your data.", d: "Not to colleges, not to advertisers. Your files are private to your account." },
            { icon: Trash2, t: "Delete anything, any time.", d: "Remove a session or your whole account from Settings. Files go with it." },
            { icon: ShieldCheck, t: "Your files never train AI.", d: "Not ours, not our provider's. They're used only to answer you." },
          ].map(({ icon: Icon, t, d }) => (
            <li key={t} className="scroll-in grid content-start gap-2">
              <Icon size={22} strokeWidth={1.75} className="text-link" aria-hidden="true" />
              <p className="text-lg font-semibold">{t}</p>
              <p className="text-muted">{d}</p>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-sm">
          <Link href="/privacy">Read the privacy notice</Link>
        </p>
      </section>

      {/* ---- Final CTA + teachers ---- */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <div data-theme="dark" className="scroll-in grid gap-10 overflow-hidden rounded-[28px] bg-ink px-6 py-12 text-text sm:px-12 md:grid-cols-[1.2fr_1fr] md:items-end">
          <div>
            <h2 className="text-4xl font-bold sm:text-5xl">Next test coming up?</h2>
            <p className="mt-3 max-w-md text-lg text-muted">Plan it in a minute. Study the hours that matter.</p>
            <div className="mt-8">
              <PrimaryCta demo={demo} label="Try the live demo" />
            </div>
          </div>
          <div className="grid gap-3 border-t border-line pt-8 md:border-t-0 md:border-l md:pt-0 md:pl-10">
            <h3 className="text-xl font-bold">Teaching tonight?</h3>
            <p className="text-sm text-muted">Create a room and pick a time. Students join from VibrantLearn.</p>
            <Link href="/teach/signup" className="btn btn-secondary w-fit">
              Create a teacher account
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
