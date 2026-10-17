"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { use } from "react";
import { Main } from "@/components/app/Page";
import { PublicCard } from "@/components/teach/PublicCard";

/** T8, student side: a teacher's public profile, opened from a class. */
export default function TeacherProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Main>
      <title>Teacher | VibrantLearn</title>
      <Link href="/app/classes" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted no-underline hover:text-text">
        <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" /> Live classes
      </Link>
      <h1 className="sr-only">Teacher profile</h1>
      <PublicCard teacherId={id} />
    </Main>
  );
}
