// Writes a signed-in student's changes to Supabase. RLS guarantees each call can only touch the
// student's own rows (tested: supabase/tests/rls.test.sql). Errors are returned, never thrown,
// so the UI can show "couldn't save" without losing what's on screen.
import type { Demo, Message, Plan, Session } from "@/lib/demo/data";
import { createClient } from "@/lib/supabase/client";

type Result = { error?: string };
const db = () => createClient();
const fail = (e: { message: string } | null): Result => (e ? { error: e.message } : {});

export async function createSession(s: Session): Promise<Result> {
  const { error } = await db().from("study_sessions").insert({ id: s.id, title: s.title.slice(0, 120) });
  return fail(error);
}

export async function patchSession(id: string, p: Partial<Session>): Promise<Result> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (p.title) row.title = p.title.slice(0, 120);
  if (p.subject !== undefined) row.subject = p.subject || null;
  if (p.deadline !== undefined) row.deadline_at = p.deadline || null;
  if (p.mode) row.mode = p.mode;
  const { error } = await db().from("study_sessions").update(row).eq("id", id);
  return fail(error);
}

export async function deleteSession(id: string): Promise<Result> {
  const { error } = await db().from("study_sessions").delete().eq("id", id);
  return fail(error);
}

export async function addMessage(sessionId: string, m: Message): Promise<Result> {
  const { error } = await db().from("messages").insert({
    id: m.id,
    session_id: sessionId,
    role: m.role,
    content: (m.content ?? "").slice(0, 20000),
    blocks: m.blocks ?? [],
    served_from: m.servedFrom ?? null,
  });
  return fail(error);
}

/** Stores a newly built plan, replacing any older plan in the same session. */
export async function savePlan(plan: Plan, profile: Demo["profile"], replaceInSession = true): Promise<Result> {
  const client = db();
  if (replaceInSession) {
    const { error } = await client.from("study_plans").delete().eq("session_id", plan.sessionId).neq("id", plan.id);
    if (error) return fail(error);
  }
  // Plain insert, never upsert: the client may only UPDATE (plan, updated_at), and an upsert needs
  // UPDATE rights on every column it sends, so it fails with 42501. A plan that changes later goes
  // through updatePlanSteps.
  const { error } = await client.from("study_plans").insert({
    id: plan.id,
    session_id: plan.sessionId,
    subject: plan.subject,
    deadline_at: plan.deadline,
    mode: plan.mode,
    hours_available: Math.max(0.5, Math.round(plan.hours * 10) / 10),
    language: profile.language,
    style: profile.style,
    formats: profile.formats,
    plan: { steps: plan.steps },
    cache_key: `${plan.subject}|${plan.mode}|${plan.deadline.slice(0, 13)}`,
  });
  return fail(error);
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
