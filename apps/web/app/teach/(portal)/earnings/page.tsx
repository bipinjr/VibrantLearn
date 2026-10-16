"use client";

import { rupees } from "@/lib/api/classes";
import { useTeach } from "@/components/teach/data";
import { EarningsCard } from "@/components/teach/parts";

const STATUS = { to_be_paid: "ready to withdraw", requested: "withdrawal requested", paid: "paid" } as const;

export default function TeachEarnings() {
  const { earnings, setEarnings } = useTeach();
  if (!earnings) return null;
  return (
    <div className="mx-auto grid max-w-4xl gap-8 px-4 py-8 sm:px-8">
      <title>Earnings | VibrantLearn</title>
      <h1 className="font-display text-3xl font-bold sm:text-4xl">Earnings</h1>
      <EarningsCard earnings={earnings} onChange={setEarnings} />
      <section aria-labelledby="per-h">
        <h2 id="per-h" className="text-xl font-bold">Per class</h2>
        {earnings.classes.length ? (
          <ul className="mt-2 divide-y divide-line">
            {earnings.classes.map((c) => (
              <li key={c.class_id} className="flex flex-wrap justify-between gap-3 py-3">
                <span>
                  <span className="font-medium">{c.topic}</span>
                  <span className="block text-sm text-muted">
                    {new Date(c.starts_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}, {c.students} students, {STATUS[c.status]}
                  </span>
                </span>
                <span className="font-semibold tabular-nums">{rupees(c.net_paise)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-muted">Each class you teach shows up here with what you earned.</p>
        )}
      </section>
    </div>
  );
}
