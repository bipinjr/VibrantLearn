import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { emailAuthEnabled } from "@/lib/demo/mode";
import { ForgotForm } from "../ResetForms";

export const metadata: Metadata = { title: "Reset your password" };

const NOTICES: Record<string, string> = {
  expired:
    "That reset link has expired or was already used. Each new email cancels the earlier ones, so ask for a new link below and open only the newest email, in this browser.",
};

export default async function ForgotPasswordPage({ searchParams }: PageProps<"/forgot-password">) {
  if (!emailAuthEnabled()) redirect("/login");
  const sp = await searchParams;
  return <ForgotForm notice={typeof sp.error === "string" ? NOTICES[sp.error] : undefined} />;
}
