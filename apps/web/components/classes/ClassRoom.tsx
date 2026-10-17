"use client";

import { ArrowLeft, ShieldCheck, Video } from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type SubmitEvent,
} from "react";
import { ApiError } from "@/lib/api/client";
import { getPeople, markAnswered, reportInClass, type Person } from "@/lib/api/live";
import {
  jitsiSrc,
  joinClass,
  readChat,
  sendChat,
  type ChatMessage,
  type ChatState,
  type Room,
} from "@/lib/api/classes";
import { clock } from "@/lib/format";
import { useUi } from "@/lib/i18n/context";

const POLL_MS = 3000;

const REASONS = ["Abuse or insults", "Spam", "Sharing contact details", "Off-topic"] as const;

/** Report a message: one tap opens three reasons, one more sends it. The reporter sees the outcome later. */
function ReportButton({ classId, messageId }: { classId: string; messageId: number }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  if (sent) return <span className="text-xs text-muted">Reported. The team will review it.</span>;
  if (!open)
    return (
      <button type="button" className="text-xs text-muted underline-offset-2 hover:text-text hover:underline" onClick={() => setOpen(true)}>
        Report<span className="sr-only"> this message</span>
      </button>
    );
  return (
    <span className="flex flex-wrap items-center gap-1.5 text-xs">
      {REASONS.map((r) => (
        <button
          key={r}
          type="button"
          className="rounded-full border border-line px-2 py-0.5 hover:bg-text/5"
          onClick={() => {
            void reportInClass(classId, { reason: r, message_id: messageId }).then(() => setSent(true));
          }}
        >
          {r}
        </button>
      ))}
      <button type="button" className="text-muted hover:text-text" onClick={() => setOpen(false)}>
        Cancel
      </button>
    </span>
  );
}

function Line({ m, classId }: { m: ChatMessage; classId: string }) {
  const { t } = useUi();
  if (m.bot) {
    return (
      <li className="msg-in mx-3 flex gap-2 rounded-[var(--radius-input)] bg-violet/10 px-3 py-2 text-sm">
        <ShieldCheck size={16} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0 text-violet" />
        <span>
          <span className="font-semibold">{m.author}</span> {m.body}
        </span>
      </li>
    );
  }
  const pending = m.id < 0;
  return (
    <li className={`msg-in group mx-3 rounded-[var(--radius-input)] px-3 py-1.5 text-sm ${m.hidden ? "text-muted" : ""} ${pending ? "opacity-60" : ""}`}>
      <span className="font-semibold">{m.mine ? t("You") : m.author}</span>{" "}
      <span className="text-xs text-muted tabular-nums">{pending ? "Checking…" : clock(m.at)}</span>
      {m.question ? (
        <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${m.answered ? "bg-leaf/15 text-done" : "bg-amber/20"}`}>
          {m.answered ? "Answered" : "Question"}
        </span>
      ) : null}
      <p className={m.hidden ? "line-through decoration-muted" : ""}>{m.body}</p>
      {m.hidden ? <p className="text-xs text-danger">{m.hidden}</p> : null}
      {!m.mine && !m.hidden && !pending ? (
        <div className="h-5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
          <ReportButton classId={classId} messageId={m.id} />
        </div>
      ) : null}
    </li>
  );
}

function Chat({ classId, role, onRemoved }: { classId: string; role: "teacher" | "student"; onRemoved: () => void }) {
  const { t } = useUi();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [state, setState] = useState<ChatState | null>(null);
  const [draft, setDraft] = useState("");
  const [asQuestion, setAsQuestion] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const last = useRef(0);
  const temp = useRef(-1);
  const end = useRef<HTMLLIElement>(null);

  const merge = useCallback((more: ChatMessage[]) => {
    if (!more.length) return;
    setMessages((m) => {
      const byId = new Map(m.map((x) => [x.id, x]));
      for (const x of more) byId.set(x.id, x);
      return [...byId.values()].sort((a, b) => (a.id < 0 ? 1 : b.id < 0 ? -1 : a.id - b.id));
    });
    last.current = Math.max(last.current, ...more.filter((x) => x.id > 0).map((x) => x.id));
  }, []);

  const poll = useCallback(() => {
    readChat(classId, last.current)
      .then((r) => {
        merge(r.messages);
        setState(r);
        if (r.removed) onRemoved();
      })
      .catch(() => undefined); // a missed poll is retried in 3 s
  }, [classId, merge, onRemoved]);

  useEffect(() => {
    poll();
    const id = window.setInterval(poll, POLL_MS);
    return () => window.clearInterval(id);
  }, [poll]);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages.length]);

  async function send(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setProblem(null);
    // Show it at once, marked "Checking…", while the bot looks at it.
    const tempId = temp.current--;
    const question = asQuestion && role === "student";
    merge([{ id: tempId, author: "You", body, at: new Date().toISOString(), bot: false, mine: true, hidden: null, question }]);
    setDraft("");
    setAsQuestion(false);
    try {
      const r = await sendChat(classId, body, question);
      setMessages((m) => m.filter((x) => x.id !== tempId));
      merge([r.message]);
      setState(r);
      if (r.removed) onRemoved();
      poll(); // pick up the bot's notice straight away
    } catch (err) {
      setMessages((m) => m.filter((x) => x.id !== tempId));
      setDraft(body);
      setProblem(err instanceof ApiError ? err.message : t("Couldn't send. Check your connection."));
    }
  }

  async function answer(id: number) {
    setMessages((m) => m.map((x) => (x.id === id ? { ...x, answered: true } : x)));
    try {
      await markAnswered(classId, id);
    } catch {
      setMessages((m) => m.map((x) => (x.id === id ? { ...x, answered: false } : x)));
    }
  }

  const openQuestions = messages.filter((m) => m.question && !m.answered && !m.hidden && m.id > 0);

  return (
    <section aria-labelledby="chat-h" className="flex min-h-[60dvh] flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface lg:min-h-0">
      <h2 id="chat-h" className="border-b border-line px-4 py-3 font-semibold">
        {t("Class chat")}
      </h2>
      {role === "teacher" ? (
        <div className="border-b border-line px-4 py-3">
          <p className="text-sm font-semibold">
            Questions {openQuestions.length ? <span className="text-now">({openQuestions.length} open)</span> : <span className="font-normal text-muted">(none open)</span>}
          </p>
          {openQuestions.length ? (
            <ul className="mt-2 grid max-h-40 gap-2 overflow-y-auto">
              {openQuestions.map((q) => (
                <li key={q.id} className="msg-in flex items-start justify-between gap-3 text-sm">
                  <span>
                    <span className="font-medium">{q.author}:</span> {q.body}
                  </span>
                  <button type="button" className="btn btn-secondary min-h-8 shrink-0 px-3 text-xs" onClick={() => answer(q.id)} aria-label={`Mark answered: ${q.body}`}>
                    Answered
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <ol className="flex-1 space-y-1 overflow-y-auto py-3" aria-live="polite" aria-relevant="additions">
        <li className="mx-3 flex gap-2 rounded-[var(--radius-input)] bg-violet/10 px-3 py-2 text-sm">
          <ShieldCheck size={16} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0 text-violet" />
          <span>
            <span className="font-semibold">VibrantLearn bot</span>{" "}
            {t(
              "I read every message before the class sees it. Abuse, sexual content, hate, threats, phone numbers and social handles are hidden. 3 warnings and you're removed from the class.",
            )}
          </span>
        </li>
        {messages.map((m) => (
          <Line key={m.id} m={m} classId={classId} />
        ))}
        <li ref={end} aria-hidden="true" />
      </ol>
      {state?.removed ? (
        <p role="alert" className="border-t border-line px-4 py-3 text-sm text-danger">
          {t("The bot removed you from this class after 3 warnings.")}
        </p>
      ) : (
        <form onSubmit={send} className="grid gap-2 border-t border-line p-3">
          {state && state.strikes > 0 ? (
            <p className="text-xs text-danger">{t("Warnings: {n} of {max}.", { n: state.strikes, max: state.strikes_to_remove })}</p>
          ) : null}
          {problem ? (
            <p role="alert" className="text-xs text-danger">
              {problem}
            </p>
          ) : null}
          <div className="flex gap-2">
            <label htmlFor="chat-input" className="sr-only">
              {t("Message the class")}
            </label>
            <input
              id="chat-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={500}
              autoComplete="off"
              placeholder={role === "teacher" ? t("Message the class…") : t("Ask a question…")}
              className="field min-w-0 flex-1"
            />
            <button type="submit" className="btn btn-primary" disabled={!draft.trim()}>
              {t("Send")}
            </button>
          </div>
          {role === "student" ? (
            <label className="flex w-fit items-center gap-2 text-sm">
              <input type="checkbox" checked={asQuestion} onChange={(e) => setAsQuestion(e.target.checked)} className="size-4 accent-[var(--color-violet)]" />
              Ask as a question, so the teacher sees it in their queue
            </label>
          ) : null}
        </form>
      )}
    </section>
  );
}

/** T5: who is here. Usernames only, only during the class; refreshed every 15 s. */
function Attendance({ classId }: { classId: string }) {
  const [people, setPeople] = useState<Person[] | null>(null);
  useEffect(() => {
    const load = () =>
      getPeople(classId)
        .then(setPeople)
        .catch(() => undefined);
    load();
    const id = window.setInterval(load, 15_000);
    return () => window.clearInterval(id);
  }, [classId]);
  return (
    <section aria-labelledby="att-h" className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
      <h2 id="att-h" className="text-sm font-semibold">
        In the class {people ? <span className="font-normal text-muted">({people.filter((p) => !p.removed).length})</span> : null}
      </h2>
      {people === null ? (
        <p role="status" className="mt-2 text-sm text-muted">Loading…</p>
      ) : people.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Students appear here as they join.</p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {people.map((p) => (
            <li key={p.user_id} className={`rounded-full px-2.5 py-0.5 text-xs ${p.removed ? "bg-rose/10 text-muted line-through" : "bg-text/5"}`}>
              {p.username}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The live class. The server decides whether this person gets a seat and only then reveals the room. */
export function ClassRoom({ id, backHref }: { id: string; backHref: string }) {
  const { t } = useUi();
  const [room, setRoom] = useState<Room | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const onRemoved = useCallback(() => setRemoved(true), []);

  useEffect(() => {
    joinClass(id)
      .then(setRoom)
      .catch((e) =>
        setProblem(e instanceof ApiError ? e.message : t("Couldn't open the class. Check your connection, then try again.")),
      );
  }, [id, t]);

  return (
    <main
      id="main"
      className="flex min-h-[calc(100dvh-4rem)] flex-col gap-4 p-3 sm:p-5 lg:min-h-dvh"
    >
      <title>{`${t("Live class")} | VibrantLearn`}</title>
      <Link
        href={backHref}
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted no-underline hover:text-text"
      >
        <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />{" "}
        {t("Live classes")}
      </Link>
      {problem ? (
        <div role="alert" className="m-auto max-w-md text-center">
          <h1 className="text-2xl font-bold">
            {t("You can't join right now")}
          </h1>
          <p className="mt-2 text-muted">{problem}</p>
          <Link href={backHref} className="btn btn-secondary mt-5">
            {t("Back to live classes")}
          </Link>
        </div>
      ) : !room ? (
        <p role="status" className="m-auto text-muted">
          {t("Finding your seat…")}
        </p>
      ) : (
        <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <section
            aria-labelledby="video-h"
            className="flex flex-col justify-center gap-3 rounded-[var(--radius-sheet)] bg-ink p-6 text-mist sm:p-10"
          >
            <h1 id="video-h" className="font-display text-3xl font-bold">
              {room.role === "teacher"
                ? t("You're teaching.")
                : t("You have a seat.")}
            </h1>
            <p className="max-w-[52ch] text-mist/80">
              {t(
                "The video opens in a new tab. Keep this tab open for the class chat. Ends at {time}.",
                { time: clock(room.ends_at) },
              )}

            </p>
            {removed ? (
              <p className="font-semibold text-ember">
                {t("The bot removed you from this class after 3 warnings.")}
              </p>
            ) : (
              <a
                href={jitsiSrc(room)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary w-fit"
              >
                <Video size={18} strokeWidth={1.75} aria-hidden="true" />{" "}
                {t("Open the video")}
              </a>
            )}
          </section>
          <div className="grid content-start gap-4">
            {room.role === "teacher" ? <Attendance classId={id} /> : null}
            <Chat classId={id} role={room.role} onRemoved={onRemoved} />
          </div>
        </div>
      )}
    </main>
  );
}
