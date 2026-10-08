import type { Metadata } from "next";
import { PlanView } from "./PlanView";

export const metadata: Metadata = { title: "Plan" };

export default async function PlanPage({ params }: PageProps<"/app/plans/[id]">) {
  const { id } = await params;
  return <PlanView id={id} />;
}
