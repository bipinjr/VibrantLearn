import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/AppShell";
import { loadAccount } from "@/lib/account/load";
import { getDemo } from "@/lib/demo/data";
import { DEMO_COOKIE, demoEnabled } from "@/lib/demo/mode";
import { DemoProvider } from "@/lib/demo/store";
import { UiLangProvider } from "@/lib/i18n/context";
import { isLang, UI_LANG_COOKIE } from "@/lib/i18n/ui";
import { createClient, getUserId } from "@/lib/supabase/server";

export const metadata: Metadata = { title: { default: "Home", template: "%s | VibrantLearn" } };

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const jar = await cookies();
  const saved = jar.get(UI_LANG_COOKIE)?.value;
  const uiLang = isLang(saved) ? saved : "en";

  // A real signed-in account always wins over the demo cookie.
  const userId = await getUserId();
  if (userId) {
    const data = await loadAccount(userId);
    if (!data) {
      // A teacher with no study profile came in through the wrong door: send them to their portal.
      // (They can still set up the study app later from /onboarding; one account can be both.)
      const supabase = await createClient();
      const { data: t } = await supabase.from("teachers").select("user_id").eq("user_id", userId).maybeSingle();
      redirect(t ? "/teach" : "/onboarding");
    }
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
