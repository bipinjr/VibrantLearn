// Deterministic scheduler (PRD F6) for demo mode. No LLM. Plans never run past the deadline.
import type { Mode, PlanStep } from "./data";
import { topicsFor, type Topic } from "./syllabus";

const IST = 330 * 60_000;
const MIN = 60_000;

function istAt(base: Date, dayOffset: number, h: number, m = 0): Date {
  const l = new Date(base.getTime() + IST);
  return new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate() + dayOffset, h, m) - IST);
}
const roundUp5 = (d: Date) => new Date(Math.ceil(d.getTime() / (5 * MIN)) * 5 * MIN);
const iso = (d: Date) => d.toISOString();

/** Topics the student called weak first, then highest exam weight; easier first among equals. */
export function priority(subject: string, weak: string[] = []): Topic[] {
  const isWeak = (t: Topic) =>
    weak.some((w) => `${t.unitTitle} ${t.topic} ${t.subtopics.join(" ")}`.toLowerCase().includes(w.slice(0, Math.max(4, w.length - 2))));
  return topicsFor(subject).sort(
    (a, b) => Number(isWeak(b)) - Number(isWeak(a)) || b.weightage - a.weightage || a.difficulty - b.difficulty,
  );
}

type Input = { subject: string; deadline: Date; now: Date; mode: Mode; hoursPerDay?: number; idPrefix: string; weak?: string[] };

export function buildPlan({ subject, deadline, now, mode, hoursPerDay, idPrefix, weak }: Input): PlanStep[] {
  const topics = priority(subject, weak);
  const steps: PlanStep[] = [];
  let n = 0;
  const add = (kind: PlanStep["kind"], title: string, start: Date, minutes: number, unit?: string) => {
    steps.push({ id: `${idPrefix}-${n++}`, kind, title, unit, start: iso(start), end: minutes ? iso(new Date(start.getTime() + minutes * MIN)) : undefined, minutes: minutes || undefined, done: false });
    return new Date(start.getTime() + minutes * MIN);
  };
  const exam = () => steps.push({ id: `${idPrefix}-exam`, kind: "exam", title: `${subject.replace(" Programming", "")} exam`, start: iso(deadline), done: false });

  if (mode === "sprint") {
    // 25/5 focus blocks on top topics only, ending with a 15-minute mock quiz before the exam.
    let t = roundUp5(now);
    const lastStart = new Date(deadline.getTime() - 15 * MIN);
    for (const tp of topics) {
      if (t.getTime() + 25 * MIN > lastStart.getTime()) break;
      t = add("block", tp.topic, t, 25, `Unit ${tp.unit}`);
      t = new Date(t.getTime() + 5 * MIN);
    }
    if (t.getTime() + 15 * MIN <= deadline.getTime()) add("checkpoint", "15-minute mock quiz", t, 15);
    exam();
    return steps;
  }

  if (mode === "crash") {
    // Daily evening blocks (stop by 11 PM), a checkpoint each day, revision on the last evening,
    // and a short morning slot on exam day if the exam is after 9 AM.
    const budget = (hoursPerDay ?? 3) * 60;
    const days = Math.max(0, Math.round((istAt(deadline, 0, 0).getTime() - istAt(now, 0, 0).getTime()) / 86_400_000));
    const queue = [...topics];
    for (let d = 0; d < Math.max(days, 1); d++) {
      const eveningStart = d === 0 ? roundUp5(now) : istAt(now, d, 18, 0);
      const sleep = istAt(now, d, 23, 0);
      let t = eveningStart;
      let used = 0;
      const lastEvening = d === days - 1;
      if (lastEvening && d > 0) {
        t = add("block", "Revise everything you marked weak", t, 40);
        t = new Date(t.getTime() + 5 * MIN);
        used += 45;
      }
      // First fit: highest-priority topic that still fits the day's budget and bedtime.
      for (let k = 0; k < queue.length; ) {
        const tp = queue[k];
        const fits = used + tp.minutes + 15 <= budget && t.getTime() + tp.minutes * MIN <= Math.min(sleep.getTime(), deadline.getTime());
        if (!fits) {
          k++;
          continue;
        }
        queue.splice(k, 1);
        t = add("block", tp.topic, t, tp.minutes, `Unit ${tp.unit}`);
        t = new Date(t.getTime() + 5 * MIN);
        used += tp.minutes + 5;
      }
      if (steps.length && t.getTime() + 10 * MIN <= Math.min(sleep.getTime() + 30 * MIN, deadline.getTime())) {
        add("checkpoint", d === 0 ? "10-question quiz on tonight's topics" : "Quiz on today's topics", t, 10);
      }
    }
    // Exam-day morning. Topics the evenings couldn't reach come FIRST: a student who opens the app
    // at 10:40 PM has no usable evening left, and the morning is the only study time they have.
    // Only then the revision extras, and only if there was something to revise.
    const morning = istAt(deadline, 0, 6, 30);
    const morningEnd = new Date(deadline.getTime() - 30 * MIN); // walk-to-the-hall buffer
    if (days >= 1 && morningEnd.getTime() - morning.getTime() >= 45 * MIN) {
      let t = morning;
      let used = 0;
      // Hold back 20 minutes so the mock test that closes a crash plan always fits.
      const studyEnd = new Date(morningEnd.getTime() - 20 * MIN);
      const room = (minutes: number) =>
        used + minutes <= budget && t.getTime() + minutes * MIN <= studyEnd.getTime();
      for (let k = 0; k < queue.length; ) {
        const tp = queue[k];
        if (!room(tp.minutes)) {
          k++;
          continue;
        }
        queue.splice(k, 1);
        t = add("block", tp.topic, t, tp.minutes, `Unit ${tp.unit}`);
        t = new Date(t.getTime() + 5 * MIN);
        used += tp.minutes + 5;
      }
      // "Redo the questions you got wrong" only makes sense after a quiz has actually happened.
      if (steps.some((s) => s.kind === "checkpoint") && room(30)) {
        t = add("block", "Redo the questions you got wrong", t, 30);
        t = new Date(t.getTime() + 5 * MIN);
        used += 35;
      }
      if (t.getTime() + 15 * MIN <= morningEnd.getTime()) add("checkpoint", "15-minute mock test", t, 15);
    }
    exam();
    return steps;
  }

  // steady / deep: one unit per week, weekend checkpoints, the final stretch for spaced revision.
  const units = [...new Map(topicsFor(subject).map((t) => [t.unit, t.unitTitle])).entries()];
  const weeks = Math.max(1, Math.floor((deadline.getTime() - now.getTime()) / (7 * 86_400_000)));
  const studyWeeks = Math.max(1, weeks - 1);
  const perWeek = Math.ceil(units.length / studyWeeks);
  for (let w = 0; w < studyWeeks; w++) {
    const chunk = units.slice(w * perWeek, (w + 1) * perWeek);
    if (!chunk.length) break;
    const start = istAt(now, 1 + w * 7, 17, 0);
    if (start >= deadline) break;
    const mins = topicsFor(subject).filter((t) => chunk.some(([u]) => u === t.unit)).reduce((a, t) => a + t.minutes, 0);
    add("block", `Week ${w + 1}: ${chunk.map(([, title]) => title).join(", ")}`, start, mins);
    const sat = istAt(now, 1 + w * 7 + 4, 11, 0);
    if (sat < deadline) add("checkpoint", `Weekend checkpoint: 20 questions on week ${w + 1}`, sat, 40);
  }
  const revStart = istAt(deadline, -6, 17, 0);
  if (revStart > now) {
    for (const [i, gap] of [1, 3, 7].entries()) {
      const at = new Date(revStart.getTime() + (gap - 1) * 86_400_000 * 0.8);
      if (at < deadline) add("block", `Revision loop ${i + 1}: weakest topics first`, at, 60);
    }
  }
  exam();
  return steps.sort((a, b) => a.start.localeCompare(b.start));
}
