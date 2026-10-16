"use client";

import Link from "next/link";
import { useTeach } from "@/components/teach/data";
import { RoomRow } from "@/components/teach/rooms";

const ACTIVE = new Set(["upcoming", "teacher_early", "grace", "open"]);

export default function TeachRooms() {
  const { rooms } = useTeach();
  const upcoming = rooms.filter((r) => ACTIVE.has(r.phase)).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const past = rooms.filter((r) => !ACTIVE.has(r.phase)).sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  return (
    <div className="mx-auto grid max-w-4xl gap-10 px-4 py-8 sm:px-8">
      <title>Rooms | VibrantLearn</title>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Your rooms</h1>
        <Link href="/teach" className="btn btn-primary">New room</Link>
      </div>
      <section aria-labelledby="up-h">
        <h2 id="up-h" className="text-xl font-bold">Coming up</h2>
        {upcoming.length ? (
          <ul className="mt-2 divide-y divide-line">
            {upcoming.map((c) => (
              <RoomRow key={c.id} c={c} />
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-muted">
            Nothing scheduled. <Link href="/teach">Create a room</Link> and pick a time.
          </p>
        )}
      </section>
      {past.length ? (
        <section aria-labelledby="past-h">
          <h2 id="past-h" className="text-xl font-bold">Earlier</h2>
          <ul className="mt-2 divide-y divide-line">
            {past.map((c) => (
              <RoomRow key={c.id} c={c} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
