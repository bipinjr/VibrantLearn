import type { CSSProperties } from "react";
import type { PlanStep } from "@/lib/demo/data";
import { useT } from "@/lib/i18n/context";

/** Horizontal miniature of a plan: the route line with nodes, drawing itself on first paint. */
export function MiniPath({ steps }: { steps: PlanStep[] }) {
  const next = steps.findIndex((s) => !s.done && s.kind !== "exam");
  const shown = steps.slice(0, 12);
  const done = steps.filter((s) => s.done).length;
  const t = useT();
  return (
    <div className="relative h-5" aria-label={t("{done} of {total} steps done", { done, total: steps.length - 1 })} role="img">
      <span className="mini-route absolute inset-x-1 top-1/2 h-[3px] rounded-full" />
      <ol className="relative flex h-full items-center justify-between">
        {shown.map((s, i) => {
          const state = s.done ? "done" : i === next ? "now" : s.kind === "exam" ? "exam" : "todo";
          return (
            <li
              key={s.id}
              className={`mini-node ${s.kind === "checkpoint" ? "rotate-45 rounded-[3px]" : "rounded-full"}`}
              data-state={state}
              style={{ "--i": i } as CSSProperties}
              title={s.title}
            />
          );
        })}
      </ol>
    </div>
  );
}
