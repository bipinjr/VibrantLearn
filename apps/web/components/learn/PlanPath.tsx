import { Check } from "lucide-react";
import type { CSSProperties } from "react";
import styles from "./plan-path.module.css";

export type PathStep =
  | { kind: "block"; time: string; title: string; minutes: number; state?: "now" | "done" }
  | { kind: "checkpoint"; time: string; title: string; state?: "done" }
  | { kind: "exam"; time: string; title: string };

/**
 * The route line with checkpoint nodes: the product's one visual motif, and the only place the
 * Ember -> Orchid -> Violet gradient is allowed. Static markup; an ancestor with
 * data-play="true" animates it (see plan-path.module.css).
 */
export function PlanPath({ steps, label, compact = false }: { steps: PathStep[]; label: string; compact?: boolean }) {
  return (
    <div className={styles.wrap} data-compact={compact || undefined}>
      <span className={styles.route} aria-hidden="true" />
      <ol className={styles.path} aria-label={label}>
        {steps.map((s, i) => {
          const state = "state" in s ? s.state : undefined;
          return (
            <li
              key={`${s.time}-${s.title}`}
              className={styles.step}
              data-kind={s.kind}
              data-state={state}
              style={{ "--i": i } as CSSProperties}
            >
              <span className={styles.node} aria-hidden="true">
                {state === "done" ? <Check size={12} strokeWidth={3} /> : null}
              </span>
              <span className={styles.time}>
                {s.time}
                {state === "now" ? <span className={styles.now}>Now</span> : null}
                {state === "done" ? <span className="sr-only"> (done)</span> : null}
              </span>
              <span className={styles.title}>
                {s.kind === "checkpoint" ? "Checkpoint: " : null}
                {s.title}
              </span>
              {s.kind === "block" ? <span className={styles.minutes}>{s.minutes} min</span> : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
