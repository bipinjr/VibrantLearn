import type { Metadata } from "next";
import { SessionView } from "./SessionView";

export const metadata: Metadata = { title: "Study session" };

export default async function SessionPage({ params }: PageProps<"/app/s/[id]">) {
  const { id } = await params;
  return <SessionView id={id} />;
}
