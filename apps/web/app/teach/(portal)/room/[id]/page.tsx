"use client";

import { use } from "react";
import { ClassRoom } from "@/components/classes/ClassRoom";

export default function TeacherRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ClassRoom id={id} backHref="/teach" />;
}
