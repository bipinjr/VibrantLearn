import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/AppShell";
import { getDemo } from "@/lib/demo/data";
import { DEMO_COOKIE, demoEnabled } from "@/lib/demo/mode";
import { DemoProvider } from "@/lib/demo/store";
import { getUserId } from "@/lib/supabase/server";

export const metadata: Metadata = { title: { default: "Home", template: "%s | VibrantLearn" } };

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const demo = demoEnabled() && (await cookies()).get(DEMO_COOKIE)?.value === "1";
  if (!demo && !(await getUserId())) redirect("/login?next=/app");

  // ponytail: every signed-in view runs on the demo data store until M3 wires Supabase reads.
  return (
    <DemoProvider seed={getDemo()}>
      <AppShell>{children}</AppShell>
    </DemoProvider>
  );
}
