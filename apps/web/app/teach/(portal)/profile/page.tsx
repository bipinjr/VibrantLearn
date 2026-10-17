"use client";

import { useState } from "react";
import { useTeach } from "@/components/teach/data";
import { Application, ProfileCard, Questionnaire } from "@/components/teach/parts";
import { PublicCard } from "@/components/teach/PublicCard";

export default function TeachProfile() {
  const { teacher, stats, payout, reload } = useTeach();
  const [editing, setEditing] = useState(false);
  if (!teacher || !stats) return null;
  return (
    <div className="mx-auto grid max-w-4xl gap-8 px-4 py-8 sm:px-8">
      <title>Profile | VibrantLearn</title>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Profile</h1>
        {!editing ? (
          <button type="button" className="btn btn-secondary" onClick={() => setEditing(true)}>
            Edit profile
          </button>
        ) : null}
      </div>
      <ProfileCard teacher={teacher} stats={stats} />
      <section aria-labelledby="public-h" className="grid gap-3">
        <h2 id="public-h" className="text-xl font-bold">What students see</h2>
        <p className="-mt-2 text-sm text-muted">This is your public profile, exactly as students see it from a class.</p>
        <PublicCard teacherId={teacher.user_id} />
      </section>
      {editing ? (
        <Questionnaire
          teacher={teacher}
          onDone={() => {
            setEditing(false);
            reload();
          }}
        />
      ) : null}
      <section aria-labelledby="docpay-h">
        <h2 id="docpay-h" className="mb-3 text-xl font-bold">Document and payouts</h2>
        <Application teacher={teacher} payout={payout} onDone={reload} />
      </section>
    </div>
  );
}
