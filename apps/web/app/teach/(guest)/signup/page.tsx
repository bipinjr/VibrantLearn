import type { Metadata } from "next";
import { emailAuthEnabled } from "@/lib/demo/mode";
import { AuthForm } from "@/app/(auth)/AuthForm";

export const metadata: Metadata = { title: "Create a teacher account" };

export default function TeacherSignupPage() {
  return <AuthForm mode="signup" teacher next="/teach" googleEnabled={process.env.GOOGLE_AUTH_ENABLED === "true"} demo={false} emailEnabled={emailAuthEnabled()} />;
}
