import type { ReactNode } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { EveningDial } from "./EveningDial";

const HEAD = {
  student: "Your evening, planned to the minute.",
  teacher: "Your evening class, filled before it starts.",
} as const;

/** Sign-in and sign-up frame: the form on the left, the evening dial on the right. */
export function AuthShell({ children, variant }: { children: ReactNode; variant: "student" | "teacher" }) {
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[70] focus:rounded-md focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>
      <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="flex flex-col px-4 py-6 sm:px-10">
          <div className="flex items-center justify-between gap-3">
            <Wordmark height={24} />
            <ThemeToggle />
          </div>
          <main id="main" className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
            {children}
          </main>
        </div>
        <aside className="relative hidden flex-col justify-center overflow-hidden bg-ink px-12 py-16 text-mist lg:flex" data-theme="dark">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-40 -right-40 size-[520px] rounded-full bg-[radial-gradient(circle,rgb(106_59_228/0.35),transparent_65%)]"
          />
          <div className="relative mx-auto w-full max-w-md">
            <p className="mb-8 font-display text-4xl leading-[1.05] font-bold">{HEAD[variant]}</p>
            <EveningDial variant={variant} />
          </div>
        </aside>
      </div>
    </>
  );
}
