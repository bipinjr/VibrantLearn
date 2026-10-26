"use client";

import { CalendarDays, House, Settings, UserRound, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { PageTransition } from "@/components/app/Page";
import { Application, Questionnaire } from "./parts";
import { TeachProvider, useTeach } from "./data";

const NAV = [
  { href: "/teach", label: "Home", icon: House },
  { href: "/teach/rooms", label: "Rooms", icon: CalendarDays },
  { href: "/teach/earnings", label: "Earnings", icon: Wallet },
  { href: "/teach/profile", label: "Profile", icon: UserRound },
  { href: "/teach/settings", label: "Settings", icon: Settings },
] as const;

function Nav() {
  const path = usePathname();
  return (
    <nav aria-label="Teacher" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur lg:static lg:border-t-0 lg:bg-transparent">
      <ul className="mx-auto flex max-w-md justify-around lg:max-w-none lg:flex-col lg:gap-1 lg:p-4">
        {NAV.map(({ href, label, icon: Icon }) => {
          const on = href === "/teach" ? path === "/teach" : path.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={on ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 px-3 py-2 text-xs font-medium no-underline lg:flex-row lg:gap-3 lg:rounded-[var(--radius-input)] lg:text-base ${
                  on ? "text-text lg:bg-text/[0.06]" : "text-muted hover:text-text"
                }`}
              >
                <Icon size={20} strokeWidth={on ? 2.25 : 1.75} aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Until a teacher is approved, every page shows where they are in the process and what's left. */
function Gate({ children }: { children: ReactNode }) {
  const { loaded, problem, teacher, payout, documents, promise, reload } = useTeach();
  if (!loaded) return <p role="status" className="p-8 text-muted">Loading…</p>;
  if (problem) return <p role="alert" className="m-6 max-w-xl rounded-[var(--radius-input)] bg-rose/10 px-4 py-3">{problem}</p>;
  if (!teacher) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-8">
        <h1 className="font-display text-4xl font-bold">Set up your teacher profile</h1>
        <p className="mt-2 max-w-xl text-muted">A few questions so students know who&rsquo;s teaching, what and when. Takes two minutes.</p>
        <Questionnaire teacher={null} onDone={reload} />
      </div>
    );
  }
  if (teacher.status === "suspended") {
    return <p className="m-8 max-w-xl">Your teaching account is suspended after 3 warnings. Write to us if you think this is wrong.</p>;
  }
  if (teacher.status !== "verified") {
    const ready = documents.some((d) => d.kind === "degree") && payout;
    return (
      <div className="mx-auto grid max-w-4xl gap-6 px-4 py-10 sm:px-8">
        <div role="status" className={`rounded-[var(--radius-sheet)] p-6 ${teacher.status === "rejected" ? "bg-rose/10" : "bg-violet/10"}`}>
          <h1 className="font-display text-3xl font-bold">
            {teacher.status === "rejected" ? "Not approved yet" : ready ? promise : "Two steps left"}
          </h1>
          <p className="mt-2 max-w-2xl">
            {teacher.status === "rejected"
              ? `${teacher.review_note ?? ""} Fix it below, then save your profile again to send it back.`
              : ready
                ? "You'll be able to create rooms as soon as you're approved. We'll show it here."
                : "Upload your degree certificate and add where we pay you. Then the team reviews your application."}
          </p>
        </div>
        <Application teacher={teacher} payout={payout} onDone={reload} />
        {teacher.status === "rejected" ? <Questionnaire teacher={teacher} onDone={reload} /> : null}
      </div>
    );
  }
  return <>{children}</>;
}

export function TeachShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const inRoom = path.startsWith("/teach/room/");
  return (
    <TeachProvider>
      {inRoom ? (
        children
      ) : (
        <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)]">
          <Nav />
          <main id="main" className="min-w-0 pb-24 lg:pb-12">
            <PageTransition key={path}>
              <div>
                <Gate>{children}</Gate>
              </div>
            </PageTransition>
          </main>
        </div>
      )}
    </TeachProvider>
  );
}
