import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { emailAuthEnabled } from "@/lib/demo/mode";
import { ForgotForm } from "../ResetForms";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  if (!emailAuthEnabled()) redirect("/login");
  return <ForgotForm />;
}
