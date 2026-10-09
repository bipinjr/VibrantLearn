import { Flag } from "lucide-react";
import { useState, type CSSProperties } from "react";
import type { Plan } from "@/lib/demo/data";
import { dayLabel, timeRange } from "@/lib/format";
import { useUi } from "@/lib/i18n/context";
import styles from "./plan-timeline.module.css";

const BURST = Array.from({ length: 10 }, (_, k) => {
  const a = (k / 10) * Math.PI * 2;
  const d = 26 + (k % 3) * 8;
  return { x: `${Math.round(Math.cos(a) * d)}px`, y: `${Math.round(Math.sin(a) * d)}px`, c: ["var(--color-leaf)", "var(--color-ember)", "var(--color-violet)"][k % 3], r: `${(k * 47) % 180}deg` };
});

export function PlanTimeline({ plan, nowIso, onToggle, limit }: { plan: Plan; nowIso: string; onToggle: (stepId: string) => void; limit?: number }) {
  const [bursts, setBursts] = useState<Record<string, number>>({});
  const { t, lang } = useUi();
  const nextIdx = plan.steps.findIndex((s) => !s.done && s.kind !== "exam");
  const steps = limit ? plan.steps.slice(Math.max(0, nextIdx - 1), Math.max(0, nextIdx - 1) + limit) : plan.steps;

  const days = steps.map((s) => dayLabel(s.start, nowIso, lang));
  return (
    <div className={styles.wrap}>
      <span className={styles.route} aria-hidden="true" />
      <ol className={styles.list}>
        {steps.map((s, i) => {
          const idx = plan.steps.indexOf(s);
          const header = !limit && (i === 0 || days[i] !== days[i - 1]) ? days[i] : null;
          const state = s.done ? "done" : idx === nextIdx ? "now" : "todo";
          return (
            <li key={s.id} className={styles.item} style={{ "--i": i } as CSSProperties}>
              {header ? <p className={styles.day}>{header}</p> : null}
              <div className={styles.row} data-kind={s.kind} data-state={state} data-burst={bursts[s.id] ?? 0}>
                {s.kind === "exam" ? (
                  <span className={styles.examNode} aria-hidden="true">
                    <Flag size={13} strokeWidth={2.5} />
                  </span>
                ) : (
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={s.done}
                    aria-label={`${t(s.done ? "Mark not done" : "Mark done")}: ${s.title}`}
                    className={styles.node}
                    onClick={() => {
                      if (!s.done) setBursts((b) => ({ ...b, [s.id]: (b[s.id] ?? 0) + 1 }));
                      onToggle(s.id);
                    }}
                  >
                    <svg viewBox="0 0 16 16" aria-hidden="true" className={styles.tick}>
                      <path d="M3.5 8.5l3 3 6-7" pathLength={1} />
                    </svg>
                    {bursts[s.id] && s.done ? (
                      <span key={bursts[s.id]} className="burst" aria-hidden="true">
                        {BURST.map((b, k) => (
                          <i key={k} style={{ "--x": b.x, "--y": b.y, "--c": b.c, "--r": b.r } as CSSProperties} />
                        ))}
                      </span>
                    ) : null}
                  </button>
                )}
                <div className="min-w-0">
                  <p className={styles.time}>
                    {timeRange(s.start, s.end)}
                    {state === "now" ? <span className={styles.nowPill}>{t("Now")}</span> : null}
                  </p>
                  <p className={styles.title}>
                    {s.kind === "checkpoint" ? <span className={styles.kind}>{t("Checkpoint")} </span> : null}
                    {s.title}
                  </p>
                  {s.unit ? <p className={styles.meta}>{s.unit}</p> : null}
                </div>
                {s.minutes ? <span className={styles.minutes}>{s.minutes >= 120 ? t("{h} h", { h: Math.round(s.minutes / 60) }) : t("{m} min", { m: s.minutes })}</span> : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
