import type { ReactNode } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { EveningDial } from "./EveningDial";
import styles from "./auth-shell.module.css";

// Fixed positions (no randomness in render): x %, y %, delay s.
const STARS: [number, number, number][] = [
  [8, 12, 0], [22, 30, 1.2], [36, 8, 2.4], [52, 18, 0.6], [70, 10, 3.1], [86, 26, 1.8], [92, 48, 0.3],
  [78, 62, 2.7], [64, 84, 1.1], [44, 92, 3.6], [24, 78, 0.9], [10, 64, 2.2], [16, 44, 3.3], [58, 40, 1.5],
  [32, 56, 2.9], [88, 82, 0.4], [48, 70, 3.9], [6, 90, 1.7],
];

const HEAD = {
  student: "Your evening, planned to the minute.",
  teacher: "Your evening class, filled before it starts.",
} as const;

/** Sign-in and sign-up frame: the form on the left, the living evening dial on the right. */
export function AuthShell({ children, variant }: { children: ReactNode; variant: "student" | "teacher" }) {
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[70] focus:rounded-md focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>
      <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col px-4 py-6 sm:px-10">
          <div className="flex items-center justify-between gap-3">
            <Wordmark height={24} />
            <ThemeToggle />
          </div>
          <main id="main" className={`${styles.form} mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12`}>
            {children}
          </main>
        </div>
        <aside className="sticky top-0 hidden h-dvh flex-col items-center justify-center overflow-hidden bg-ink px-10 text-mist lg:flex" data-theme="dark">
          <span aria-hidden="true" className={`${styles.glow} ${styles.glowA}`} />
          <span aria-hidden="true" className={`${styles.glow} ${styles.glowB}`} />
          <span aria-hidden="true" className={styles.stars}>
            {STARS.map(([x, y, d], i) => (
              <span key={i} style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${d}s` }} />
            ))}
          </span>
          <div className="relative w-full max-w-sm">
            <p className="mb-6 text-center font-display text-[clamp(1.6rem,2.6vw,2.2rem)] leading-[1.1] font-bold">{HEAD[variant]}</p>
            <EveningDial variant={variant} />
          </div>
        </aside>
      </div>
    </>
  );
}
