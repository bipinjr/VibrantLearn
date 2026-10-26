"use client";

import { use } from "react";
import { PageTransition } from "@/components/app/Page";
import { ClassRoom } from "@/components/classes/ClassRoom";
import { useDemo } from "@/lib/demo/store";
import { useUi } from "@/lib/i18n/context";

export default function StudentClassRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { mode } = useDemo();
  const { t } = useUi();
  if (mode !== "account") {
    return <p className="m-auto p-8 text-center text-muted">{t("Live classes need a real account.")}</p>;
  }
  return (
    <PageTransition>
      <ClassRoom id={id} backHref="/app/classes" />
    </PageTransition>
  );
}
