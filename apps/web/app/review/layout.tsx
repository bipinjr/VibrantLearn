import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/brand/Wordmark";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { UiLangProvider } from "@/lib/i18n/context";
import { getUserId } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Teacher review", robots: { index: false } };

/** For the VibrantLearn team only. The API decides who is a reviewer (internal.reviewers). */
export default async function ReviewLayout({ children }: LayoutProps<"/review">) {
  if (!(await getUserId())) redirect("/login?next=/review");
  return (
    <UiLangProvider initial="en">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[70] focus:rounded-md focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>
      
      <header className="flex items-center justify-between gap-4 border-b border-line px-4 py-3 sm:px-8">
        <span className="flex items-center gap-3">
          <Wordmark height={22} href={null} />
          <span className="rounded-full bg-ember/15 px-2.5 py-0.5 text-sm font-medium">Team</span>
        </span>
        <ThemeToggle />
      </header>
      {children}
    </UiLangProvider>
  );
}
