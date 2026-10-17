"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { DemandBoard, EarningsStrip } from "@/components/teach/home";
import { useTeach } from "@/components/teach/data";
import { NewRoom, NextRoom, RoomReady, RoomRow, type Prefill } from "@/components/teach/rooms";

const ACTIVE = new Set(["upcoming", "teacher_early", "grace", "open"]);

/** T2 Home: money first, then demand; the next room and a new room one tap away. */
export default function TeachHome() {
  const { teacher, rooms, reload } = useTeach();
  const [created, setCreated] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<Prefill>(null);
  const formRef = useRef<HTMLDivElement>(null);
  if (!teacher) return null;
  const upcoming = rooms.filter((r) => ACTIVE.has(r.phase)).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const next = upcoming[0];
  const justMade = created ? rooms.find((r) => r.topic === created && ACTIVE.has(r.phase)) : undefined;

  function pick(p: Prefill) {
    setCreated(null);
    setPrefill(p);
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-8">
      <title>Teacher home | VibrantLearn</title>
      <h1 className="font-display text-3xl font-bold sm:text-4xl">Good to see you, {teacher.display_name.split(" ")[0]}.</h1>
      <EarningsStrip />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="grid content-start gap-6">
          {next ? <NextRoom room={next} /> : null}
          <DemandBoard onPick={pick} />
        </div>
        <div ref={formRef} className="scroll-mt-6">
          {created ? (
            <RoomReady room={justMade} onAnother={() => setCreated(null)} />
          ) : (
            <NewRoom
              key={prefill ? `${prefill.subject}|${prefill.topic}` : "blank"}
              subjects={teacher.subjects}
              prefill={prefill}
              onCreated={(topic) => {
                setCreated(topic);
                setPrefill(null);
                reload();
              }}
            />
          )}
        </div>
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
    </div>
  );
}
