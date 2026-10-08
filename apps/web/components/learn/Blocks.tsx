import { ArrowUpRight, BookOpenText, Check, Copy, Cpu, Database, FileText, Layers, ListChecks, Route, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import type { Block, Lang, Message } from "@/lib/demo/data";
import { useDemo } from "@/lib/demo/store";
import { Flashcards } from "./Flashcards";
import { PlanTimeline } from "./PlanTimeline";
import { ProgressRing } from "./ProgressRing";
import { Quiz } from "./Quiz";

/** Reveals text word by word for a reply that just arrived. Old replies render instantly. */
function StreamText({ text, animate }: { text: string; animate: boolean }) {
  const words = text.split(/(\s+)/);
  const [n, setN] = useState(animate ? 0 : words.length);
  useEffect(() => {
    if (!animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const id = requestAnimationFrame(() => setN(words.length));
      return () => cancelAnimationFrame(id);
    }
    let raf = 0;
    let last = 0;
    const step = (t: number) => {
      if (t - last > 18) {
        last = t;
        setN((x) => Math.min(words.length, x + 2));
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [animate, words.length]);
  const streaming = n < words.length;
  return <span className={streaming ? "caret-blink" : undefined}>{words.slice(0, n).join("")}</span>;
}

function Sources({ items }: { items?: string[] }) {
  if (!items?.length) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-2" aria-label="Sources">
      {items.map((s) => (
        <li key={s} className="inline-flex items-center gap-1.5 rounded-full bg-bg px-3 py-1 text-xs text-muted">
          <FileText size={13} strokeWidth={1.75} aria-hidden="true" />
          {s}
        </li>
      ))}
    </ul>
  );
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 rounded-[8px] px-2 py-1 text-xs text-muted transition-colors hover:bg-text/[0.06] hover:text-text"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          window.setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard blocked: nothing to do */
        }
      }}
    >
      {done ? <Check size={14} strokeWidth={2} aria-hidden="true" /> : <Copy size={14} strokeWidth={1.75} aria-hidden="true" />}
      {done ? "Copied" : "Copy"}
    </button>
  );
}

function Card({ icon, title, tools, children }: { icon: ReactNode; title: ReactNode; tools?: ReactNode; children: ReactNode }) {
  return (
    <section className="pop-in rounded-[var(--radius-card)] border border-line bg-surface">
      <header className="flex items-center gap-2 border-b border-line px-4 py-2.5 sm:px-5">
        <span className="text-muted" aria-hidden="true">
          {icon}
        </span>
        <h3 className="min-w-0 flex-1 truncate font-sans text-sm font-semibold tracking-normal">{title}</h3>
        {tools}
      </header>
      <div className="px-4 py-4 sm:px-5">{children}</div>
    </section>
  );
}

const LANGS: { id: Lang; label: string }[] = [
  { id: "en", label: "English" },
  { id: "kn", label: "ಕನ್ನಡ" },
  { id: "hi", label: "हिन्दी" },
];

function Notes({ block, animate }: { block: Extract<Block, { type: "notes" }>; animate: boolean }) {
  const { state } = useDemo();
  const [lang, setLang] = useState<Lang>(state.profile.language);
  return (
    <Card
      icon={<BookOpenText size={16} strokeWidth={1.75} />}
      title={`Notes: ${block.topic}`}
      tools={<CopyButton text={block.text[lang]} />}
    >
      <div role="radiogroup" aria-label="Language" className="mb-3 inline-flex rounded-full bg-bg p-1">
        {LANGS.map((l) => (
          <button
            key={l.id}
            type="button"
            role="radio"
            aria-checked={lang === l.id}
            lang={l.id}
            onClick={() => setLang(l.id)}
            className={`rounded-full px-3 py-1 text-sm transition-colors duration-150 ${lang === l.id ? "bg-surface font-semibold shadow-sm" : "text-muted hover:text-text"}`}
          >
            {l.label}
          </button>
        ))}
      </div>
      <p key={lang} lang={lang} className="max-w-[68ch] animate-[fade_var(--dur-base)_var(--ease-out)]">
        <StreamText text={block.text[lang]} animate={animate && lang === state.profile.language} />
      </p>
      <Sources items={block.sources} />
    </Card>
  );
}

function PlanCard({ planId }: { planId: string }) {
  const { state, now, toggleStep } = useDemo();
  const plan = state.plans.find((p) => p.id === planId);
  if (!plan) return <p className="text-sm text-muted">This plan was replaced by a newer one in this session.</p>;
  const steps = plan.steps.filter((s) => s.kind !== "exam");
  const pct = steps.length ? steps.filter((s) => s.done).length / steps.length : 0;
  return (
    <Card
      icon={<Route size={16} strokeWidth={1.75} />}
      title={`${plan.subject}: ${plan.mode} plan`}
      tools={
        <Link href={`/app/plans/${plan.id}`} transitionTypes={["nav-forward"]} className="inline-flex items-center gap-1 rounded-[8px] px-2 py-1 text-xs font-medium no-underline hover:bg-text/[0.06]">
          Open plan <ArrowUpRight size={14} strokeWidth={1.75} aria-hidden="true" />
        </Link>
      }
    >
      <div className="mb-4 flex items-center gap-4">
        <ProgressRing value={pct} size={48} stroke={5} />
        <p className="text-sm text-muted">
          {steps.filter((s) => s.done).length} of {steps.length} steps done. Tick a step when you finish it.
        </p>
      </div>
      <PlanTimeline plan={plan} nowIso={now.toISOString()} onToggle={(id) => toggleStep(plan.id, id)} limit={5} />
    </Card>
  );
}

export function BlockView({ block, animate, onSend }: { block: Block; animate: boolean; onSend: (text: string) => void }) {
  switch (block.type) {
    case "text":
      return (
        <div className="max-w-[68ch]">
          <p className="whitespace-pre-line">
            <StreamText text={block.text} animate={animate} />
          </p>
          <Sources items={block.sources} />
        </div>
      );
    case "followup":
      return (
        <div>
          <p>
            <StreamText text={block.text} animate={animate} />
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {block.chips.map((c, i) => (
              <button
                key={c}
                type="button"
                disabled={Boolean(block.picked)}
                onClick={() => onSend(c)}
                className={`chip rise text-sm ${block.picked === c ? "border-link bg-link/10" : ""} disabled:cursor-default ${block.picked && block.picked !== c ? "opacity-50" : ""}`}
                style={{ "--i": i + 2 } as React.CSSProperties}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      );
    case "plan":
      return <PlanCard planId={block.planId} />;
    case "notes":
      return <Notes block={block} animate={animate} />;
    case "questions":
      return (
        <Card
          icon={<ListChecks size={16} strokeWidth={1.75} />}
          title={`Important questions: ${block.topic}`}
          tools={<CopyButton text={block.items.map((q) => `[${q.marks} marks] ${q.q}`).join("\n")} />}
        >
          <ol className="grid gap-3">
            {block.items.map((q, i) => (
              <li key={q.q} className="rise grid grid-cols-[4.5rem_1fr] items-baseline gap-3" style={{ "--i": i } as React.CSSProperties}>
                <span
                  className={`justify-self-start rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
                    q.marks === 10 ? "bg-violet/15" : q.marks === 5 ? "bg-orchid/15" : "bg-text/[0.06]"
                  }`}
                >
                  {q.marks} marks
                </span>
                <span>{q.q}</span>
              </li>
            ))}
          </ol>
          <button type="button" className="mt-4 text-sm font-medium text-link hover:underline" onClick={() => onSend("quiz me on these")}>
            Practise these as a quiz
          </button>
        </Card>
      );
    case "quiz":
      return (
        <Card icon={<Sparkles size={16} strokeWidth={1.75} />} title={`Quiz: ${block.topic}`}>
          <Quiz questions={block.questions} onRevise={(topics) => onSend(`explain ${topics[0]}`)} />
        </Card>
      );
    case "flashcards":
      return (
        <Card icon={<Layers size={16} strokeWidth={1.75} />} title={`Flashcards: ${block.topic}`}>
          <Flashcards cards={block.cards} />
        </Card>
      );
  }
}

const SERVED: Record<NonNullable<Message["servedFrom"]>, { label: string; icon: ReactNode }> = {
  ml: { label: "Answered on our side, no AI call", icon: <Cpu size={12} strokeWidth={2} /> },
  cache: { label: "From saved answers", icon: <Database size={12} strokeWidth={2} /> },
  llm: { label: "Written by AI, checked against your syllabus", icon: <Sparkles size={12} strokeWidth={2} /> },
};

export function ServedBadge({ from }: { from?: Message["servedFrom"] }) {
  if (!from) return null;
  const s = SERVED[from];
  return (
    <span className="inline-flex items-center gap-1 text-[0.7rem] text-muted">
      <span aria-hidden="true">{s.icon}</span>
      {s.label}
    </span>
  );
}
