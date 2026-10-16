import type { Metadata } from "next";
import { emailAuthEnabled } from "@/lib/demo/mode";
import { AuthForm } from "../AuthForm";

export const metadata: Metadata = { title: "Create a teacher account" };

export default function TeacherSignupPage() {
  return <AuthForm mode="signup" teacher next="/teacher" googleEnabled={false} demo={false} emailEnabled={emailAuthEnabled()} />;
}
