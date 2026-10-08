"use client";

import { AlertCircle, CheckCircle2, FileText, Loader2, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Composer } from "@/components/app/Composer";
import { PageTransition } from "@/components/app/Page";
import { BlockView, ServedBadge } from "@/components/learn/Blocks";
import { ProgressRing } from "@/components/learn/ProgressRing";
import type { StudyFile } from "@/lib/demo/data";
import { useDemo } from "@/lib/demo/store";
import { clock, dayInline, fileSize, timeLeft } from "@/lib/format";

export function FileStatus({ f }: { f: StudyFile }) {
  const map = {
    uploading: { text: `Uploading ${f.progress ?? 0}%`, icon: <Loader2 size={13} className="animate-spin motion-reduce:animate-none" />, cls: "text-muted" },
    scanning: { text: "Checking", icon: <Loader2 size={13} className="animate-spin motion-reduce:animate-none" />, cls: "text-muted" },
    processing: { text: "Processing", icon: <Loader2 size={13} className="animate-spin motion-reduce:animate-none" />, cls: "text-muted" },
    ready: { text: "Ready", icon: <CheckCircle2 size={13} className="pop-in" />, cls: "text-done" },
    failed: { text: "Failed", icon: <AlertCircle size={13} />, cls: "text-danger" },
  } as const;
  const s = map[f.status];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${s.cls}`} aria-hidden="true">
      {s.icon}
      {s.text}
    </span>
  );
}

export function SessionView({ id }: { id: string }) {
  const router = useRouter();
  const { state, now, thinking, fresh, send, addFiles, deleteSession } = useDemo();
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const session = state.sessions.find((s) => s.id === id);
  const messages = state.messages[id] ?? [];
  const files = state.files.filter((f) => f.sessionId === id);
  const plan = state.plans.find((p) => p.sessionId === id);
  const busy = thinking?.sessionId === id;
  const nowIso = now.toISOString();

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    end.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "end" });
  }, [messages.length, busy]);

  useEffect(() => {
    document.getElementById("page-title")?.focus({ preventScroll: true });
  }, [id]);

  if (!session) {
    return (
      <main id="main" className="mx-auto grid min-h-[70dvh] max-w-md place-content-center gap-4 px-4 text-center">
        <h1 id="page-title" tabIndex={-1} className="text-3xl font-bold outline-none">
          This session isn&rsquo;t here
        </h1>
        <p className="text-muted">It may have been deleted. Start a new one with your next test.</p>
        <Link href="/app/new" className="btn btn-primary mx-auto">
          New study session
        </Link>
      </main>
    );
  }

  const onFiles = (list: File[]) => setUploadErrors(addFiles(id, list));

  return (
    <PageTransition>
      <title>{`${session.title} | VibrantLearn`}</title>
      <div className="grid min-h-dvh grid-cols-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_20rem]">
        <main id="main" className="flex min-w-0 flex-col">
          <header className="sticky top-[57px] z-20 border-b border-line bg-bg/85 px-4 py-3 backdrop-blur-md sm:px-8 lg:top-0">
            <div className="mx-auto flex max-w-3xl items-center gap-3">
              <div className="min-w-0 flex-1">
                <h1 id="page-title" tabIndex={-1} className="truncate text-xl font-bold outline-none sm:text-2xl">
                  {session.title}
                </h1>
                <p className="truncate text-sm text-muted">
                  {session.subject || "Tell me the subject and the exam date to get a plan"}
                  {session.deadline ? `. Exam ${dayInline(session.deadline, nowIso)}, ${clock(session.deadline)}` : ""}
                </p>
              </div>
              {session.deadline ? (
                <span className="hidden shrink-0 rounded-full bg-ember/15 px-3 py-1 text-sm font-semibold tabular-nums sm:inline">
                  {timeLeft(session.deadline, nowIso)} left
                </span>
              ) : null}
              {confirming ? (
                <span className="pop-in flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    className="btn min-h-9 bg-rose px-3 text-sm text-white"
                    onClick={() => {
                      deleteSession(id);
                      router.push("/app", { transitionTypes: ["nav-back"] });
                    }}
                  >
                    Delete session
                  </button>
                  <button type="button" className="btn min-h-9 px-3 text-sm" onClick={() => setConfirming(false)}>
                    Keep
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="grid size-9 shrink-0 place-items-center rounded-[10px] text-muted transition-colors hover:bg-rose/10 hover:text-danger"
                  aria-label="Delete session"
                  onClick={() => setConfirming(true)}
                >
                  <Trash2 size={17} strokeWidth={1.75} />
                </button>
              )}
            </div>
          </header>

          <div className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-40 sm:px-8" aria-live="polite" aria-busy={busy}>
            {messages.length === 0 && !busy ? (
              <div className="grid place-items-center py-24 text-center">
                <p className="font-display text-3xl font-bold">What&rsquo;s your next test?</p>
                <p className="mt-2 text-muted">Subject and when it is. That&rsquo;s all I need.</p>
              </div>
            ) : null}

            <ol className="grid grid-cols-[minmax(0,1fr)] gap-8">
              {messages.map((m) => {
                const animate = fresh.has(m.id);
                if (m.role === "user") {
                  return (
                    <li key={m.id} className={`flex justify-end ${animate ? "rise" : ""}`}>
                      <p className="max-w-[80%] rounded-[16px] rounded-br-[6px] bg-ink px-4 py-2.5 text-[0.95rem] text-mist">{m.content}</p>
                    </li>
                  );
                }
                return (
                  <li key={m.id} className={`grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 ${animate ? "rise" : ""}`}>
                    <div className="flex items-center gap-2">
                      <Image src="/brand/app-icon.svg" alt="" width={22} height={22} className="rounded-[6px]" />
                      <ServedBadge from={m.servedFrom} />
                    </div>
                    {m.blocks?.map((b, i) => (
                      <div key={i} className={animate ? "rise" : undefined} style={{ "--i": i + 1 } as CSSProperties}>
                        <BlockView block={b} animate={animate} onSend={(t) => send(id, t)} />
                      </div>
                    ))}
                  </li>
                );
              })}
            </ol>

            {busy ? (
              <div className="rise mt-8 flex items-center gap-3 text-sm text-muted" role="status">
                <span className="dots text-ember" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
                {thinking?.label}…
              </div>
            ) : null}
            <div ref={end} />
          </div>

          <div className="sticky bottom-20 z-10 mx-auto w-full max-w-3xl px-4 pb-4 sm:px-8 lg:bottom-0 lg:pb-6">
            {uploadErrors.length ? (
              <ul role="alert" className="pop-in mb-2 grid gap-1 rounded-[var(--radius-input)] bg-rose/10 px-3 py-2 text-sm">
                {uploadErrors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            ) : null}
            <Composer files={files} sessionTitle={session.title} busy={busy} onSend={(t) => send(id, t)} onFiles={onFiles} autoFocus={messages.length === 0} />
          </div>
        </main>

        <aside className="hidden border-l border-line bg-surface xl:block" aria-label="Session files and plan">
          <div className="sticky top-0 grid max-h-dvh gap-8 overflow-y-auto p-5">
            {plan ? (
              <section>
                <h2 className="font-sans text-sm font-semibold tracking-normal">Plan</h2>
                <Link href={`/app/plans/${plan.id}`} transitionTypes={["nav-forward"]} className="lift mt-3 flex items-center gap-3 rounded-[var(--radius-card)] border border-line p-3 text-text no-underline">
                  <ProgressRing value={plan.steps.filter((s) => s.done).length / Math.max(1, plan.steps.length - 1)} size={44} stroke={5} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{plan.subject}</span>
                    <span className="block text-xs text-muted">
                      {plan.mode[0].toUpperCase() + plan.mode.slice(1)} plan, {plan.steps.filter((s) => !s.done && s.kind !== "exam").length} steps left
                    </span>
                  </span>
                </Link>
              </section>
            ) : null}
            <section>
              <h2 className="font-sans text-sm font-semibold tracking-normal">Files in this session</h2>
              {files.length === 0 ? (
                <p className="mt-3 rounded-[var(--radius-card)] border border-dashed border-line p-4 text-sm text-muted">
                  Drop PDFs, slides or photos of your notes on the message box. Then ask about them with @.
                </p>
              ) : (
                <ul className="mt-3 grid gap-2">
                  {files.map((f, i) => (
                    <li key={f.id} className="rise rounded-[12px] border border-line p-3" style={{ "--i": i } as CSSProperties}>
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <FileText size={15} strokeWidth={1.75} className="shrink-0 text-muted" aria-hidden="true" />
                        <span className="truncate">{f.name}</span>
                      </p>
                      <p className="mt-1.5 flex items-center justify-between text-xs text-muted">
                        <span>
                          {fileSize(f.sizeBytes)}
                          {f.pages ? `, ${f.pages} pages` : ""}
                        </span>
                        <FileStatus f={f} />
                      </p>
                      {f.status === "uploading" ? (
                        <span className="mt-2 block h-1 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={f.progress ?? 0} aria-valuemin={0} aria-valuemax={100} aria-label={`Uploading ${f.name}`}>
                          <span className="block h-full origin-left rounded-full bg-link transition-transform duration-200" style={{ transform: `scaleX(${(f.progress ?? 0) / 100})` }} />
                        </span>
                      ) : null}
                      {f.error ? <p className="mt-1.5 text-xs text-danger">{f.error}</p> : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </aside>
      </div>
    </PageTransition>
  );
}
