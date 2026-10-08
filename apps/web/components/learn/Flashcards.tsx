import { RotateCcw } from "lucide-react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform, type PanInfo } from "motion/react";
import { useState } from "react";
import type { Flashcard } from "@/lib/demo/data";
import styles from "./flashcards.module.css";

/** Flip on click / Space, swipe or arrow keys: right = "Know it", left = "Again" (simple Leitner). */
export function Flashcards({ cards }: { cards: Flashcard[] }) {
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(0);
  const [again, setAgain] = useState<number[]>([]);
  const reduced = useReducedMotion();
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-10, 10]);
  const knowOpacity = useTransform(x, [20, 120], [0, 1]);
  const againOpacity = useTransform(x, [-120, -20], [1, 0]);
  const done = i >= cards.length;

  async function decide(know: boolean) {
    if (done) return;
    if (!reduced) await animate(x, know ? 420 : -420, { duration: 0.24, ease: [0.55, 0, 1, 0.45] });
    if (know) setKnown((k) => k + 1);
    else setAgain((a) => [...a, i]);
    x.set(0);
    setFlipped(false);
    setI((n) => n + 1);
  }

  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x > 110 || info.velocity.x > 600) void decide(true);
    else if (info.offset.x < -110 || info.velocity.x < -600) void decide(false);
    else animate(x, 0, reduced ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 32 });
  }

  if (done) {
    return (
      <div className="pop-in flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-card)] bg-bg p-5">
        <div>
          <p className="font-display text-xl font-bold">
            {known} known, {again.length} to see again
          </p>
          <p className="text-sm text-muted">Cards you marked &ldquo;Again&rdquo; come back first next time.</p>
        </div>
        <button type="button" className="btn btn-secondary min-h-10 text-sm" onClick={() => { setI(0); setKnown(0); setAgain([]); }}>
          <RotateCcw size={15} strokeWidth={2} aria-hidden="true" /> Go again
        </button>
      </div>
    );
  }

  const card = cards[i];
  return (
    <div
      className="grid gap-4"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") void decide(true);
        if (e.key === "ArrowLeft") void decide(false);
      }}
    >
      <div className="h-[3px] overflow-hidden rounded-full bg-line" aria-hidden="true">
        <div className="h-full origin-left bg-text transition-transform duration-500 ease-[var(--ease-out)]" style={{ transform: `scaleX(${i / cards.length})` }} />
      </div>

      <div className={styles.stage}>
        {cards[i + 1] ? <div className={`${styles.card} ${styles.under}`} aria-hidden="true" /> : null}
        <motion.div
          key={i}
          className={styles.dragger}
          style={{ x, rotate }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.9}
          onDragEnd={onDragEnd}
          initial={reduced ? false : { scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 420, damping: 30 }}
        >
          <motion.span className={`${styles.stamp} ${styles.know}`} style={{ opacity: knowOpacity }} aria-hidden="true">
            Know it
          </motion.span>
          <motion.span className={`${styles.stamp} ${styles.again}`} style={{ opacity: againOpacity }} aria-hidden="true">
            Again
          </motion.span>
          <button
            type="button"
            className={styles.card}
            data-flipped={flipped}
            onClick={() => setFlipped((f) => !f)}
            aria-label={flipped ? `Answer: ${card.back}. Press to see the question.` : `${card.front}. Press to see the answer.`}
          >
            <span className={styles.face}>
              <span className="text-xs text-muted">Card {i + 1} of {cards.length}</span>
              <span className="font-display text-2xl font-bold sm:text-3xl">{card.front}</span>
              <span className="text-xs text-muted">Tap or press Space to flip</span>
            </span>
            <span className={`${styles.face} ${styles.back}`}>
              <span className="text-xs text-muted">Answer</span>
              <span className="text-lg leading-snug">{card.back}</span>
              <span className="text-xs text-muted">Swipe or use the arrow keys</span>
            </span>
          </button>
        </motion.div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn btn-secondary" onClick={() => void decide(false)}>
          Again
        </button>
        <button type="button" className="btn btn-primary" onClick={() => void decide(true)}>
          Know it
        </button>
      </div>
    </div>
  );
}
