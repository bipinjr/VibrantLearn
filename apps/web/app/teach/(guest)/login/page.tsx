import type { Metadata } from "next";
import { emailAuthEnabled } from "@/lib/demo/mode";
import { AuthForm } from "@/app/(auth)/AuthForm";

export const metadata: Metadata = { title: "Teacher sign in" };

export default async function TeacherLoginPage({ searchParams }: PageProps<"/teach/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/teach") ? sp.next : "/teach";
  const notice =
    sp.error === "link"
      ? "That confirmation link has expired or was opened in a different browser. Sign in here, or create the account again for a new link."
      : undefined;
  return <AuthForm mode="signin" teacher next={next} notice={notice} googleEnabled={false} demo={false} emailEnabled={emailAuthEnabled()} />;
}
