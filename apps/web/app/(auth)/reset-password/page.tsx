import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUserId } from "@/lib/supabase/server";
import { NewPasswordForm } from "../ResetForms";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  // Only reachable through the emailed link, which signs the student in first.
  if (!(await getUserId())) redirect("/login?error=link");
  return <NewPasswordForm />;
}
