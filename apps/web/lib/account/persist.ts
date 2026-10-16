// Writes a signed-in student's changes to Supabase. RLS guarantees each call can only touch the
// student's own rows (tested: supabase/tests/rls.test.sql). Errors are returned, never thrown,
// so the UI can show "couldn't save" without losing what's on screen.
import type { Demo, Plan, Session } from "@/lib/demo/data";
import { api, ApiError } from "@/lib/api/client";
import { createClient } from "@/lib/supabase/client";

type Result = { error?: string };
const db = () => createClient();
const fail = (e: { message: string } | null): Result => (e ? { error: e.message } : {});

export async function createSession(s: Session): Promise<Result> {
  const { error } = await db().from("study_sessions").insert({ id: s.id, title: s.title.slice(0, 120) });
  return fail(error);
}

/** Through the API: it removes the session's stored files first, then the row (BUILD_PLAN A3). */
export async function deleteSession(id: string): Promise<Result> {
  try {
    await api(`/sessions/${encodeURIComponent(id)}`, { method: "DELETE" });
    return {};
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : "Couldn't delete that session." };
  }
}

export async function updatePlanSteps(plan: Plan): Promise<Result> {
  const { error } = await db().from("study_plans").update({ plan: { steps: plan.steps }, updated_at: new Date().toISOString() }).eq("id", plan.id);
  return fail(error);
}

export async function updateProfile(userId: string, p: Partial<Demo["profile"]>): Promise<Result> {
  const row: Record<string, unknown> = {};
  if (p.university !== undefined) row.university = p.university.slice(0, 120);
  if (p.course !== undefined) row.course = p.course;
  if (p.semester !== undefined) row.semester = p.semester;
  if (p.language !== undefined) row.language = p.language;
  if (p.style !== undefined) row.style = p.style;
  if (p.formats !== undefined) row.formats = p.formats;
  if (!Object.keys(row).length) return {};
  const { error } = await db().from("profiles").update(row).eq("id", userId);
  return fail(error);
}
