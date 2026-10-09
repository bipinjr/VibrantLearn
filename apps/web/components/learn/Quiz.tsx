import { Check, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import type { QuizQuestion } from "@/lib/demo/data";
import { useT } from "@/lib/i18n/context";
import { ProgressRing } from "./ProgressRing";
import styles from "./quiz.module.css";

export function Quiz({ questions, onRevise }: { questions: QuizQuestion[]; onRevise?: (topics: string[]) => void }) {
  const t = useT();
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [origin, setOrigin] = useState({ x: "50%", y: "50%" });
  const [answers, setAnswers] = useState<number[]>([]);
  const root = useRef<HTMLDivElement>(null);
  const [finished, setFinished] = useState(false);
  const q = questions[i];

  function choose(idx: number, e?: MouseEvent<HTMLButtonElement>) {
    if (picked !== null || finished) return;
    if (e) {
      const r = e.currentTarget.getBoundingClientRect();
      setOrigin({ x: `${e.clientX - r.left}px`, y: `${e.clientY - r.top}px` });
    } else setOrigin({ x: "24px", y: "50%" });
    setPicked(idx);
    setAnswers((a) => [...a, idx]);
  }

  function next() {
    setPicked(null);
    setI((n) => n + 1);
  }

  // Keyboard: 1-4 to answer, Enter for next. Scoped to the quiz having focus within.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      const n = Number(e.key);
      if (n >= 1 && n <= (q?.options.length ?? 0)) choose(n - 1);
      if (e.key === "Enter" && picked !== null && i < questions.length - 1) next();
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  });

  if (finished) {
    const score = answers.filter((a, k) => a === questions[k].answer).length;
    const wrongTopics = [...new Set(questions.filter((qq, k) => answers[k] !== qq.answer).map((qq) => qq.topic))];
    return (
      <div className="pop-in grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
        <ProgressRing value={score / questions.length} size={88} stroke={8} label={t("Scored {s} of {n}", { s: score, n: questions.length })} />
        <div>
          <p className="font-display text-2xl font-bold">
            {t("{s} of {n} right", { s: score, n: questions.length })}
          </p>
          <p className="mt-1 text-sm text-muted">
            {t(score === questions.length ? "Clean sweep. This checkpoint is done." : score >= questions.length / 2 ? "Good. Fix the few you missed before the exam." : "These need another pass. Revise, then try again.")}
          </p>
          {wrongTopics.length ? (
            <div className="mt-3">
              <p className="text-sm font-medium">{t("Revise these")}</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {wrongTopics.map((t) => (
                  <li key={t} className="rounded-full bg-rose/10 px-3 py-1 text-sm">
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn btn-secondary min-h-10 text-sm" onClick={() => { setAnswers([]); setI(0); setPicked(null); setFinished(false); }}>
              <RotateCcw size={15} strokeWidth={2} aria-hidden="true" /> {t("Try again")}
            </button>
            {wrongTopics.length && onRevise ? (
              <button type="button" className="btn btn-primary min-h-10 text-sm" onClick={() => onRevise(wrongTopics)}>
                {t("Explain what I missed")}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={root} className="grid gap-4">
      <div className="flex items-center gap-3 text-sm text-muted">
        <span className="tabular-nums">
          {t("Question {i} of {n}", { i: i + 1, n: questions.length })}
        </span>
        <span className="h-1 flex-1 overflow-hidden rounded-full bg-line" aria-hidden="true">
          <span className="block h-full origin-left rounded-full bg-text transition-transform duration-500 ease-[var(--ease-out)]" style={{ transform: `scaleX(${(i + (picked !== null ? 1 : 0)) / questions.length})` }} />
        </span>
      </div>
      <p key={i} className="pop-in text-lg font-semibold leading-snug">
        {q.q}
      </p>
      <ul className="grid gap-2" role="list">
        {q.options.map((o, idx) => {
          const state = picked === null ? "idle" : idx === q.answer ? "right" : idx === picked ? "wrong" : "dim";
          return (
            <li key={`${i}-${o}`} className="rise" style={{ "--i": idx } as CSSProperties}>
              <button
                type="button"
                className={styles.option}
                data-state={state}
                style={{ "--ox": origin.x, "--oy": origin.y } as CSSProperties}
                onClick={(e) => choose(idx, e)}
                disabled={picked !== null}
                aria-describedby={picked !== null ? `why-${i}` : undefined}
              >
                <kbd className={styles.key}>{idx + 1}</kbd>
                <span className="relative flex-1 text-left">{o}</span>
                {state === "right" ? <Check size={18} strokeWidth={2.5} className="relative" aria-label={t("Correct answer")} /> : null}
                {state === "wrong" ? <X size={18} strokeWidth={2.5} className="relative" aria-label={t("Your answer, wrong")} /> : null}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="reveal" data-open={picked !== null}>
        <div>
          <p id={`why-${i}`} role="status" className="rounded-[var(--radius-input)] bg-bg px-4 py-3 text-sm">
            <strong>{t(picked === q.answer ? "Correct." : "Not quite.")} </strong>
            {q.why}
          </p>
          <div className="mt-3 flex justify-end">
            {i < questions.length - 1 ? (
              <button type="button" className="btn btn-primary min-h-10 text-sm" onClick={next}>
                {t("Next question")}
              </button>
            ) : (
              <button type="button" className="btn btn-primary min-h-10 text-sm" onClick={() => setFinished(true)}>
                {t("See my score")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
