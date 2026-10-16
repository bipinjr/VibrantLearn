import { ShieldCheck } from "lucide-react";
import Link from "next/link";

/** "Tonight on VibrantLearn": the evening as a route, 5 to 10 PM, with live rooms as stops.
 * Each room shows its seat meter filling toward the 10 students it needs to run. */
const ROOMS = [
  { time: "6:00 PM", topic: "Normal forms, 1NF to BCNF", subject: "DBMS", teacher: "Asha Madam", interested: 23, state: "Live now" },
  { time: "7:30 PM", topic: "Inheritance and method overriding", subject: "Java", teacher: "Ravi Sir", interested: 14, state: "Filling up" },
  { time: "9:00 PM", topic: "Deadlocks and the banker's algorithm", subject: "Operating Systems", teacher: "Nayana Madam", interested: 7, state: "3 more to run" },
] as const;

function Seats({ n }: { n: number }) {
  const filled = Math.min(n, 10);
  return (
    <span className="flex items-center gap-2" aria-label={`${n} interested, ${Math.max(0, 10 - n)} more needed to run`}>
      <span className="flex gap-1" aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className={`size-2 rounded-full ${i < filled ? (n >= 10 ? "bg-leaf" : "bg-ember") : "bg-mist/20"}`} />
        ))}
      </span>
      <span className="text-sm tabular-nums text-mist/75">{n} interested</span>
    </span>
  );
}

export function LiveTonight() {
  return (
    <section id="live" aria-labelledby="live-h" data-theme="dark" className="scroll-mt-20 bg-ink py-24 text-text">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="scroll-in grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-end">
          <h2 id="live-h" className="text-4xl font-bold sm:text-5xl">Stuck at 9 PM? A teacher is live tonight.</h2>
          <p className="text-lg text-muted">
            College teachers run small evening classes, 10 to 40 students. Tap Interested, and when it starts you join
            right here. No links passed around, no recordings, and a bot keeps the chat clean.
          </p>
        </div>

        {/* The evening route: same path motif as a study plan, now across the night. */}
        <ol className="relative mt-16 grid gap-10 md:grid-cols-3 md:gap-6">
          <span aria-hidden="true" className="absolute top-[7px] right-0 left-0 hidden h-[3px] rounded-full bg-[linear-gradient(90deg,var(--color-ember),var(--color-orchid),var(--color-violet))] md:block" />
          <span aria-hidden="true" className="absolute top-0 bottom-0 left-[7px] w-[3px] rounded-full bg-[linear-gradient(180deg,var(--color-ember),var(--color-orchid),var(--color-violet))] md:hidden" />
          {ROOMS.map((r, i) => (
            <li key={r.topic} className="scroll-in relative pl-9 md:pt-10 md:pl-0">
              <span aria-hidden="true" className={`absolute top-0 left-0 size-[17px] rounded-full border-[3px] border-ink ${i === 0 ? "bg-ember" : "bg-mist"}`} />
              <p className="font-display text-2xl font-bold tabular-nums">{r.time}</p>
              <p className={`mt-1 text-sm font-semibold ${i === 0 ? "text-ember" : "text-mist/75"}`}>{r.state}</p>
              <p className="mt-4 text-lg font-semibold">{r.topic}</p>
              <p className="text-sm text-muted">
                {r.subject}, with {r.teacher}
              </p>
              <div className="mt-4">
                <Seats n={r.interested} />
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-20 grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div className="scroll-in max-w-md">
            <h3 className="text-2xl font-bold">A chat that stays about the subject</h3>
            <p className="mt-3 text-muted">
              Every message is checked before the class sees it, in English, Kannada, Hindi and the way you actually type
              them. Abuse, threats and phone numbers are hidden. Three warnings and you&rsquo;re out of the class.
            </p>
          </div>
          <div className="scroll-in grid gap-2 rounded-[var(--radius-sheet)] border border-line bg-surface p-5 text-sm sm:p-6" aria-label="Example class chat">
            <p>
              <span className="font-semibold">priya.k</span> Sir, why does super() have to be the first line?
            </p>
            <p>
              <span className="font-semibold">Ravi Sir</span> Because the parent part of the object is built first. Good question.
            </p>
            <p className="text-muted line-through decoration-muted">
              <span className="font-semibold">anon.x</span> ********
            </p>
            <p className="flex gap-2 rounded-[var(--radius-input)] bg-violet/15 px-3 py-2">
              <ShieldCheck size={16} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0 text-link" />
              <span>
                <span className="font-semibold">VibrantLearn bot</span> Hid a message from anon.x: abusive language. Warning 1 of 3.
              </span>
            </p>
          </div>
        </div>

        <div className="scroll-in mt-20 grid gap-8 border-t border-line pt-12 md:grid-cols-[1.2fr_1fr] md:items-center">
          <div>
            <h3 className="text-3xl font-bold">Free after 5 PM? Teach.</h3>
            <p className="mt-3 max-w-lg text-muted">
              Create a room, pick a time, and students who need you sign up. About &#8377;1,600 per class after the 20% fee,
              with your rating and earnings on one dashboard.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 md:justify-end">
            <Link href="/teach/signup" className="btn btn-primary min-h-12 px-6 text-lg">
              Start teaching
            </Link>
            <Link href="/teach/login" className="font-medium">
              Teacher sign in
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
