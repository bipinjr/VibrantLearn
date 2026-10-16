import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/AppShell";
import { loadAccount } from "@/lib/account/load";
import { teacherStatus } from "@/lib/account/role";
import { getDemo } from "@/lib/demo/data";
import { DEMO_COOKIE, demoEnabled } from "@/lib/demo/mode";
import { DemoProvider } from "@/lib/demo/store";
import { UiLangProvider } from "@/lib/i18n/context";
import { isLang, UI_LANG_COOKIE } from "@/lib/i18n/ui";
import { getUserId } from "@/lib/supabase/server";

export const metadata: Metadata = { title: { default: "Home", template: "%s | VibrantLearn" } };

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const jar = await cookies();
  const saved = jar.get(UI_LANG_COOKIE)?.value;
  const uiLang = isLang(saved) ? saved : "en";

  // A real signed-in account always wins over the demo cookie.
  const userId = await getUserId();
  if (userId) {
    if (await teacherStatus(userId)) redirect("/teacher"); // teachers use the teacher portal
    const data = await loadAccount(userId);
    if (!data) redirect("/onboarding");
    return (
      <UiLangProvider initial={uiLang}>
        <DemoProvider seed={data} account={{ userId }}>
          <AppShell>{children}</AppShell>
        </DemoProvider>
      </UiLangProvider>
    );
  }

  const demo = demoEnabled() && jar.get(DEMO_COOKIE)?.value === "1";
  if (!demo) redirect("/login?next=/app");
  return (
    <UiLangProvider initial={uiLang}>
      <DemoProvider seed={getDemo()}>
        <AppShell>{children}</AppShell>
      </DemoProvider>
    </UiLangProvider>
  );
}
