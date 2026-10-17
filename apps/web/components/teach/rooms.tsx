"use client";

import { Check, Copy, Video } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type SubmitEvent } from "react";
import { ApiError } from "@/lib/api/client";
import { cancelClass, postClass, rupees, type LiveClass } from "@/lib/api/classes";
import { getTopics, type SyllabusTopic } from "@/lib/api/live";
import { clock, dayLabel } from "@/lib/format";
import { useUi } from "@/lib/i18n/context";
import { LEVELS } from "./parts";
import { AfterClass } from "./after";
import { useTeach, type Rules } from "./data";
import { PreflightCheck, ShortPrompt } from "./runway";

const LIVE: LiveClass["phase"][] = ["teacher_early", "grace", "open"];

/** "Starts in 1 h 6 min" / "Live now", re-rendered every 15 s. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function until(iso: string, now: number): string {
  const min = Math.max(0, Math.round((new Date(iso).getTime() - now) / 60_000));
  if (min < 1) return "Starts now";
  if (min < 60) return `Starts in ${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h < 24) return `Starts in ${h} h${m ? ` ${m} min` : ""}`;
  return `Starts in ${Math.round(h / 24)} days`;
}

export function roomState(c: LiveClass, now: number): string {
  if (c.phase === "grace" || c.phase === "open") return "Live now";
  if (c.phase === "teacher_early") return "Open the room, students join at the start";
  if (c.phase === "cancelled") return "Cancelled";
  if (c.phase === "done" || c.phase === "ended") return "Finished";
  return until(c.starts_at, now);
}

/** Seat dots toward the minimum the class needs to run. */
export function Seats({ n, need, onDark = false }: { n: number; need: number; onDark?: boolean }) {
  const dots = Math.min(need, 10);
  const filled = Math.min(n, dots);
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="flex gap-1" aria-hidden="true">
        {Array.from({ length: dots }, (_, i) => (
          <span key={i} className={`size-2.5 rounded-full ${i < filled ? (n >= need ? "bg-leaf" : "bg-ember") : onDark ? "bg-mist/20" : "bg-line"}`} />
        ))}
      </span>
      <span className={`text-sm tabular-nums ${onDark ? "text-mist/80" : "text-muted"}`}>
        {n >= need ? `${n} interested, it will run` : `${n} of ${need} needed to run`}
      </span>
    </span>
  );
}

export function classLink(id: string): string {
  return `${window.location.origin}/app/classes#c-${id}`;
}

function CopyLink({ id, onDark = false }: { id: string; onDark?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={`btn ${onDark ? "border border-mist/30 text-mist hover:bg-mist/10" : "btn-secondary"}`}
      onClick={() => {
        void navigator.clipboard.writeText(classLink(id)).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        });
      }}
    >
      {copied ? <Check size={16} strokeWidth={2} aria-hidden="true" /> : <Copy size={16} strokeWidth={1.75} aria-hidden="true" />}
      <span aria-live="polite">{copied ? "Link copied" : "Copy class link"}</span>
    </button>
  );
}

/** The signature panel: the next room, big, with what to do about it right now. */
export function NextRoom({ room }: { room: LiveClass }) {
  const { lang } = useUi();
  const { rules } = useTeach();
  const now = useNow();
  const live = LIVE.includes(room.phase);
  return (
    <section aria-labelledby="next-h" data-theme="dark" className="flex flex-col gap-5 rounded-[var(--radius-sheet)] bg-ink p-6 text-text sm:p-8">
      <div>
        <p className={`text-sm font-semibold ${live ? "text-ember" : "text-muted"}`}>{roomState(room, now)}</p>
        <h2 id="next-h" className="mt-2 font-display text-5xl font-bold tabular-nums sm:text-6xl">{clock(room.starts_at)}</h2>
        <p className="mt-1 text-muted">
          {dayLabel(room.starts_at, new Date(now).toISOString(), lang)}, {room.duration_min} min
        </p>
      </div>
      <div>
        <p className="text-xl font-semibold">{room.topic}</p>
        <p className="text-sm text-muted">{room.subject}</p>
      </div>
      <Seats n={room.interested} need={rules.min_students} onDark />
      <div className="mt-auto flex flex-wrap gap-2">
        {live ? (
          <Link href={`/teach/room/${room.id}`} className="btn btn-primary">
            <Video size={18} strokeWidth={1.75} aria-hidden="true" /> Start the class
          </Link>
        ) : null}
        <CopyLink id={room.id} onDark />
      </div>
      {live || new Date(room.starts_at).getTime() - now < 15 * 60_000 ? <PreflightCheck onDark /> : null}
      {!live && room.phase === "upcoming" ? (
        <p className="text-sm text-muted">You can open the room 10 minutes before it starts. Share the link with your own students to fill seats.</p>
      ) : null}
      <ShortPrompt c={room} now={now} />
    </section>
  );
}

type When = "now" | "30" | "tonight" | "tomorrow" | "pick";

function startFor(when: When, rules: Rules, picked: string): Date | null {
  const now = new Date();
  const lead = rules.min_lead_min;
  if (when === "now") return new Date(now.getTime() + 60_000);
  if (when === "30") {
    const d = new Date(now.getTime() + Math.max(30, lead) * 60_000);
    d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
    return d;
  }
  if (when === "tonight" || when === "tomorrow") {
    const d = new Date(now);
    if (when === "tomorrow") d.setDate(d.getDate() + 1);
    d.setHours(19, 0, 0, 0);
    return d;
  }
  return picked ? new Date(picked) : null;
}

function localInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** New room in a few taps, like starting a meeting. Shows the money and the run rule before posting. */
export type Prefill = { subject: string; topic: string; weak?: string } | null;

/** Topics from the syllabus for the chosen subject; 1-4 attach the room to real topics (T3). */
function TopicPicker({ subject, value, onChange, weak }: { subject: string; value: string[]; onChange: (v: string[]) => void; weak?: string }) {
  const [topics, setTopics] = useState<SyllabusTopic[] | null>(null);
  useEffect(() => {
    let live = true;
    getTopics(subject)
      .then((t) => {
        if (!live) return;
        setTopics(t);
        if (weak) {
          const hit = t.find((x) => x.topic.toLowerCase().includes(weak.toLowerCase().slice(0, 6)));
          if (hit) onChange([hit.id]);
        }
      })
      .catch(() => live && setTopics([]));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the subject changes
  }, [subject, weak]);
  if (topics === null) return <p className="text-sm text-muted" role="status">Loading topics…</p>;
  if (!topics.length) return null;
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium">Syllabus topics <span className="font-normal text-muted">(pick 1 to 4)</span></legend>
      <div className="flex max-h-44 flex-wrap gap-2 overflow-y-auto pr-1">
        {topics.map((t) => (
          <label key={t.id} className="chip text-sm">
            <input
              type="checkbox"
              checked={value.includes(t.id)}
              disabled={!value.includes(t.id) && value.length >= 4}
              onChange={(e) => onChange(e.target.checked ? [...value, t.id] : value.filter((x) => x !== t.id))}
            />
            {t.topic}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function NewRoom({ subjects, onCreated, prefill = null }: { subjects: string[]; onCreated: (topic: string) => void; prefill?: Prefill }) {
  const { rules } = useTeach();
  const tonightOk = new Date().getHours() * 60 + new Date().getMinutes() + rules.min_lead_min < 19 * 60;
  const options: [When, string][] = [
    ...(rules.min_lead_min === 0 ? ([["now", "Start now"]] as [When, string][]) : []),
    ["30", rules.min_lead_min <= 30 ? "In 30 min" : `In ${rules.min_lead_min} min`],
    ...(tonightOk ? ([["tonight", "Tonight, 7 PM"]] as [When, string][]) : []),
    ["tomorrow", "Tomorrow, 7 PM"],
    ["pick", "Pick a time"],
  ];
  const [when, setWhen] = useState<When>(options[0][0]);
  const [picked, setPicked] = useState(() => localInput(new Date(Date.now() + 2 * 60 * 60_000)));
  const [length, setLength] = useState(60);
  const [subject, setSubject] = useState(prefill?.subject ?? subjects[0] ?? "");
  const [topicIds, setTopicIds] = useState<string[]>([]);
  const [seats, setSeats] = useState(rules.max_students);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const start = startFor(when, rules, picked);
    if (!start) return setProblem("Pick a date and time.");
    setBusy(true);
    setProblem(null);
    const topic = String(f.get("topic")).trim();
    try {
      await postClass({ subject, topic, level: String(f.get("level")), starts_at: start.toISOString(), duration_min: length, topic_ids: topicIds, seat_cap: seats });
      onCreated(topic);
    } catch (err) {
      setProblem(err instanceof ApiError ? err.message : "Couldn't create the room. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} aria-labelledby="new-h" className="grid content-start gap-5 rounded-[var(--radius-sheet)] border border-line bg-surface p-6 sm:p-8">
      <h2 id="new-h" className="text-2xl font-bold">New room</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <label htmlFor="subject" className="text-sm font-medium">Subject</label>
          <select id="subject" name="subject" required className="field" value={subject} onChange={(e) => { setSubject(e.target.value); setTopicIds([]); }}>
            {(subjects.includes(subject) ? subjects : [subject, ...subjects]).map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="level" className="text-sm font-medium">Who it suits</label>
          <select id="level" name="level" defaultValue="all" className="field">
            {LEVELS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </div>
      </div>
      <div className="grid gap-1.5">
        <label htmlFor="topic" className="text-sm font-medium">What you&rsquo;ll teach</label>
        <input id="topic" name="topic" required minLength={2} maxLength={160} className="field" placeholder="Normal forms, 1NF to BCNF" defaultValue={prefill?.topic} key={prefill?.topic ?? "blank"} />
      </div>
      {subject ? <TopicPicker key={subject} subject={subject} value={topicIds} onChange={setTopicIds} weak={prefill?.weak} /> : null}
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">When</legend>
        <div className="flex flex-wrap gap-2">
          {options.map(([id, label]) => (
            <label key={id} className="chip">
              <input type="radio" name="when" checked={when === id} onChange={() => setWhen(id)} />
              {label}
            </label>
          ))}
        </div>
        {when === "pick" ? (
          <input type="datetime-local" aria-label="Date and time" value={picked} onChange={(e) => setPicked(e.target.value)} className="field mt-1 w-fit" />
        ) : null}
      </fieldset>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Length</legend>
        <div className="flex flex-wrap gap-2">
          {[30, 45, 60, 90, 120].map((m) => (
            <label key={m} className="chip">
              <input type="radio" name="length" checked={length === m} onChange={() => setLength(m)} />
              {m} min
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-1.5">
        <label htmlFor="seats" className="text-sm font-medium">
          Seats <span className="font-normal text-muted">({rules.min_students} needed to run, up to {seats})</span>
        </label>
        <input id="seats" type="range" min={10} max={rules.max_students} step={5} value={seats} onChange={(e) => setSeats(Number(e.target.value))} className="w-full max-w-xs accent-[var(--color-violet)]" />
      </div>
      <div className="rounded-[var(--radius-input)] bg-text/[0.04] px-4 py-3 text-sm">
        <p>
          <strong>If 10 join you earn {rupees(rules.net_paise)}. If {seats} join you earn {rupees(rules.net_paise)}.</strong> That&rsquo;s {rupees(rules.gross_paise)} per class minus the {rules.fee_percent}% platform fee, paid on the 1st of the month after you withdraw.
        </p>
        <p className="mt-1 text-muted">
          If fewer than {rules.min_students} {rules.min_students === 1 ? "student marks" : "students mark"} Interested by the start, the room cancels itself at no cost to you.
        </p>
      </div>
      {problem ? <p role="alert" className="text-sm text-danger">{problem}</p> : null}
      <button type="submit" className="btn btn-primary min-h-12 w-fit px-6" disabled={busy}>
        {busy ? "Creating…" : "Create room"}
      </button>
    </form>
  );
}

/** What the teacher sees the moment a room exists: no guessing whether it worked. */
export function RoomReady({ room, onAnother }: { room: LiveClass | undefined; onAnother: () => void }) {
  const { lang } = useUi();
  return (
    <section aria-labelledby="ready-h" role="status" className="grid content-start gap-4 rounded-[var(--radius-sheet)] border-2 border-leaf bg-surface p-6 sm:p-8">
      <p className="flex items-center gap-2 font-semibold text-done">
        <Check size={20} strokeWidth={2.25} aria-hidden="true" /> Room ready
      </p>
      {room ? (
        <>
          <h2 id="ready-h" className="text-2xl font-bold">{room.topic}</h2>
          <p className="text-muted">
            {room.subject}. {dayLabel(room.starts_at, new Date().toISOString(), lang)} at {clock(room.starts_at)}, {room.duration_min} min.
          </p>
          <p className="text-sm">Students see it in Live classes now. Share the link to bring your own students.</p>
          <div className="flex flex-wrap gap-2">
            {LIVE.includes(room.phase) ? (
              <Link href={`/teach/room/${room.id}`} className="btn btn-primary">
                <Video size={18} strokeWidth={1.75} aria-hidden="true" /> Start the class
              </Link>
            ) : null}
            <CopyLink id={room.id} />
            <button type="button" className="btn btn-secondary" onClick={onAnother}>Create another</button>
          </div>
        </>
      ) : (
        <h2 id="ready-h" className="text-2xl font-bold">Saving your room…</h2>
      )}
    </section>
  );
}

export function RoomRow({ c }: { c: LiveClass }) {
  const { lang } = useUi();
  const { rules, reload } = useTeach();
  const now = useNow();
  const [problem, setProblem] = useState<string | null>(null);
  const live = LIVE.includes(c.phase);
  async function cancel() {
    if (!window.confirm(`Cancel "${c.topic}"? Students who marked Interested will see it's cancelled.`)) return;
    try {
      await cancelClass(c.id);
      reload();
    } catch (e) {
      setProblem(e instanceof ApiError ? e.message : "Couldn't cancel. Try again.");
    }
  }
  return (
    <li id={`room-${c.id}`} className="grid gap-3 py-5 sm:grid-cols-[7rem_1fr_auto] sm:items-center sm:gap-6">
      <p className="tabular-nums">
        <span className="block font-display text-2xl font-bold">{clock(c.starts_at)}</span>
        <span className="text-sm text-muted">{dayLabel(c.starts_at, new Date(now).toISOString(), lang)}</span>
      </p>
      <div className="min-w-0">
        <p className="font-semibold">{c.topic}</p>
        <p className="text-sm text-muted">
          {c.subject}, {c.duration_min} min. <span className={live ? "font-semibold text-now" : ""}>{roomState(c, now)}</span>
          {c.phase === "cancelled" && c.cancel_reason ? `. ${c.cancel_reason}` : ""}
        </p>
        {c.phase === "upcoming" || live ? <div className="mt-2"><Seats n={c.interested} need={rules.min_students} /></div> : null}
        {problem ? <p role="alert" className="mt-1 text-sm text-danger">{problem}</p> : null}
        <ShortPrompt c={c} now={now} />
        {c.phase === "done" || c.phase === "ended" || c.phase === "cancelled" ? <AfterClass c={c} /> : null}
      </div>
      <div className="flex flex-wrap gap-2 sm:justify-end">
        {live ? (
          <Link href={`/teach/room/${c.id}`} className="btn btn-primary">Start the class</Link>
        ) : c.phase === "upcoming" ? (
          <>
            <CopyLink id={c.id} />
            <button type="button" className="btn btn-secondary" onClick={cancel} aria-label={`Cancel room: ${c.topic}`}>Cancel room</button>
          </>
        ) : null}
      </div>
    </li>
  );
}
