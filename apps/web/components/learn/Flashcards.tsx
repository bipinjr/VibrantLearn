import { RotateCcw } from "lucide-react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform, type PanInfo } from "motion/react";
import { useState } from "react";
import type { Flashcard } from "@/lib/demo/data";
import { useT } from "@/lib/i18n/context";
import styles from "./flashcards.module.css";

/** Flip on click / Space, swipe or arrow keys: right = "Know it", left = "Again" (simple Leitner). */
export function Flashcards({ cards }: { cards: Flashcard[] }) {
  const t = useT();
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
            {t("{k} known, {a} to see again", { k: known, a: again.length })}
          </p>
          <p className="text-sm text-muted">{t("Cards you marked “Again” come back first next time.")}</p>
        </div>
        <button type="button" className="btn btn-secondary min-h-10 text-sm" onClick={() => { setI(0); setKnown(0); setAgain([]); }}>
          <RotateCcw size={15} strokeWidth={2} aria-hidden="true" /> {t("Go again")}
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
          initial={i === 0 || reduced ? false : { scale: 0.96, opacity: 0 }} // first card: no entrance, so server and client HTML match
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 420, damping: 30 }}
        >
          <motion.span className={`${styles.stamp} ${styles.know}`} style={{ opacity: knowOpacity }} aria-hidden="true">
            {t("Know it")}
          </motion.span>
          <motion.span className={`${styles.stamp} ${styles.again}`} style={{ opacity: againOpacity }} aria-hidden="true">
            {t("Again")}
          </motion.span>
          <button
            type="button"
            className={styles.card}
            data-flipped={flipped}
            onClick={() => setFlipped((f) => !f)}
            aria-label={flipped ? t("Answer: {back}. Press to see the question.", { back: card.back }) : t("{front}. Press to see the answer.", { front: card.front })}
          >
            <span className={styles.face}>
              <span className="text-xs text-muted">{t("Card {i} of {n}", { i: i + 1, n: cards.length })}</span>
              <span className="font-display text-2xl font-bold sm:text-3xl">{card.front}</span>
              <span className="text-xs text-muted">{t("Tap or press Space to flip")}</span>
            </span>
            <span className={`${styles.face} ${styles.back}`}>
              <span className="text-xs text-muted">{t("Answer")}</span>
              <span className="text-lg leading-snug">{card.back}</span>
              <span className="text-xs text-muted">{t("Swipe or use the arrow keys")}</span>
            </span>
          </button>
        </motion.div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn btn-secondary" onClick={() => void decide(false)}>
          {t("Again")}
        </button>
        <button type="button" className="btn btn-primary" onClick={() => void decide(true)}>
          {t("Know it")}
        </button>
      </div>
    </div>
  );
}
