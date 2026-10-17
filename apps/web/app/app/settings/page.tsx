"use client";

import { Download, Monitor, Moon, RotateCcw, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { NewPasswordForm } from "@/app/(auth)/ResetForms";
import { THEME_COOKIE } from "@/lib/theme";
import { Main, PageHeader, PageTransition } from "@/components/app/Page";
import type { Lang } from "@/lib/demo/data";
import { api, ApiError } from "@/lib/api/client";
import { useDemo } from "@/lib/demo/store";
import { useUi } from "@/lib/i18n/context";
import { FORMAT_LABELS, type Format } from "@/app/onboarding/preview-copy";

type Theme = "system" | "light" | "dark";
type Bucket = { used: number; limit: number; resets_at: string | null };
type Limits = { messages: Bucket; plans: Bucket; content: Bucket; uploads: { used: number; limit: number; bytes_used: number; bytes_limit: number } };

/** The same cookie the header toggle uses, so the server renders the chosen theme first. */
function saveThemeCookie(t: Theme) {
  document.cookie =
    t === "system" ? `${THEME_COOKIE}=; path=/; max-age=0` : `${THEME_COOKIE}=${t}; path=/; max-age=31536000; samesite=lax`;
}

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
  const { t } = useUi();
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
          {t("{a} of {b}", { a: `${used}${unit}`, b: `${limit}${unit}` })}
        </span>
      </p>
      <span className="mt-2 block h-2 overflow-hidden rounded-full bg-line" role="meter" aria-valuenow={used} aria-valuemin={0} aria-valuemax={limit} aria-label={label}>
        <span className={`block h-full origin-left rounded-full transition-transform duration-700 ease-[var(--ease-out)] ${high ? "bg-amber" : "bg-link"}`} style={{ transform: `scaleX(${w})` }} />
      </span>
    </div>
  );
}

export default function SettingsPage() {
  const { mode, state, updateProfile, reset } = useDemo();
  const router = useRouter();
  const { t, lang: uiLang, setLang: setUiLang } = useUi();
  const p = state.profile;
  const [theme, setTheme] = useState<Theme>("system");
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    try {
      // One source of truth with the header toggle: the server-applied data-theme (cookie).
      const t = document.documentElement.dataset.theme;
      if (t === "light" || t === "dark") queueMicrotask(() => setTheme(t));
    } catch {
      /* ignore */
    }
  }, []);

  function applyTheme(t: Theme) {
    setTheme(t);
    if (t === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
    saveThemeCookie(t);
    try {
      localStorage.removeItem("vl-theme");
    } catch {
      /* ignore */
    }
  }

  // Signed in: real allowances from the server (F2). Demo: the sample numbers.
  const [limits, setLimits] = useState<Limits | null>(null);
  const [busy, setBusy] = useState<"export" | "delete" | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    if (mode !== "account") return;
    api<{ limits: Limits }>("/me").then((r) => setLimits(r.limits)).catch(() => undefined);
  }, [mode]);

  async function exportData() {
    let data: unknown;
    if (mode === "account") {
      setBusy("export");
      try {
        data = await api<unknown>("/me/export");
      } catch (e) {
        setProblem(e instanceof ApiError ? e.message : "Couldn't export just now. Try again.");
        return;
      } finally {
        setBusy(null);
      }
    } else {
      const { pending: _p, seen: _s, ...rest } = state;
      void _p;
      void _s;
      data = { exported_at: new Date().toISOString(), ...rest };
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `vibrantlearn-export-${p.username}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function deleteAccount() {
    setBusy("delete");
    setProblem(null);
    try {
      await api("/me", { method: "DELETE", body: JSON.stringify({ confirm }) });
      // The login is gone; clear the cookies and leave.
      await fetch("/auth/signout", { method: "POST" }).catch(() => undefined);
      router.replace("/");
      router.refresh();
    } catch (e) {
      setProblem(e instanceof ApiError ? e.message : "Couldn't delete your account just now. Try again.");
      setBusy(null);
    }
  }

  return (
    <PageTransition>
      <title>{`${t("Settings")} | VibrantLearn`}</title>
      <Main>
        <PageHeader title={t("Settings")} sub={t("Your profile, how you like to study, and your data.")} />

        <div className="mt-8">
          <Section i={1} title={t("Profile")} sub={t("Used to pick your syllabus and exam style.")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <label htmlFor="username" className="text-sm font-medium">
                  {t("Username")}
                </label>
                <input id="username" className="field opacity-70" value={p.username} readOnly aria-describedby="username-note" />
                <p id="username-note" className="text-xs text-muted">
                  {t("Usernames can’t be changed in the prototype.")}
                </p>
              </div>
              <div className="grid gap-1.5">
                <label htmlFor="university" className="text-sm font-medium">
                  {t("University")}
                </label>
                <input id="university" className="field" value={p.university} maxLength={120} onChange={(e) => updateProfile({ university: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <label htmlFor="course" className="text-sm font-medium">
                  {t("Course")}
                </label>
                <select id="course" className="field" value={p.course} onChange={(e) => updateProfile({ course: e.target.value })}>
                  {["BCA", "BCom", "BSc", "PU", "Other"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <label htmlFor="semester" className="text-sm font-medium">
                  {t("Semester")}
                </label>
                <select id="semester" className="field" value={p.semester} onChange={(e) => updateProfile({ semester: Number(e.target.value) })}>
                  {Array.from({ length: 8 }, (_, k) => k + 1).map((n) => (
                    <option key={n} value={n}>
                      {t("Semester {n}", { n })}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Section>

          <Section i={2} title={t("Study preferences")} sub={t("Changes apply to new notes and plans.")}>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">{t("Explain things in")}</legend>
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
              <legend className="mb-2 text-sm font-medium">{t("Notes should be")}</legend>
              <div className="flex flex-wrap gap-2">
                {(["short", "detailed"] as const).map((s) => (
                  <label key={s} className="chip">
                    <input type="radio" name="style" checked={p.style === s} onChange={() => updateProfile({ style: s })} />
                    {t(s === "short" ? "Short" : "Detailed")}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">{t("I like")}</legend>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(FORMAT_LABELS) as Format[]).map((f) => (
                  <label key={f} className="chip">
                    <input
                      type="checkbox"
                      checked={p.formats.includes(f)}
                      onChange={(e) => updateProfile({ formats: e.target.checked ? [...p.formats, f] : p.formats.filter((x) => x !== f) })}
                    />
                    {t(FORMAT_LABELS[f])}
                  </label>
                ))}
              </div>
            </fieldset>
          </Section>

          <Section i={3} title={t("Appearance")} sub={t("Menus, buttons and labels. Notes use the language under Study preferences.")}>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">{t("App language")}</legend>
              <div className="flex flex-wrap gap-2">
                {([["en", "English"], ["kn", "ಕನ್ನಡ"], ["hi", "हिन्दी"]] as [Lang, string][]).map(([id, label]) => (
                  <label key={id} className="chip" lang={id}>
                    <input type="radio" name="ui-lang" checked={uiLang === id} onChange={() => setUiLang(id)} />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div role="radiogroup" aria-label={t("Theme")} className="inline-flex w-fit rounded-full bg-text/[0.05] p-1">
              {([["system", t("System"), Monitor], ["light", t("Light"), Sun], ["dark", t("Dark"), Moon]] as const).map(([id, label, Icon]) => (
                <button key={id} type="button" role="radio" aria-checked={theme === id} onClick={() => applyTheme(id)} className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm transition-colors ${theme === id ? "bg-surface font-semibold shadow-sm" : "text-muted hover:text-text"}`}>
                  <Icon size={15} strokeWidth={1.75} aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
          </Section>

          <Section i={4} title={t("Usage")} sub={t("Limits keep the free AI quota fair for everyone.")}>
            <Meter label={t("Messages in the last 10 minutes")} used={limits?.messages.used ?? state.usage.messages.used} limit={limits?.messages.limit ?? state.usage.messages.limit} />
            <Meter label={t("Plans this hour")} used={limits?.plans.used ?? state.usage.plans.used} limit={limits?.plans.limit ?? state.usage.plans.limit} />
            {limits ? <Meter label={t("AI answers this hour")} used={limits.content.used} limit={limits.content.limit} /> : null}
            <Meter label={t("Uploads today")} used={limits?.uploads.used ?? state.files.length} limit={limits?.uploads.limit ?? state.usage.uploads.limit} />
            <Meter
              label={t("Upload size today")}
              used={Math.round((limits?.uploads.bytes_used ?? state.files.reduce((a, f) => a + f.sizeBytes, 0)) / 1024 / 1024)}
              limit={300}
              unit=" MB"
            />
          </Section>

          <Section i={5} title={t("Your data")} sub={t(mode === "demo" ? "Download everything, or start the demo fresh." : "Download everything you've saved.")}>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-secondary" onClick={exportData} disabled={busy !== null}>
                <Download size={16} strokeWidth={2} aria-hidden="true" /> {busy === "export" ? t("Preparing…") : t("Export my data")}
              </button>
              {mode === "demo" ? (
                <button type="button" className="btn btn-secondary" onClick={reset}>
                  <RotateCcw size={16} strokeWidth={2} aria-hidden="true" /> {t("Reset demo data")}
                </button>
              ) : null}
            </div>
            {problem ? (
              <p role="alert" className="rounded-[var(--radius-input)] bg-rose/10 px-3 py-2 text-sm">
                {problem}
              </p>
            ) : null}
          </Section>

          {mode === "account" ? (
            <Section i={7} title={t("Password")} sub={t("Change it here while you're signed in. No email needed.")}>
              <NewPasswordForm embedded next="/app/settings" />
            </Section>
          ) : null}
          <Section i={6} title={t("Delete account")} sub={t("Removes your profile, sessions, plans and every uploaded file. This can't be undone.")}>
            <div className="grid max-w-md gap-2 rounded-[var(--radius-card)] border border-rose/40 p-4">
              <label htmlFor="confirm" className="text-sm">
                {t("Type {name} to confirm", { name: p.username })}
              </label>
              <input id="confirm" className="field" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
              <button
                type="button"
                className="btn mt-1 bg-rose text-white"
                disabled={mode === "demo" || busy !== null || confirm.trim().toLowerCase() !== p.username.toLowerCase()}
                title={mode === "demo" ? t("Not available in the demo account") : undefined}
                onClick={deleteAccount}
              >
                {busy === "delete" ? t("Deleting…") : t("Delete my account")}
              </button>
              {mode === "demo" ? <p className="text-xs text-muted">{t("Turned off for the demo account.")}</p> : null}
            </div>
          </Section>
        </div>
      </Main>
    </PageTransition>
  );
}
