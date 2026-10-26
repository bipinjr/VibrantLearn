import type { Metadata } from "next";
import { demoAccount } from "@/lib/demo/accounts";
import { demoEnabled, emailAuthEnabled } from "@/lib/demo/mode";
import { AuthForm } from "../AuthForm";

export const metadata: Metadata = { title: "Sign in" };

const NOTICES: Record<string, string> = {
  link: "That link has expired or was already used. Sign in, or create the account again to get a new link.",
  google: "Google sign-in didn't finish. Try again, or use your email.",
  demo: "The demo account isn't available right now. Try again in a minute, or use your own account.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  const notice = typeof sp.error === "string" ? NOTICES[sp.error] : undefined;
  return (
    <AuthForm mode="signin" next={next} notice={notice} googleEnabled={process.env.GOOGLE_AUTH_ENABLED === "true"}
      demo={demoEnabled()}
      demoAccount={demoAccount("student") !== null}
      emailEnabled={emailAuthEnabled()} />
  );
}
