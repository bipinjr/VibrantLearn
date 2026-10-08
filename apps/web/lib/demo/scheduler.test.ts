import { describe, expect, it } from "vitest";
import { buildPlan } from "./scheduler";

const NOW = new Date("2026-10-08T15:00:00Z"); // Thu 8:30 PM IST
const h = (n: number) => new Date(NOW.getTime() + n * 3_600_000);

function check(steps: ReturnType<typeof buildPlan>, deadline: Date) {
  const exam = steps.at(-1)!;
  expect(exam.kind).toBe("exam");
  for (const s of steps.slice(0, -1)) {
    expect(new Date(s.end ?? s.start).getTime()).toBeLessThanOrEqual(deadline.getTime());
    expect(new Date(s.start).getTime()).toBeGreaterThanOrEqual(NOW.getTime() - 5 * 60_000);
  }
}

describe("buildPlan", () => {
  it("sprint: 25-min blocks, top topics, mock quiz last, never past the exam", () => {
    const deadline = h(2);
    const steps = buildPlan({ subject: "Java Programming", deadline, now: NOW, mode: "sprint", idPrefix: "t" });
    check(steps, deadline);
    const blocks = steps.filter((s) => s.kind === "block");
    expect(blocks.every((b) => b.minutes === 25)).toBe(true);
    expect(blocks[0].title).toMatch(/Inheritance|overriding|Exception/);
    expect(steps.at(-2)?.title).toBe("15-minute mock quiz");
  });

  it("crash: checkpoint every day, respects hours per day", () => {
    const deadline = new Date("2026-10-10T05:30:00Z"); // Sat 11 AM IST
    const steps = buildPlan({ subject: "Database Management Systems", deadline, now: NOW, mode: "crash", hoursPerDay: 2, idPrefix: "t" });
    check(steps, deadline);
    expect(steps.filter((s) => s.kind === "checkpoint").length).toBeGreaterThanOrEqual(2);
    const perDay = new Map<string, number>();
    for (const s of steps.filter((x) => x.kind === "block")) {
      const day = s.start.slice(0, 10);
      perDay.set(day, (perDay.get(day) ?? 0) + (s.minutes ?? 0));
    }
    for (const m of perDay.values()) expect(m).toBeLessThanOrEqual(2 * 60);
  });

  it("steady: weekly milestones with weekend checkpoints", () => {
    const deadline = new Date(NOW.getTime() + 21 * 86_400_000);
    const steps = buildPlan({ subject: "Data Structures", deadline, now: NOW, mode: "steady", idPrefix: "t" });
    check(steps, deadline);
    expect(steps.some((s) => s.title.startsWith("Week 1"))).toBe(true);
    expect(steps.some((s) => s.title.startsWith("Weekend checkpoint"))).toBe(true);
  });

  it("deep: covers every unit and adds revision loops", () => {
    const deadline = new Date(NOW.getTime() + 60 * 86_400_000);
    const steps = buildPlan({ subject: "Operating Systems", deadline, now: NOW, mode: "deep", idPrefix: "t" });
    check(steps, deadline);
    expect(steps.filter((s) => s.title.startsWith("Revision loop")).length).toBe(3);
  });
});
