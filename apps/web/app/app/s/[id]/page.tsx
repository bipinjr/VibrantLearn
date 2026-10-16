import type { Metadata } from "next";
import { loadThread } from "@/lib/account/load";
import { getUserId } from "@/lib/supabase/server";
import { SessionView } from "./SessionView";

export const metadata: Metadata = { title: "Study session" };

export default async function SessionPage({ params }: PageProps<"/app/s/[id]">) {
  const { id } = await params;
  // Signed in: the thread is in the server HTML, so a refresh shows it at once (no empty flash).
  // RLS returns nothing for someone else's session id.
  const initial = (await getUserId()) ? await loadThread(id) : undefined;
  return <SessionView id={id} initial={initial} />;
}
