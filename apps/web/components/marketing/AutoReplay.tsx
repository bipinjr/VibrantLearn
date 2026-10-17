"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Plays its children's CSS animation, holds the finished state, then plays it again.
 * Only loops while on screen; with reduced motion it renders the finished state once. */
export function AutoReplay({ children, cycleMs }: { children: ReactNode; cycleMs: number }) {
  const [run, setRun] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timer = 0;
    let visible = true;
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
    });
    if (box.current) io.observe(box.current);
    const tick = () => {
      if (visible && document.visibilityState === "visible") setRun((n) => n + 1);
      timer = window.setTimeout(tick, cycleMs);
    };
    timer = window.setTimeout(tick, cycleMs);
    return () => {
      window.clearTimeout(timer);
      io.disconnect();
    };
  }, [cycleMs]);
  return (
    <div ref={box}>
      <div key={run}>{children}</div>
    </div>
  );
}
