"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { jitsiSrc, joinClass, type Room } from "@/lib/api/classes";
import { useDemo } from "@/lib/demo/store";
import { clock } from "@/lib/format";
import { useUi } from "@/lib/i18n/context";

/** The live room. The server decides whether this student gets a seat and only then reveals the room. */
export default function ClassRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { mode } = useDemo();
  const { t } = useUi();
  const [room, setRoom] = useState<Room | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "account") return;
    joinClass(id)
      .then(setRoom)
      .catch((e) => setProblem(e instanceof ApiError ? e.message : t("Couldn't open the class. Check your connection, then try again.")));
  }, [id, mode, t]);

  return (
    <main id="main" className="flex min-h-[calc(100dvh-4rem)] flex-col gap-3 p-3 sm:p-5 lg:min-h-dvh">
      <title>{`${t("Live class")} | VibrantLearn`}</title>
      <div className="flex items-center justify-between gap-3">
        <Link href="/app/classes" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted no-underline hover:text-text">
          <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" /> {t("Live classes")}
        </Link>
        {room ? (
          <p className="text-sm text-muted">
            {room.role === "teacher" ? t("You're teaching.") : t("You have a seat.")} {t("Ends at {time}.", { time: clock(room.ends_at) })}
          </p>
        ) : null}
      </div>
      {mode !== "account" ? (
        <p className="m-auto max-w-md text-center text-muted">{t("Live classes need a real account.")}</p>
      ) : problem ? (
        <div role="alert" className="m-auto max-w-md text-center">
          <h1 className="text-2xl font-bold">{t("You can't join right now")}</h1>
          <p className="mt-2 text-muted">{problem}</p>
          <Link href="/app/classes" className="btn btn-secondary mt-5">{t("Back to live classes")}</Link>
        </div>
      ) : !room ? (
        <p role="status" className="m-auto text-muted">{t("Finding your seat…")}</p>
      ) : (
        <iframe
          title={t("Live class video")}
          src={jitsiSrc(room)}
          allow="camera; microphone; display-capture; fullscreen; autoplay"
          className="min-h-[70dvh] w-full flex-1 rounded-[var(--radius-card)] border border-line bg-ink"
        />
      )}
    </main>
  );
}
