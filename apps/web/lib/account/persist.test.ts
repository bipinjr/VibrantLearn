import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Demo, Plan } from "@/lib/demo/data";

// Records every call the persistence layer makes, so we can assert the exact SQL verbs it uses.
const calls: string[] = [];
vi.mock("@/lib/supabase/client", () => {
  const chain = (table: string) => {
    const q = {
      insert: () => (calls.push(`${table}.insert`), q),
      upsert: () => (calls.push(`${table}.upsert`), q),
      update: () => (calls.push(`${table}.update`), q),
      delete: () => (calls.push(`${table}.delete`), q),
      eq: () => q,
      neq: () => q,
      then: (ok: (v: { error: null }) => void) => ok({ error: null }),
    };
    return q;
  };
  return { createClient: () => ({ from: chain }) };
});

const { savePlan, updatePlanSteps } = await import("./persist");

const profile = { language: "en", style: "short", formats: ["quiz"] } as unknown as Demo["profile"];
const plan = (id: string): Plan => ({
  id,
  sessionId: "s1",
  subject: "Java Programming",
  deadline: "2026-10-17T04:30:00.000Z",
  mode: "crash",
  hours: 3,
  steps: [],
});

describe("plans for a signed-in student", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it("create -> replan -> create again never upserts (client holds partial column grants)", async () => {
    expect(await savePlan(plan("p1"), profile)).toEqual({});
    expect(await updatePlanSteps({ ...plan("p1"), steps: [] })).toEqual({});
    expect(await savePlan(plan("p2"), profile)).toEqual({});
    expect(calls).toEqual([
      "study_plans.delete",
      "study_plans.insert",
      "study_plans.update",
      "study_plans.delete",
      "study_plans.insert",
    ]);
    expect(calls.some((c) => c.endsWith(".upsert"))).toBe(false);
  });
});
