import "server-only";

export type DemoRole = "student" | "teacher";

/** Shared demo accounts. Credentials live only in server env (never in the repo or the page). */
export function demoAccount(role: DemoRole): { email: string; password: string } | null {
  const email = process.env[role === "teacher" ? "DEMO_TEACHER_EMAIL" : "DEMO_STUDENT_EMAIL"];
  const password = process.env[role === "teacher" ? "DEMO_TEACHER_PASSWORD" : "DEMO_STUDENT_PASSWORD"];
  return email && password ? { email, password } : null;
}

/** Anyone can sign in to a demo account, so its password must not be changeable. */
export function isDemoEmail(email: unknown): boolean {
  if (typeof email !== "string") return false;
  const e = email.toLowerCase();
  return (["student", "teacher"] as const).some((r) => demoAccount(r)?.email.toLowerCase() === e);
}
