"use client";

import { BadgeCheck, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { getPublicTeacher, type PublicTeacher } from "@/lib/api/live";

const LANG: Record<string, string> = { en: "English", kn: "Kannada", hi: "Hindi" };

/** T8: exactly what students see about a teacher. The same card is the teacher's own preview. */
export function PublicCard({ teacherId }: { teacherId: string }) {
  const [t, setT] = useState<PublicTeacher | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    getPublicTeacher(teacherId)
      .then(setT)
      .catch((e) => setProblem(e instanceof ApiError ? e.message : "Couldn't load this profile."));
  }, [teacherId]);

  if (problem) return <p role="alert" className="text-sm text-danger">{problem}</p>;
  if (!t) return <div className="skeleton h-48" aria-busy="true" aria-label="Loading profile" />;
  const facts = [
    t.classes_taught ? `${t.classes_taught} ${t.classes_taught === 1 ? "class" : "classes"} taught` : "New on VibrantLearn",
    t.attendance_rate !== null ? `${t.attendance_rate}% of interested students show up` : null,
    t.experience_years ? `${t.experience_years} years teaching` : null,
    t.languages.length ? `Teaches in ${t.languages.map((l) => LANG[l] ?? l).join(", ")}` : null,
  ].filter(Boolean);
  return (
    <article className="msg-in rounded-[var(--radius-sheet)] border border-line bg-surface p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 font-display text-3xl font-bold">
            {t.display_name}
            {t.verified ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-leaf/15 px-2.5 py-0.5 text-sm font-medium text-done">
                <BadgeCheck size={16} strokeWidth={2} aria-hidden="true" /> Verified
              </span>
            ) : null}
          </h2>
          <p className="mt-1 text-muted">{[t.qualification, t.organisation].filter(Boolean).join(", ")}</p>
        </div>
        <p className="text-right">
          {t.rating !== null ? (
            <>
              <span className="flex items-center justify-end gap-1 font-display text-3xl font-bold tabular-nums">
                <Star size={22} strokeWidth={1.75} aria-hidden="true" className="fill-ember text-ember" /> {t.rating}
              </span>
              <span className="text-sm text-muted">{t.ratings} {t.ratings === 1 ? "rating" : "ratings"}</span>
            </>
          ) : (
            <span className="text-sm text-muted">No ratings yet</span>
          )}
        </p>
      </div>
      <ul className="mt-5 flex flex-wrap gap-2">
        {t.subjects.map((s) => (
          <li key={s} className="rounded-full border border-line px-3 py-1 text-sm">{s}</li>
        ))}
      </ul>
      {t.bio ? <p className="mt-5 max-w-prose leading-relaxed">{t.bio}</p> : null}
      <ul className="mt-5 grid gap-1 text-sm text-muted sm:grid-cols-2">
        {facts.map((f) => (
          <li key={f as string}>{f}</li>
        ))}
      </ul>
    </article>
  );
}
