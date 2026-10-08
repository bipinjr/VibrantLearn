"use client";

import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { Composer } from "@/components/app/Composer";
import { PageTransition } from "@/components/app/Page";
import { useDemo } from "@/lib/demo/store";

const IDEAS = [
  "Java internal tomorrow 10am, BCA SEP",
  "nale DBMS test ide, normalization weak",
  "kal OS ka exam hai, 3 hours",
  "Python lab exam on Friday",
  "Data structures sem exam in 5 weeks",
  "Explain deadlocks in Kannada",
];

export default function NewSessionPage() {
  const router = useRouter();
  const { startSession } = useDemo();
  const go = (text: string) => {
    const id = startSession(text);
    router.push(`/app/s/${id}`, { transitionTypes: ["nav-forward"] });
  };

  return (
    <PageTransition>
      <title>New study session | VibrantLearn</title>
      <main id="main" className="mx-auto grid min-h-[calc(100dvh-4rem)] w-full max-w-2xl content-center gap-8 px-4 py-10 sm:px-8">
        <div className="rise text-center">
          <h1 id="page-title" tabIndex={-1} className="text-4xl font-extrabold outline-none sm:text-5xl">
            What&rsquo;s your next test?
          </h1>
          <p className="mt-3 text-lg text-muted">Subject and when it is. Kanglish and Hinglish are fine.</p>
        </div>
        <div className="rise" style={{ "--i": 2 } as CSSProperties}>
          <Composer files={[]} sessionTitle="a new session" busy={false} onSend={go} onFiles={() => undefined} autoFocus placeholder="For example: Java internal tomorrow 10am" />
        </div>
        <ul className="flex flex-wrap justify-center gap-2" aria-label="Ideas">
          {IDEAS.map((t, i) => (
            <li key={t} className="rise" style={{ "--i": i + 3 } as CSSProperties}>
              <button type="button" className="chip text-sm" onClick={() => go(t)}>
                {t}
              </button>
            </li>
          ))}
        </ul>
      </main>
    </PageTransition>
  );
}
