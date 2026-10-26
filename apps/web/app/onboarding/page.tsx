import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageTransition } from "@/components/app/Page";
import { createClient } from "@/lib/supabase/server";
import { Onboarding, type ProfileDraft } from "./Onboarding";

export const metadata: Metadata = { title: "Set up your profile" };

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) redirect("/login?next=/onboarding");

  // RLS limits this to the user's own row.
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, university, course, semester, scheme, language, style, formats, onboarded_at")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.onboarded_at) redirect("/app");

  const draft: ProfileDraft = {
    username: profile?.username ?? "",
    university: profile?.university ?? "Bengaluru City University",
    course: profile?.course ?? "BCA",
    semester: profile?.semester ?? 3,
    scheme: profile?.scheme ?? "SEP",
    language: profile?.language ?? "en",
    style: profile?.style ?? "short",
    formats: profile?.formats ?? ["quiz", "notes"],
  };
  return (
    <PageTransition>
      <Onboarding initial={draft} startAt={profile?.username ? 2 : 1} />
    </PageTransition>
  );
}
