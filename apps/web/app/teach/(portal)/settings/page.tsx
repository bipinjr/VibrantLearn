"use client";

import Link from "next/link";
import { useState } from "react";
import { saveNotify } from "@/lib/api/live";
import { useTeach } from "@/components/teach/data";
import { Application, Questionnaire } from "@/components/teach/parts";

/** T10: payout details, notifications, subjects and availability, account health, sign out. */
export default function TeachSettings() {
  const { teacher, payout, reload } = useTeach();
  const notify = teacher?.notify;
  const [prefs, setPrefs] = useState({ class_reminders: notify?.class_reminders ?? true, demand_alerts: notify?.demand_alerts ?? true });
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);
  if (!teacher) return null;

  async function toggle(k: keyof typeof prefs) {
    const next = { ...prefs, [k]: !prefs[k] };
    setPrefs(next); // instant; rolled back if the save fails
    setSaved(false);
    try {
      await saveNotify(next);
      setSaved(true);
    } catch {
      setPrefs(prefs);
    }
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-10 px-4 py-8 sm:px-8">
      <title>Settings | VibrantLearn</title>
      <h1 className="font-display text-3xl font-bold sm:text-4xl">Settings</h1>

      <section aria-labelledby="pay-h3">
        <h2 id="pay-h3" className="mb-3 text-xl font-bold">Payout details and documents</h2>
        <Application payout={payout} onDone={reload} />
      </section>

      <section aria-labelledby="n-h">
        <h2 id="n-h" className="text-xl font-bold">Notifications</h2>
        <ul className="mt-3 divide-y divide-line rounded-[var(--radius-card)] border border-line">
          {(
            [
              ["class_reminders", "Class reminders", "An email 30 minutes before each room you teach."],
              ["demand_alerts", "Demand alerts", "When 10 or more students have an exam in one of your subjects."],
            ] as const
          ).map(([k, label, hint]) => (
            <li key={k} className="flex items-center justify-between gap-4 px-5 py-4">
              <span>
                <span className="block font-medium" id={`${k}-l`}>{label}</span>
                <span className="text-sm text-muted">{hint}</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={prefs[k]}
                aria-labelledby={`${k}-l`}
                onClick={() => toggle(k)}
                className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ${prefs[k] ? "bg-violet" : "bg-text/20"}`}
              >
                <span className={`absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform duration-200 ${prefs[k] ? "translate-x-5" : ""}`} />
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm text-muted" aria-live="polite">{saved ? "Saved." : "Emails start when notifications are switched on for the whole platform."}</p>
      </section>

      <section aria-labelledby="s-h">
        <div className="flex items-center justify-between gap-3">
          <h2 id="s-h" className="text-xl font-bold">Subjects and availability</h2>
          {!editing ? <button type="button" className="btn btn-secondary" onClick={() => setEditing(true)}>Edit</button> : null}
        </div>
        {editing ? (
          <Questionnaire
            teacher={teacher}
            onDone={() => {
              setEditing(false);
              reload();
            }}
          />
        ) : (
          <p className="mt-2 text-muted">{teacher.subjects.join(", ")}.</p>
        )}
      </section>

      <section aria-labelledby="a-h" className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-8">
        <div>
          <h2 id="a-h" className="text-xl font-bold">Account</h2>
          <p className="text-sm text-muted">
            Warnings, appeals and the outcome of your reports are in <Link href="/teach/health">Account health</Link>.
          </p>
        </div>
        <form action="/auth/signout" method="post">
          <button type="submit" className="btn btn-secondary">Sign out</button>
        </form>
      </section>
    </div>
  );
}
