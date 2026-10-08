import "server-only";
import type { Demo, Message, Plan, Session } from "@/lib/demo/data";
import { createClient } from "@/lib/supabase/server";

type Row = Record<string, unknown>;
const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);

/**
 * Loads a signed-in student's data (RLS limits every query to their own rows) into the same shape
 * the demo store uses, so every screen works unchanged. Returns null until onboarding is done.
 */
export async function loadAccount(userId: string): Promise<Demo | null> {
  const supabase = await createClient();
  const { data: p } = await supabase
    .from("profiles")
    .select("username, full_name, university, course, semester, scheme, language, style, formats, onboarded_at")
    .eq("id", userId)
    .maybeSingle();
  if (!p?.username) return null;

  const [sessionsRes, messagesRes, plansRes] = await Promise.all([
    supabase.from("study_sessions").select("id, title, subject, deadline_at, mode, updated_at").order("updated_at", { ascending: false }).limit(100),
    supabase.from("messages").select("id, session_id, role, content, blocks, served_from, created_at").order("created_at").limit(2000),
    supabase.from("study_plans").select("id, session_id, subject, deadline_at, mode, hours_available, plan").order("created_at"),
  ]);

  const sessions: Session[] = ((sessionsRes.data ?? []) as Row[]).map((s) => ({
    id: str(s.id),
    title: str(s.title, "New study session"),
    subject: str(s.subject),
    deadline: str(s.deadline_at),
    mode: (str(s.mode, "crash") as Session["mode"]),
    updated: str(s.updated_at),
  }));

  const messages: Record<string, Message[]> = Object.fromEntries(sessions.map((s) => [s.id, [] as Message[]]));
  for (const m of (messagesRes.data ?? []) as Row[]) {
    const sid = str(m.session_id);
    (messages[sid] ??= []).push({
      id: str(m.id),
      role: m.role === "assistant" ? "assistant" : "user",
      content: str(m.content) || undefined,
      blocks: Array.isArray(m.blocks) && m.blocks.length ? (m.blocks as Message["blocks"]) : undefined,
      servedFrom: (m.served_from as Message["servedFrom"]) ?? undefined,
      at: str(m.created_at),
    });
  }

  const plans: Plan[] = ((plansRes.data ?? []) as Row[]).map((r) => {
    const body = (r.plan ?? {}) as { steps?: Plan["steps"] };
    return {
      id: str(r.id),
      sessionId: str(r.session_id),
      subject: str(r.subject),
      deadline: str(r.deadline_at),
      mode: str(r.mode, "crash") as Plan["mode"],
      hours: Number(r.hours_available ?? 3),
      steps: Array.isArray(body.steps) ? body.steps : [],
    };
  });

  const replies = Object.values(messages).flat().filter((m) => m.role === "assistant");
  return {
    now: new Date().toISOString(),
    profile: {
      username: str(p.username),
      fullName: str(p.full_name),
      university: str(p.university, "Bengaluru City University"),
      course: str(p.course, "BCA"),
      semester: Number(p.semester ?? 1),
      scheme: str(p.scheme, "SEP"),
      language: (str(p.language, "en") as Demo["profile"]["language"]),
      style: (str(p.style, "short") as "short" | "detailed"),
      formats: Array.isArray(p.formats) ? (p.formats as string[]) : [],
    },
    sessions,
    plans,
    files: [],
    messages,
    usage: {
      messages: { used: 0, limit: 30, window: "10 minutes" },
      plans: { used: 0, limit: 10, window: "hour" },
      uploads: { used: 0, limit: 20, window: "day" },
      storageMb: { used: 0, limit: 300, window: "day" },
      servedLocally: replies.length ? replies.filter((m) => m.servedFrom !== "llm").length / replies.length : 0,
    },
  };
}
