"use client";

import { Download, Monitor, Moon, RotateCcw, Sun } from "lucide-react";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Main, PageHeader, PageTransition } from "@/components/app/Page";
import { useDemo } from "@/lib/demo/store";
import { FORMAT_LABELS, type Format } from "@/app/onboarding/preview-copy";

type Theme = "system" | "light" | "dark";

function Section({ title, sub, children, i }: { title: string; sub?: string; children: ReactNode; i: number }) {
  return (
    <section className="rise grid gap-5 border-t border-line py-8 md:grid-cols-[15rem_1fr]" style={{ "--i": i } as CSSProperties} aria-labelledby={`s-${i}`}>
      <div>
        <h2 id={`s-${i}`} className="text-xl font-bold">
          {title}
        </h2>
        {sub ? <p className="mt-1 text-sm text-muted">{sub}</p> : null}
      </div>
      <div className="grid gap-5">{children}</div>
    </section>
  );
}

function Meter({ label, used, limit, unit = "" }: { label: string; used: number; limit: number; unit?: string }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setW(used / limit));
    return () => cancelAnimationFrame(id);
  }, [used, limit]);
  const high = used / limit > 0.8;
  return (
    <div>
      <p className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="tabular-nums text-muted">
          {used}
          {unit} of {limit}
          {unit}
        </span>
      </p>
      <span className="mt-2 block h-2 overflow-hidden rounded-full bg-line" role="meter" aria-valuenow={used} aria-valuemin={0} aria-valuemax={limit} aria-label={label}>
        <span className={`block h-full origin-left rounded-full transition-transform duration-700 ease-[var(--ease-out)] ${high ? "bg-amber" : "bg-link"}`} style={{ transform: `scaleX(${w})` }} />
      </span>
    </div>
  );
}

export default function SettingsPage() {
  const { state, updateProfile, reset } = useDemo();
  const p = state.profile;
  const [theme, setTheme] = useState<Theme>("system");
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    try {
      const t = localStorage.getItem("vl-theme");
      if (t === "light" || t === "dark") queueMicrotask(() => setTheme(t));
    } catch {
      /* ignore */
    }
  }, []);

  function applyTheme(t: Theme) {
    setTheme(t);
    if (t === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
    try {
      if (t === "system") localStorage.removeItem("vl-theme");
      else localStorage.setItem("vl-theme", t);
    } catch {
      /* ignore */
    }
  }

  function exportData() {
    const { pending: _p, seen: _s, ...data } = state;
    void _p;
    void _s;
    const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), ...data }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `vibrantlearn-export-${p.username}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <PageTransition>
      <title>Settings | VibrantLearn</title>
      <Main>
        <PageHeader title="Settings" sub="Your profile, how you like to study, and your data." />

        <div className="mt-8">
          <Section i={1} title="Profile" sub="Used to pick your syllabus and exam style.">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <label htmlFor="username" className="text-sm font-medium">
                  Username
                </label>
                <input id="username" className="field opacity-70" value={p.username} readOnly aria-describedby="username-note" />
                <p id="username-note" className="text-xs text-muted">
                  Usernames can&rsquo;t be changed in the prototype.
                </p>
              </div>
              <div className="grid gap-1.5">
                <label htmlFor="university" className="text-sm font-medium">
                  University
                </label>
                <input id="university" className="field" value={p.university} maxLength={120} onChange={(e) => updateProfile({ university: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <label htmlFor="course" className="text-sm font-medium">
                  Course
                </label>
                <select id="course" className="field" value={p.course} onChange={(e) => updateProfile({ course: e.target.value })}>
                  {["BCA", "BCom", "BSc", "PU", "Other"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <label htmlFor="semester" className="text-sm font-medium">
                  Semester
                </label>
                <select id="semester" className="field" value={p.semester} onChange={(e) => updateProfile({ semester: Number(e.target.value) })}>
                  {Array.from({ length: 8 }, (_, k) => k + 1).map((n) => (
                    <option key={n} value={n}>
                      Semester {n}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Section>

          <Section i={2} title="Study preferences" sub="Changes apply to new notes and plans.">
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Explain things in</legend>
              <div className="flex flex-wrap gap-2">
                {([["en", "English"], ["kn", "ಕನ್ನಡ Kannada"], ["hi", "हिन्दी Hindi"]] as const).map(([id, label]) => (
                  <label key={id} className="chip">
                    <input type="radio" name="lang" checked={p.language === id} onChange={() => updateProfile({ language: id })} />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Notes should be</legend>
              <div className="flex flex-wrap gap-2">
                {(["short", "detailed"] as const).map((s) => (
                  <label key={s} className="chip capitalize">
                    <input type="radio" name="style" checked={p.style === s} onChange={() => updateProfile({ style: s })} />
                    {s}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">I like</legend>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(FORMAT_LABELS) as Format[]).map((f) => (
                  <label key={f} className="chip">
                    <input
                      type="checkbox"
                      checked={p.formats.includes(f)}
                      onChange={(e) => updateProfile({ formats: e.target.checked ? [...p.formats, f] : p.formats.filter((x) => x !== f) })}
                    />
                    {FORMAT_LABELS[f]}
                  </label>
                ))}
              </div>
            </fieldset>
          </Section>

          <Section i={3} title="Appearance">
            <div role="radiogroup" aria-label="Theme" className="inline-flex w-fit rounded-full bg-text/[0.05] p-1">
              {([["system", "System", Monitor], ["light", "Light", Sun], ["dark", "Dark", Moon]] as const).map(([id, label, Icon]) => (
                <button key={id} type="button" role="radio" aria-checked={theme === id} onClick={() => applyTheme(id)} className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm transition-colors ${theme === id ? "bg-surface font-semibold shadow-sm" : "text-muted hover:text-text"}`}>
                  <Icon size={15} strokeWidth={1.75} aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
          </Section>

          <Section i={4} title="Usage" sub="Limits keep the free AI quota fair for everyone.">
            <Meter label="Messages in the last 10 minutes" used={state.usage.messages.used} limit={state.usage.messages.limit} />
            <Meter label="Plans this hour" used={state.usage.plans.used} limit={state.usage.plans.limit} />
            <Meter label="Uploads today" used={state.files.length} limit={state.usage.uploads.limit} />
            <Meter label="Upload size today" used={Math.round(state.files.reduce((a, f) => a + f.sizeBytes, 0) / 1024 / 1024)} limit={300} unit=" MB" />
          </Section>

          <Section i={5} title="Your data" sub="Download everything, or start the demo fresh.">
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-secondary" onClick={exportData}>
                <Download size={16} strokeWidth={2} aria-hidden="true" /> Export my data
              </button>
              <button type="button" className="btn btn-secondary" onClick={reset}>
                <RotateCcw size={16} strokeWidth={2} aria-hidden="true" /> Reset demo data
              </button>
            </div>
          </Section>

          <Section i={6} title="Delete account" sub="Removes your profile, sessions, plans and every uploaded file. This can't be undone.">
            <div className="grid max-w-md gap-2 rounded-[var(--radius-card)] border border-rose/40 p-4">
              <label htmlFor="confirm" className="text-sm">
                Type <strong>{p.username}</strong> to confirm
              </label>
              <input id="confirm" className="field" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
              <button type="button" className="btn mt-1 bg-rose text-white" disabled title="Not available in the demo account">
                Delete my account
              </button>
              <p className="text-xs text-muted">Turned off for the demo account.</p>
            </div>
          </Section>
        </div>
      </Main>
    </PageTransition>
  );
}
