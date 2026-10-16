import type { Metadata } from "next";
import { emailAuthEnabled } from "@/lib/demo/mode";
import { AuthForm } from "../AuthForm";

export const metadata: Metadata = { title: "Teacher sign in" };

export default async function TeacherLoginPage({ searchParams }: PageProps<"/teacher-login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/teacher") ? sp.next : "/teacher";
  return <AuthForm mode="signin" teacher next={next} googleEnabled={false} demo={false} emailEnabled={emailAuthEnabled()} />;
}
