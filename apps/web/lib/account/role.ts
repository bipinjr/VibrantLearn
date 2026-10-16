import { createClient } from "@/lib/supabase/server";

export type TeacherStatus = "pending" | "verified" | "suspended";

/** A teacher account is one with a row in public.teachers (written only by the API). RLS lets a
 * user read their own row. This picks the portal; every teaching action is still checked by the API. */
export async function teacherStatus(userId: string): Promise<TeacherStatus | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("teachers").select("status").eq("user_id", userId).maybeSingle();
  const s = (data as { status?: string } | null)?.status;
  return s === "pending" || s === "verified" || s === "suspended" ? s : null;
}
