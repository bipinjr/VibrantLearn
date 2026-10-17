"use client";

import { useEffect, useState } from "react";
import styles from "./evening-dial.module.css";

/** The evening as a clock face, 5 PM to 11 PM: the learning path bent into a dial. It plays through
 * the evening block by block: the hand moves, the active block glows, the centre tells the story. */

type Arc = { from: number; to: number; title: string; time: string; kind: "done" | "now" | "next"; center: [string, string] };
type Variant = "student" | "teacher";

const START = 17;
const HOURS = 6;
const C = 200;
const R = 150;

function point(hour: number, r = R): [number, number] {
  const a = ((hour - START) / HOURS) * 2 * Math.PI - Math.PI / 2;
  // Rounded so the server and the browser print identical numbers (no hydration mismatch).
  return [Math.round((C + r * Math.cos(a)) * 10) / 10, Math.round((C + r * Math.sin(a)) * 10) / 10];
}

function arcPath(from: number, to: number, r = R): string {
  const [x1, y1] = point(from, r);
  const [x2, y2] = point(to, r);
  const large = to - from > HOURS / 2 ? 1 : 0;
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

const fmt = (h: number) => {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${hh - 12}:${String(mm).padStart(2, "0")} PM`;
};

const DATA: Record<Variant, { arcs: Arc[]; checkpoint: number; caption: string }> = {
  student: {
    caption: "Python lab exam on Friday. Tonight is the first of three evenings.",
    arcs: [
      { from: 18, to: 18.75, title: "Lists and tuples", time: "6:00 PM", kind: "done", center: ["Lists and tuples", "45 min, done"] },
      { from: 18.83, to: 19.5, title: "Dictionaries and sets", time: "6:50 PM", kind: "now", center: ["Dictionaries and sets", "40 min block"] },
      { from: 19.67, to: 20.33, title: "File handling", time: "7:40 PM", kind: "next", center: ["File handling", "then a checkpoint"] },
    ],
    checkpoint: 20.45,
  },
  teacher: {
    caption: "Three rooms tonight. Students mark Interested; you start the class from VibrantLearn.",
    arcs: [
      { from: 18, to: 19, title: "Normal forms", time: "6:00 PM", kind: "done", center: ["Normal forms", "23 students, done"] },
      { from: 19.5, to: 20.5, title: "Inheritance", time: "7:30 PM", kind: "now", center: ["Inheritance", "14 interested, it will run"] },
      { from: 21, to: 22, title: "Deadlocks", time: "9:00 PM", kind: "next", center: ["Deadlocks", "7 of 10 needed"] },
    ],
    checkpoint: 22.2,
  },
};

const TICKS = [17, 18, 19, 20, 21, 22];

export function EveningDial({ variant = "student" }: { variant?: Variant }) {
  const d = DATA[variant];
  const [i, setI] = useState(1);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setI((n) => (n + 1) % d.arcs.length), 3200);
    return () => window.clearInterval(id);
  }, [d.arcs.length]);

  const active = d.arcs[i];
  const handHour = active.from + (active.to - active.from) * 0.35;
  const sweep = ((handHour - START) / HOURS) * 360;
  const [cx, cy] = point(d.checkpoint);
  return (
    <figure className="mx-auto w-full max-w-[min(340px,38vh)]">
      <svg viewBox="0 0 400 400" className="w-full overflow-visible" role="img" aria-labelledby={`dial-${variant}-t`}>
        <title id={`dial-${variant}-t`}>{d.caption}</title>
        <defs>
          <linearGradient id={`route-${variant}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-ember)" />
            <stop offset="55%" stopColor="var(--color-orchid)" />
            <stop offset="100%" stopColor="var(--color-violet)" />
          </linearGradient>
          <linearGradient id={`tail-${variant}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--color-orchid)" stopOpacity="0" />
            <stop offset="100%" stopColor="var(--color-ember)" stopOpacity="0.9" />
          </linearGradient>
          <filter id={`glow-${variant}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle cx={C} cy={C} r={R} fill="none" stroke="currentColor" strokeOpacity="0.1" strokeWidth="16" />
        <circle cx={C} cy={C} r={R - 34} fill="none" stroke="currentColor" strokeOpacity="0.06" strokeWidth="1" strokeDasharray="2 10" className={styles.spin} />
        {TICKS.map((h) => {
          const [lx, ly] = point(h, R + 30);
          return (
            <text key={h} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="13" fill="currentColor" fillOpacity="0.55">
              {h - 12} PM
            </text>
          );
        })}
        {d.arcs.map((a, n) => (
          <path
            key={a.title}
            d={arcPath(a.from, a.to)}
            pathLength={1}
            fill="none"
            stroke={a.kind === "done" ? "var(--color-leaf)" : `url(#route-${variant})`}
            strokeWidth={n === i ? 20 : 16}
            strokeLinecap="round"
            filter={n === i ? `url(#glow-${variant})` : undefined}
            className={`${styles.arc} ${styles.fade}`}
            style={{ animationDelay: `${150 + n * 200}ms`, opacity: n === i ? 1 : 0.45 }}
          />
        ))}
        {/* a comet that keeps travelling the evening */}
        <g className={styles.orbit} style={{ transformOrigin: `${C}px ${C}px` }} aria-hidden="true">
          <path d={arcPath(START - 0.9, START, R)} fill="none" stroke={`url(#tail-${variant})`} strokeWidth="4" strokeLinecap="round" />
          <circle cx={C} cy={C - R} r="5" fill="var(--color-ember)" filter={`url(#glow-${variant})`} />
        </g>
        <rect x={cx - 7} y={cy - 7} width="14" height="14" transform={`rotate(45 ${cx} ${cy})`} fill="var(--color-ink)" stroke="var(--color-orchid)" strokeWidth="3" />
        <g className={styles.hand} style={{ transformOrigin: `${C}px ${C}px`, transform: `rotate(${sweep}deg)` }}>
          <line x1={C} y1={C} x2={C} y2={C - (R - 34)} stroke="var(--color-ember)" strokeWidth="3" strokeLinecap="round" />
          <circle cx={C} cy={C - (R - 34)} r="7" fill="var(--color-ember)" className={styles.pulse} />
        </g>
        <circle cx={C} cy={C} r="5" fill="var(--color-ember)" />
        <g key={i} className={styles.swap}>
          <text x={C} y={C + 42} textAnchor="middle" className="font-display" fontSize="32" fontWeight="700" fill="currentColor">
            {fmt(handHour)}
          </text>
          <text x={C} y={C + 68} textAnchor="middle" fontSize="15" fontWeight="600" fill="currentColor">
            {active.center[0]}
          </text>
          <text x={C} y={C + 89} textAnchor="middle" fontSize="13" fill="currentColor" fillOpacity="0.65">
            {active.center[1]}
          </text>
        </g>
      </svg>
      <figcaption className="mt-5 text-center text-base leading-snug text-mist/80">{d.caption}</figcaption>
    </figure>
  );
}
