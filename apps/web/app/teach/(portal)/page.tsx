"use client";

import Link from "next/link";
import { useState } from "react";
import { rupees } from "@/lib/api/classes";
import { useTeach } from "@/components/teach/data";
import { NewRoom, NextRoom, RoomReady, RoomRow } from "@/components/teach/rooms";

const ACTIVE = new Set(["upcoming", "teacher_early", "grace", "open"]);

/** Home: the next room first, a new room one tap away, then the rest and the money. */
export default function TeachHome() {
  const { teacher, rooms, earnings, reload } = useTeach();
  const [created, setCreated] = useState<string | null>(null);
  if (!teacher) return null;
  const upcoming = rooms.filter((r) => ACTIVE.has(r.phase)).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const next = upcoming[0];
  const justMade = created ? rooms.find((r) => r.topic === created && ACTIVE.has(r.phase)) : undefined;

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-8">
      <title>Teacher home | VibrantLearn</title>
      <h1 className="font-display text-3xl font-bold sm:text-4xl">Good to see you, {teacher.display_name.split(" ")[0]}.</h1>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {next ? (
          <NextRoom room={next} />
        ) : (
          <section data-theme="dark" className="flex flex-col justify-center gap-3 rounded-[var(--radius-sheet)] bg-ink p-6 text-text sm:p-8">
            <h2 className="font-display text-3xl font-bold">No rooms yet</h2>
            <p className="text-muted">Create one and it shows up in Live classes for every student studying that subject.</p>
          </section>
        )}
        {created ? (
          <RoomReady room={justMade} onAnother={() => setCreated(null)} />
        ) : (
          <NewRoom
            subjects={teacher.subjects}
            onCreated={(topic) => {
              setCreated(topic);
              reload();
            }}
          />
        )}
      </div>

      {upcoming.length > 1 ? (
        <section aria-labelledby="up-h">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="up-h" className="text-2xl font-bold">Coming up</h2>
            <Link href="/teach/rooms" className="text-sm">All rooms</Link>
          </div>
          <ul className="mt-2 divide-y divide-line">
            {upcoming.slice(1, 4).map((c) => (
              <RoomRow key={c.id} c={c} />
            ))}
          </ul>
        </section>
      ) : null}

      {earnings ? (
        <Link href="/teach/earnings" className="flex flex-wrap items-baseline justify-between gap-3 rounded-[var(--radius-card)] border border-line px-5 py-4 text-text no-underline hover:bg-text/[0.03]">
          <span>
            <span className="font-semibold">{rupees(earnings.to_be_paid_paise)}</span> <span className="text-muted">ready to withdraw</span>
          </span>
          <span className="text-sm text-muted">{rupees(earnings.paid_paise)} paid so far. See earnings</span>
        </Link>
      ) : null}
    </div>
  );
}
