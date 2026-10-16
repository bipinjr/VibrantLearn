"use client";

import { ArrowLeft, ShieldCheck, Video } from "lucide-react";
import Link from "next/link";
import {
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
  type SubmitEvent,
} from "react";
import { ApiError } from "@/lib/api/client";
import {
  jitsiSrc,
  joinClass,
  readChat,
  sendChat,
  type ChatMessage,
  type ChatState,
  type Room,
} from "@/lib/api/classes";
import { useDemo } from "@/lib/demo/store";
import { clock } from "@/lib/format";
import { useUi } from "@/lib/i18n/context";

const POLL_MS = 3000;

function Line({ m }: { m: ChatMessage }) {
  const { t } = useUi();
  if (m.bot) {
    return (
      <li className="mx-3 flex gap-2 rounded-[var(--radius-input)] bg-violet/10 px-3 py-2 text-sm">
        <ShieldCheck
          size={16}
          strokeWidth={1.75}
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-violet"
        />
        <span>
          <span className="font-semibold">{m.author}</span> {m.body}
        </span>
      </li>
    );
  }
  return (
    <li
      className={
        m.hidden
          ? "mx-3 px-3 py-1 text-sm text-muted"
          : "mx-3 px-3 py-1 text-sm"
      }
    >
      <span className="font-semibold">{m.mine ? t("You") : m.author}</span>{" "}
      <span className="text-xs text-muted tabular-nums">{clock(m.at)}</span>
      <p className={m.hidden ? "line-through decoration-muted" : ""}>
        {m.body}
      </p>
      {m.hidden ? <p className="text-xs text-danger">{m.hidden}</p> : null}
    </li>
  );
}

function Chat({
  classId,
  onRemoved,
}: {
  classId: string;
  onRemoved: () => void;
}) {
  const { t } = useUi();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [state, setState] = useState<ChatState | null>(null);
  const [draft, setDraft] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const last = useRef(0);
  const end = useRef<HTMLLIElement>(null);

  const merge = useCallback((more: ChatMessage[]) => {
    if (!more.length) return;
    setMessages((m) => {
      const seen = new Set(m.map((x) => x.id));
      return [...m, ...more.filter((x) => !seen.has(x.id))].sort(
        (a, b) => a.id - b.id,
      );
    });
    last.current = Math.max(last.current, ...more.map((x) => x.id));
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
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function send(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setBusy(true);
    setProblem(null);
    try {
      const r = await sendChat(classId, body);
      merge([r.message]);
      setState(r);
      if (r.removed) onRemoved();
      setDraft("");
      poll(); // pick up the bot's notice straight away
    } catch (err) {
      setProblem(
        err instanceof ApiError
          ? err.message
          : t("Couldn't send. Check your connection."),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby="chat-h"
      className="flex min-h-[60dvh] flex-col rounded-[var(--radius-card)] border border-line lg:min-h-0"
    >
      <h2 id="chat-h" className="border-b border-line px-4 py-3 font-semibold">
        {t("Class chat")}
      </h2>
      <ol
        className="flex-1 space-y-1 overflow-y-auto py-3"
        aria-live="polite"
        aria-relevant="additions"
      >
        <li className="mx-3 flex gap-2 rounded-[var(--radius-input)] bg-violet/10 px-3 py-2 text-sm">
          <ShieldCheck
            size={16}
            strokeWidth={1.75}
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-violet"
          />
          <span>
            <span className="font-semibold">VibrantLearn bot</span>{" "}
            {t(
              "I read every message before the class sees it. Abuse, sexual content, hate, threats, phone numbers and social handles are hidden. 3 warnings and you're removed from the class.",
            )}
          </span>
        </li>
        {messages.map((m) => (
          <Line key={m.id} m={m} />
        ))}
        <li ref={end} aria-hidden="true" />
      </ol>
      {state?.removed ? (
        <p
          role="alert"
          className="border-t border-line px-4 py-3 text-sm text-danger"
        >
          {t("The bot removed you from this class after 3 warnings.")}
        </p>
      ) : (
        <form onSubmit={send} className="grid gap-2 border-t border-line p-3">
          {state && state.strikes > 0 ? (
            <p className="text-xs text-danger">
              {t("Warnings: {n} of {max}.", {
                n: state.strikes,
                max: state.strikes_to_remove,
              })}
            </p>
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
              placeholder={t("Ask a question…")}
              className="field min-w-0 flex-1"
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={busy || !draft.trim()}
            >
              {t("Send")}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

/** The live class. The server decides whether this person gets a seat and only then reveals the room. */
export default function ClassRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { mode } = useDemo();
  const { t } = useUi();
  const [room, setRoom] = useState<Room | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const onRemoved = useCallback(() => setRemoved(true), []);

  useEffect(() => {
    if (mode !== "account") return;
    joinClass(id)
      .then(setRoom)
      .catch((e) =>
        setProblem(
          e instanceof ApiError
            ? e.message
            : t(
                "Couldn't open the class. Check your connection, then try again.",
              ),
        ),
      );
  }, [id, mode, t]);

  return (
    <main
      id="main"
      className="flex min-h-[calc(100dvh-4rem)] flex-col gap-4 p-3 sm:p-5 lg:min-h-dvh"
    >
      <title>{`${t("Live class")} | VibrantLearn`}</title>
      <Link
        href="/app/classes"
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted no-underline hover:text-text"
      >
        <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />{" "}
        {t("Live classes")}
      </Link>
      {mode !== "account" ? (
        <p className="m-auto max-w-md text-center text-muted">
          {t("Live classes need a real account.")}
        </p>
      ) : problem ? (
        <div role="alert" className="m-auto max-w-md text-center">
          <h1 className="text-2xl font-bold">
            {t("You can't join right now")}
          </h1>
          <p className="mt-2 text-muted">{problem}</p>
          <Link href="/app/classes" className="btn btn-secondary mt-5">
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
              {room.role === "teacher"
                ? ` ${t("Jitsi may ask you to sign in once with Google to start the room.")}`
                : null}
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
          <Chat classId={id} onRemoved={onRemoved} />
        </div>
      )}
    </main>
  );
}
