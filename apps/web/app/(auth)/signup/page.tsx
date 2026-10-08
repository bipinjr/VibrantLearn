import type { Metadata } from "next";
import { demoEnabled, emailAuthEnabled } from "@/lib/demo/mode";
import { AuthForm } from "../AuthForm";

export const metadata: Metadata = { title: "Create your account" };

export default function SignupPage() {
  return <AuthForm mode="signup" googleEnabled={process.env.GOOGLE_AUTH_ENABLED === "true"}
      demo={demoEnabled()}
      emailEnabled={emailAuthEnabled()} />;
}
