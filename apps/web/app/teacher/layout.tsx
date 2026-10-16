import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/brand/Wordmark";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { UiLangProvider } from "@/lib/i18n/context";
import { isLang, UI_LANG_COOKIE } from "@/lib/i18n/ui";
import { getUserId } from "@/lib/supabase/server";

export const metadata: Metadata = { title: { default: "Teacher", template: "%s | VibrantLearn" } };

/** The teacher portal: live classes only. Students never see it; teachers never see the study app. */
export default async function TeacherLayout({ children }: LayoutProps<"/teacher">) {
  const userId = await getUserId();
  if (!userId) redirect("/teacher-login?next=/teacher");
  const saved = (await cookies()).get(UI_LANG_COOKIE)?.value;
  return (
    <UiLangProvider initial={isLang(saved) ? saved : "en"}>
      <div className="min-h-dvh">
        <header className="flex items-center justify-between gap-4 border-b border-line px-4 py-3 sm:px-8">
          <Link href="/teacher" className="flex items-center gap-3 no-underline" aria-label="Teacher portal home">
            <Wordmark height={22} href={null} />
            <span className="rounded-full bg-violet/10 px-2.5 py-0.5 text-sm font-medium text-violet">Teacher</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <form action="/auth/signout" method="post">
              <button type="submit" className="btn btn-secondary">Sign out</button>
            </form>
          </div>
        </header>
        {children}
      </div>
    </UiLangProvider>
  );
}
