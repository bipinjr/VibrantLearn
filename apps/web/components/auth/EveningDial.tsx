import styles from "./evening-dial.module.css";

/** The evening as a clock face, 5 PM to 11 PM: the learning path bent into a dial.
 * Students see tonight's study blocks; teachers see tonight's rooms filling up. */

type Arc = { from: number; to: number; title: string; time: string; kind: "done" | "now" | "next" };
type Variant = "student" | "teacher";

const START = 17; // 5 PM at the top of the dial
const HOURS = 6; // to 11 PM, full circle
const C = 200;
const R = 148;

function point(hour: number, r = R): [number, number] {
  const a = ((hour - START) / HOURS) * 2 * Math.PI - Math.PI / 2;
  return [C + r * Math.cos(a), C + r * Math.sin(a)];
}

function arcPath(from: number, to: number, r = R): string {
  const [x1, y1] = point(from, r);
  const [x2, y2] = point(to, r);
  const large = to - from > HOURS / 2 ? 1 : 0;
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

const DATA: Record<Variant, { arcs: Arc[]; checkpoint: number; now: number; center: [string, string, string]; caption: string }> = {
  student: {
    arcs: [
      { from: 18, to: 18.75, title: "Lists, tuples and comprehensions", time: "6:00 – 6:45 PM", kind: "done" },
      { from: 18.83, to: 19.5, title: "Dictionaries and sets", time: "6:50 – 7:30 PM", kind: "now" },
      { from: 19.67, to: 20.33, title: "File handling", time: "7:40 – 8:20 PM", kind: "next" },
    ],
    checkpoint: 20.42,
    now: 19.05,
    center: ["7:03 PM", "Dictionaries and sets", "27 min left in this block"],
    caption: "Python lab exam on Friday. Tonight is the first of three evenings, planned to the minute.",
  },
  teacher: {
    arcs: [
      { from: 18, to: 19, title: "Normal forms, 1NF to BCNF", time: "6:00 – 7:00 PM", kind: "done" },
      { from: 19.5, to: 20.5, title: "Inheritance and method overriding", time: "7:30 – 8:30 PM", kind: "now" },
      { from: 21, to: 22, title: "Deadlocks", time: "9:00 – 10:00 PM", kind: "next" },
    ],
    checkpoint: 22.25,
    now: 19.25,
    center: ["7:30 PM", "Inheritance", "14 interested, it will run"],
    caption: "Three rooms tonight. Students mark Interested; you start the class from VibrantLearn.",
  },
};

const TICKS = [17, 18, 19, 20, 21, 22];
const tickLabel = (h: number) => `${h - 12} PM`;

export function EveningDial({ variant = "student" }: { variant?: Variant }) {
  const d = DATA[variant];
  const [hx, hy] = point(d.now, R - 30);
  const [cx, cy] = point(d.checkpoint);
  return (
    <figure className="w-full max-w-md">
      <svg viewBox="0 0 400 400" className="w-full" role="img" aria-labelledby={`dial-${variant}-t`}>
        <title id={`dial-${variant}-t`}>{d.caption}</title>
        <defs>
          <linearGradient id={`route-${variant}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-ember)" />
            <stop offset="55%" stopColor="var(--color-orchid)" />
            <stop offset="100%" stopColor="var(--color-violet)" />
          </linearGradient>
        </defs>
        {/* the evening: a quiet track */}
        <circle cx={C} cy={C} r={R} fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="18" />
        {TICKS.map((h) => {
          const [x1, y1] = point(h, R + 14);
          const [x2, y2] = point(h, R + 22);
          const [lx, ly] = point(h, R + 38);
          return (
            <g key={h} className="text-mist/60">
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="13" fill="currentColor">
                {tickLabel(h)}
              </text>
            </g>
          );
        })}
        {/* the plan, drawn once along the route */}
        {d.arcs.map((a, i) => (
          <path
            key={a.title}
            d={arcPath(a.from, a.to)}
            pathLength={1}
            fill="none"
            stroke={a.kind === "done" ? "var(--color-leaf)" : `url(#route-${variant})`}
            strokeOpacity={a.kind === "next" ? 0.55 : 1}
            strokeWidth="18"
            strokeLinecap="round"
            className={styles.arc}
            style={{ animationDelay: `${200 + i * 220}ms` }}
          />
        ))}
        {/* checkpoint */}
        <rect x={cx - 8} y={cy - 8} width="16" height="16" transform={`rotate(45 ${cx} ${cy})`} fill="var(--color-ink)" stroke="var(--color-orchid)" strokeWidth="3" />
        {/* now hand */}
        <g className={styles.hand} style={{ transformOrigin: `${C}px ${C}px`, ["--sweep" as string]: `${((d.now - START) / HOURS) * 360}deg` }}>
          <line x1={C} y1={C} x2={C} y2={C - (R - 30)} stroke="var(--color-ember)" strokeWidth="3" strokeLinecap="round" />
          <circle cx={C} cy={C - (R - 30)} r="7" fill="var(--color-ember)" />
        </g>
        <circle cx={C} cy={C} r="5" fill="var(--color-ember)" />
        <text x={C} y={C + 44} textAnchor="middle" className="font-display" fontSize="34" fontWeight="700" fill="currentColor">
          {d.center[0]}
        </text>
        <text x={C} y={C + 70} textAnchor="middle" fontSize="15" fontWeight="600" fill="currentColor">
          {d.center[1]}
        </text>
        <text x={C} y={C + 92} textAnchor="middle" fontSize="13" fill="currentColor" fillOpacity="0.7">
          {d.center[2]}
        </text>
        <desc>{`Now hand near ${hx.toFixed(0)}, ${hy.toFixed(0)}`}</desc>
      </svg>
      <figcaption className="mt-6 text-lg leading-snug text-mist/85">{d.caption}</figcaption>
      <ul className="mt-5 grid gap-2 text-sm">
        {d.arcs.map((a) => (
          <li key={a.title} className="flex items-baseline gap-3">
            <span
              aria-hidden="true"
              className={`size-2.5 shrink-0 rounded-full ${a.kind === "done" ? "bg-leaf" : a.kind === "now" ? "bg-ember" : "bg-violet"}`}
            />
            <span className="tabular-nums text-mist/70">{a.time}</span>
            <span className={a.kind === "now" ? "font-semibold" : "text-mist/85"}>{a.title}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
