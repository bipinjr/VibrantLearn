import type { CSSProperties } from "react";
import { PlanPath, type PathStep } from "@/components/learn/PlanPath";
import { ReplayButton } from "./ReplayButton";
import styles from "./hero.module.css";

const REQUEST = "Java internal tomorrow 10am, BCA SEP";

const STEPS: PathStep[] = [
  { kind: "block", time: "8:45 – 9:30 PM", title: "Inheritance and method overriding", minutes: 45, state: "now" },
  { kind: "block", time: "9:35 – 10:15 PM", title: "Exception handling: try, catch, throws", minutes: 40 },
  { kind: "block", time: "10:20 – 10:50 PM", title: "Interfaces and abstract classes", minutes: 30 },
  { kind: "checkpoint", time: "10:55 PM", title: "10-question quiz on tonight's topics" },
  { kind: "block", time: "6:30 – 7:15 AM", title: "Constructors and the this keyword", minutes: 45 },
  { kind: "block", time: "7:20 – 7:50 AM", title: "Redo the questions you got wrong", minutes: 30 },
  { kind: "checkpoint", time: "8:00 AM", title: "15-minute mock test" },
  { kind: "exam", time: "10:00 AM", title: "Java internal" },
];

/**
 * The landing page's one orchestrated moment (FRONTEND.md §4.4). Pure CSS: renders finished on the
 * server, plays once on load, and reduced-motion users just see the finished plan.
 */
export function HeroDemo() {
  const typeMs = REQUEST.length * 35;
  return (
    <figure
      className={styles.demo}
      aria-label="Example: a study plan built from one sentence"
      style={{ "--chars": REQUEST.length, "--type-ms": `${typeMs}ms` } as CSSProperties}
    >
      <ReplayButton className={styles.replay}>
        <div className={styles.request}>
          <span className={styles.prompt}>What&rsquo;s your next test?</span>
          <p className={styles.input}>
            <span className={styles.typed}>{REQUEST}</span>
            <span className={styles.caret} aria-hidden="true" />
          </p>
        </div>
        <p className={styles.reply}>
          You have about 4 good hours if you sleep by 11. Here&rsquo;s how to spend them.
        </p>
        <div
          data-play="true"
          className={styles.pathArea}
          style={{ "--path-delay": `${typeMs + 700}ms`, "--path-dur": "1600ms", "--path-step": "190ms" } as CSSProperties}
        >
          <PlanPath steps={STEPS} label="Study plan for a Java internal at 10 AM tomorrow" />
        </div>
      </ReplayButton>
    </figure>
  );
}
