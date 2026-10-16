import "server-only";
import type { Demo, Message, Plan, Session, StudyFile } from "@/lib/demo/data";
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

  // Threads are NOT loaded here: each session page loads its own (loadThread), so the layout
  // stays small however much a student has chatted.
  const [sessionsRes, servedRes, plansRes, filesRes] = await Promise.all([
    supabase.from("study_sessions").select("id, title, subject, deadline_at, mode, updated_at").order("updated_at", { ascending: false }).limit(100),
    supabase.from("messages").select("served_from").eq("role", "assistant").order("created_at", { ascending: false }).limit(500),
    supabase.from("study_plans").select("id, session_id, subject, deadline_at, mode, hours_available, plan").order("created_at"),
    supabase.from("files").select("id, session_id, display_name, size_bytes, pages, status, error, created_at").order("created_at", { ascending: false }).limit(500),
  ]);

  const sessions: Session[] = ((sessionsRes.data ?? []) as Row[]).map((s) => ({
    id: str(s.id),
    title: str(s.title, "New study session"),
    subject: str(s.subject),
    deadline: str(s.deadline_at),
    mode: (str(s.mode, "crash") as Session["mode"]),
    updated: str(s.updated_at),
  }));


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

  const served = ((servedRes.data ?? []) as Row[]).map((r) => r.served_from);
  const files: StudyFile[] = ((filesRes.data ?? []) as Row[]).map((f) => ({
    id: str(f.id),
    sessionId: str(f.session_id),
    name: str(f.display_name),
    sizeBytes: Number(f.size_bytes ?? 0),
    pages: typeof f.pages === "number" ? f.pages : undefined,
    status: (["uploaded", "scanning"].includes(str(f.status)) ? "scanning" : str(f.status, "failed")) as StudyFile["status"],
    error: str(f.error) || undefined,
    added: str(f.created_at),
  }));
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
    files,
    messages: {},
    usage: {
      messages: { used: 0, limit: 30, window: "10 minutes" },
      plans: { used: 0, limit: 10, window: "hour" },
      uploads: { used: 0, limit: 20, window: "day" },
      storageMb: { used: 0, limit: 300, window: "day" },
      servedLocally: served.length ? served.filter((s) => s !== "llm").length / served.length : 0,
    },
  };
}

/** One session's thread for its page's first paint: the newest 500 messages, oldest first. */
export async function loadThread(sessionId: string): Promise<Message[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("messages")
    .select("id, role, content, blocks, served_from, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(500);
  return ((data ?? []) as Row[]).reverse().map((m) => ({
    id: str(m.id),
    role: m.role === "assistant" ? "assistant" : "user",
    content: str(m.content) || undefined,
    blocks: Array.isArray(m.blocks) && m.blocks.length ? (m.blocks as Message["blocks"]) : undefined,
    servedFrom: (m.served_from as Message["servedFrom"]) ?? undefined,
    at: str(m.created_at),
  }));
}
