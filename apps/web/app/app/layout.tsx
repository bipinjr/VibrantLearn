import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/AppShell";
import { loadAccount } from "@/lib/account/load";
import { getDemo } from "@/lib/demo/data";
import { DEMO_COOKIE, demoEnabled } from "@/lib/demo/mode";
import { DemoProvider } from "@/lib/demo/store";
import { getUserId } from "@/lib/supabase/server";

export const metadata: Metadata = { title: { default: "Home", template: "%s | VibrantLearn" } };

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  // A real signed-in account always wins over the demo cookie.
  const userId = await getUserId();
  if (userId) {
    const data = await loadAccount(userId);
    if (!data) redirect("/onboarding");
    return (
      <DemoProvider seed={data} account={{ userId }}>
        <AppShell>{children}</AppShell>
      </DemoProvider>
    );
  }

  const demo = demoEnabled() && (await cookies()).get(DEMO_COOKIE)?.value === "1";
  if (!demo) redirect("/login?next=/app");
  return (
    <DemoProvider seed={getDemo()}>
      <AppShell>{children}</AppShell>
    </DemoProvider>
  );
}
