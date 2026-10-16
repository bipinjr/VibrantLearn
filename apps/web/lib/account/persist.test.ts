import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Plan } from "@/lib/demo/data";

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
      then: (ok: (v: { error: null }) => void) => ok({ error: null }),
    };
    return q;
  };
  return { createClient: () => ({ from: chain }) };
});

const { updatePlanSteps } = await import("./persist");

const plan: Plan = { id: "p1", sessionId: "s1", subject: "Java Programming", deadline: "2026-10-17T04:30:00.000Z", mode: "crash", hours: 3, steps: [] };

describe("plans for a signed-in student", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  // The server creates plans now (B3). The browser may only tick and replan its own plan, with a
  // plain UPDATE: the client holds UPDATE on (plan, updated_at) only, so an upsert would fail.
  it("tick/replan is a plain update, never an upsert or insert", async () => {
    expect(await updatePlanSteps(plan)).toEqual({});
    expect(calls).toEqual(["study_plans.update"]);
  });
});
