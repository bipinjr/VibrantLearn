"use client";

import { RotateCcw } from "lucide-react";
import { useState, type ReactNode } from "react";

/** Remounts its children so their CSS animations run again. */
export function ReplayButton({ children, className }: { children: ReactNode; className?: string }) {
  const [run, setRun] = useState(0);
  return (
    <>
      <div key={run}>{children}</div>
      <button type="button" className={className} onClick={() => setRun((n) => n + 1)}>
        <RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" />
        Replay
      </button>
    </>
  );
}
