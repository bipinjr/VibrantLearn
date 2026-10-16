// Turns a student message into assistant blocks for demo mode: local ML first, "cache" second,
// and the LLM step simulated with templates. Mirrors the pipeline in PRD §9.
import { JAVA_CARDS, JAVA_NOTES, JAVA_QUIZ, type Block, type Flashcard, type Lang, type Mode, type QuizQuestion } from "./data";
import { topicNote } from "./notes-i18n";
import { modeFor, parseDeadline, parseRequest, toLatin } from "./parse";
import { buildPlan, priority } from "./scheduler";
import { SUBJECTS, topicsFor, type Topic } from "./syllabus";
import type { PlanStep, StudyFile } from "./data";

export type Pending = { subject?: string; deadline?: string; hours?: number; weak?: string[]; awaiting: "subject" | "deadline" | "hours" };

export type Reply = {
  blocks: Block[];
  servedFrom: "ml" | "cache" | "llm";
  pending?: Pending | null;
  plan?: { subject: string; deadline: string; mode: Mode; hours: number; steps: PlanStep[] };
  sessionPatch?: { title?: string; subject?: string; deadline?: string; mode?: Mode };
  /** Set when the question is outside the local engine: the store asks the AI with this text. */
  open?: string;
  /** Language to answer in: what the student wrote in (Kannada/Hindi script or English letters), else their setting. */
  lang?: Lang;
  /** Syllabus topic whose notes the AI should write (template text is the fallback). */
  aiNotes?: { subject: string; topic: string };
};

type Ctx = {
  now: Date;
  language: Lang;
  sessionSubject?: string;
  pending?: Pending | null;
  files: StudyFile[];
  seen: Set<string>;
};

const timeWord = (d: Date, now: Date) => (d.getTime() - now.getTime() < 36 * 3_600_000 ? "tomorrow" : "in a few days");
const short = (s: string) => s.replace(" Programming", "").replace("Database Management Systems", "DBMS");

function findTopic(subject: string | undefined, hint: string | undefined): Topic | undefined {
  const pool = subject ? topicsFor(subject) : SUBJECTS.flatMap(topicsFor);
  if (!hint) return subject ? priority(subject)[0] : undefined;
  const words = hint.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
  let best: Topic | undefined;
  let score = 0;
  // Topic-name hits count double; ties go to the topic that carries more exam weight.
  for (const t of [...pool].sort((a, b) => b.weightage - a.weightage)) {
    const stem = (w: string) => w.slice(0, Math.max(4, w.length - 2));
    const name = t.topic.toLowerCase();
    const rest = `${t.unitTitle} ${t.subtopics.join(" ")}`.toLowerCase();
    const s = words.reduce((acc, w) => acc + (name.includes(stem(w)) ? 2 : rest.includes(stem(w)) ? 1 : 0), 0);
    if (s > score) [best, score] = [t, s];
  }
  return best ?? (subject ? priority(subject)[0] : undefined);
}

const notesFor = (t: Topic): Record<Lang, string> => (/overriding/i.test(t.topic) ? JAVA_NOTES : topicNote(t));

function questionsFor(subject: string, focus?: Topic) {
  const top = focus ? [focus, ...priority(subject).filter((t) => t.topic !== focus.topic)].slice(0, 3) : priority(subject).slice(0, 3);
  return [
    ...top.slice(0, 2).map((t) => ({ marks: 2 as const, q: `Define ${t.topic.toLowerCase().replace(/^the /, "")}.` })),
    ...top.slice(0, 2).map((t) => ({ marks: 5 as const, q: `Explain ${t.subtopics[0]?.toLowerCase() ?? t.topic.toLowerCase()} with an example.` })),
    { marks: 10 as const, q: `Explain ${top[0].topic.toLowerCase()} in detail, covering ${top[0].subtopics.join(", ").toLowerCase()}.` },
  ];
}

function quizFor(subject: string): QuizQuestion[] {
  if (subject === "Java Programming") return JAVA_QUIZ;
  const topics = priority(subject).slice(0, 5);
  const others = topicsFor(subject);
  return topics.map((t, i) => {
    const right = t.subtopics[0];
    const wrong = others.filter((o) => o.topic !== t.topic).flatMap((o) => o.subtopics).filter((x, j, a) => a.indexOf(x) === j).slice(i, i + 3);
    const options = [...wrong];
    const answer = i % 4;
    options.splice(answer, 0, right);
    return { q: `Which of these belongs to "${t.topic}"?`, options: options.slice(0, 4), answer, why: `${right} is part of ${t.topic}, Unit ${t.unit}.`, topic: t.topic };
  });
}

function cardsFor(subject: string): Flashcard[] {
  if (subject === "Java Programming") return JAVA_CARDS;
  return priority(subject).slice(0, 6).map((t) => ({ front: t.topic, back: `${t.subtopics.join(" · ")} (Unit ${t.unit})` }));
}

/** Words after "weak", "difficult", "confusing" etc., e.g. "normalization weak" -> ["normalization"]. */
export function weakTopics(text: string): string[] {
  const s = text.toLowerCase();
  const near = s.match(/([a-z][a-z ]{2,40}?)\s+(?:is |are )?(?:weak|difficult|hard|confusing|tough|kashta)\b/)?.[1] ?? s.match(/\b(?:weak (?:in|at)|struggle with|stuck on|confused about)\s+([a-z][a-z ]{2,40})/)?.[1];
  return near ? near.split(/[\s,]+/).filter((w) => w.length > 3 && !["test", "exam", "internal", "with", "about"].includes(w)) : [];
}

function planReply(p: { subject: string; deadline: Date; hours?: number; weak?: string[] }, ctx: Ctx): Reply {
  const mode = modeFor(p.deadline, ctx.now);
  const hours = p.hours ?? (mode === "sprint" ? (p.deadline.getTime() - ctx.now.getTime()) / 3_600_000 : 3);
  const steps = buildPlan({ subject: p.subject, deadline: p.deadline, now: ctx.now, mode, hoursPerDay: hours, idPrefix: `p${ctx.now.getTime()}`, weak: p.weak });
  const firstBlock = steps.find((s) => s.kind === "block");
  const weakNote = p.weak?.length && firstBlock ? ` ${firstBlock.title} comes first because you said it's a weak spot.` : "";
  const blocks = steps.filter((s) => s.kind === "block");
  const total = blocks.reduce((a, s) => a + (s.minutes ?? 0), 0);
  const lead: Record<Mode, string> = {
    sprint: `Short on time, so this covers only the topics that carry the most marks, in 25-minute focus blocks, and ends with a quick mock quiz.`,
    crash: `${blocks.length} ${blocks.length === 1 ? "block" : "blocks"}, ${total >= 90 ? `about ${Math.round(total / 60)} hours` : `${total} minutes`} in total, highest-mark topics first. I kept 11 PM to 6 AM free for sleep and added a checkpoint each day.`,
    steady: `A week-by-week path with a checkpoint every weekend and the last stretch kept for revision.`,
    deep: `Plenty of time: one unit at a time, weekend checkpoints, and three spaced revision loops before the exam.`,
  };
  return {
    servedFrom: "ml",
    pending: null,
    plan: { subject: p.subject, deadline: p.deadline.toISOString(), mode, hours, steps },
    sessionPatch: { title: `${short(p.subject)} ${mode === "steady" || mode === "deep" ? "exam" : "test"}`, subject: p.subject, deadline: p.deadline.toISOString(), mode },
    blocks: [{ type: "text", text: lead[mode] + weakNote }],
  };
}

export function respond(text: string, ctx: Ctx): Reply {
  const s = toLatin(text).toLowerCase().trim(); // Kannada/Hindi script read as Latin words
  const parsed = parseRequest(text, ctx.now);

  // A reply to a follow-up continues the pending request. Anything else drops it and is routed fresh.
  if (ctx.pending) {
    const p = { ...ctx.pending };
    if (p.awaiting === "subject") p.subject = SUBJECTS.find((x) => x.toLowerCase() === s) ?? parsed.subject;
    if (p.awaiting === "deadline") p.deadline = parseDeadline(s.replace("next week", "in 7 days").replace("in a month", "in 30 days"), ctx.now)?.toISOString();
    if (p.awaiting === "hours") {
      const n = Number(s.match(/\d+(\.\d+)?/)?.[0]);
      if (n > 0 && n <= 16) p.hours = n;
    }
    const filled = p.awaiting === "subject" ? p.subject : p.awaiting === "deadline" ? p.deadline : p.hours;
    if (filled) return continuePlan(p, ctx);
    const movedOn = !["make_plan", "smalltalk", "out_of_scope"].includes(parsed.intent);
    if (!movedOn) {
      const again = { subject: "subject", deadline: "exam date", hours: "number of hours" }[p.awaiting];
      const r = continuePlan({ ...p, [p.awaiting]: undefined }, ctx);
      const first = r.blocks[0];
      if (first?.type === "followup") first.text = `I didn't catch the ${again}. ${first.text}`;
      return r;
    }
  }

  const subject = parsed.subject ?? ctx.sessionSubject;
  const lang = parsed.language ?? ctx.language;
  const starters = ["Java internal tomorrow 10am", "Explain normalization", "Quiz me on stacks"];

  // Messages that aren't study requests still get a proper answer.
  if (!/[a-zಀ-೿ऀ-ॿ]{2,}/i.test(s)) {
    return { servedFrom: "ml", pending: null, blocks: [{ type: "followup", text: "I didn't catch that. Tell me a subject and when the exam is, or ask about a topic.", chips: starters }] };
  }
  if (/\b(what can you do|what do you do|how (does|do) (this|it|you) work|help me|^help$|features?)\b/.test(s) && parsed.intent !== "make_plan") {
    return {
      servedFrom: "ml",
      pending: null,
      blocks: [{
        type: "followup",
        text: "I can plan your study hours for an exam, explain topics in English, Kannada or Hindi, list the questions most likely to come, quiz you, make flashcards, and answer from notes you upload. Try one:",
        chips: [...starters, "Flashcards for OS"],
      }],
    };
  }
  if (/^(thanks|thank you|thx|ty|tq|ok|okay|cool|great|nice|super|done)\b/.test(s)) {
    return { servedFrom: "ml", pending: null, blocks: [{ type: "text", text: "You're welcome. Tick off each block in your plan as you finish it, and ask me whenever you get stuck." }] };
  }

  switch (parsed.intent) {
    case "make_plan":
      return continuePlan({ subject, deadline: parsed.deadline?.toISOString(), hours: parsed.hours, weak: weakTopics(s), awaiting: "subject" }, ctx);
    case "smalltalk":
      return { servedFrom: "ml", pending: null, blocks: [{ type: "followup", text: "Hi! Tell me your next test and when it is, and I'll plan the hours you have. Or ask me anything you're stuck on.", chips: starters }] };
    case "out_of_scope":
      return openQuestion(text, lang);
    case "ask_about_file": {
      const ready = ctx.files.filter((f) => f.status === "ready");
      const named = ctx.files.find((f) => s.includes(f.name.toLowerCase()) || s.includes(f.name.toLowerCase().split(/[_.]/)[0]));
      if (named && named.status !== "ready") return { servedFrom: "ml", blocks: [{ type: "text", text: `${named.name} is still being processed. Ask again in a moment and I'll answer from it.` }] };
      const file = named ?? ready[0];
      if (!file) return { servedFrom: "ml", blocks: [{ type: "text", text: "This session has no notes yet. Attach a PDF, slides or photos with the clip button and ask again." }] };
      const t = findTopic(subject, parsed.topicHint ?? s);
      const key = `file|${file.id}|${t?.topic}|${lang}`;
      const hit = ctx.seen.has(key);
      ctx.seen.add(key);
      const note = t ? notesFor(t)[lang] : "";
      return { servedFrom: hit ? "cache" : "llm", blocks: [{ type: "text", text: `From your notes: ${note}`, sources: [`${file.name} · p. ${((t?.unit ?? 1) * 3) % (file.pages ?? 9) + 1}`] }] };
    }
    case "explain_topic": {
      // Not one of our syllabus topics: treat it as an open question for the AI.
      if (!parsed.subject && !matchesSyllabus(parsed.topicHint ?? s)) return openQuestion(text, lang);
      const t = findTopic(subject, parsed.topicHint ?? s);
      if (!t) return openQuestion(text, lang);
      const key = `notes|${t.topic}`;
      const hit = ctx.seen.has(key);
      ctx.seen.add(key);
      const aiNotes = /overriding/i.test(t.topic) ? undefined : { subject: t.subject, topic: t.topic }; // overriding has hand-written notes
      return { servedFrom: hit ? "cache" : "llm", lang, aiNotes, blocks: [{ type: "notes", topic: t.topic, text: notesFor(t), lang, sources: ctx.files.some((f) => f.status === "ready") ? [`${ctx.files.find((f) => f.status === "ready")!.name} · p. 4`] : undefined }] };
    }
    case "important_questions": {
      if (!subject) return { servedFrom: "ml", blocks: [{ type: "followup", text: "Which subject should the questions be from?", chips: SUBJECTS.slice(0, 4).map((s) => `Important questions for ${short(s)}`) }] };
      const t = parsed.topicHint ? findTopic(subject, parsed.topicHint) : undefined;
      return { servedFrom: "llm", blocks: [{ type: "questions", topic: t ? t.topic : `${short(subject)}: most likely questions`, items: questionsFor(subject, t) }] };
    }
    case "make_quiz": {
      const subj = subject ?? findTopic(undefined, s)?.subject;
      if (!subj) return { servedFrom: "ml", blocks: [{ type: "followup", text: "Quiz on which subject?", chips: SUBJECTS.slice(0, 4).map((s) => `Quiz me on ${short(s)}`) }] };
      const key = `quiz|${subj}`;
      const hit = ctx.seen.has(key);
      ctx.seen.add(key);
      return { servedFrom: hit ? "cache" : "llm", blocks: [{ type: "quiz", topic: short(subj), questions: quizFor(subj) }] };
    }
    case "make_flashcards": {
      const subj = subject ?? findTopic(undefined, s)?.subject;
      if (!subj) return { servedFrom: "ml", blocks: [{ type: "followup", text: "Flashcards for which subject?", chips: SUBJECTS.slice(0, 4).map((s) => `Flashcards for ${short(s)}`) }] };
      return { servedFrom: "cache", blocks: [{ type: "flashcards", topic: `${short(subj)} key terms`, cards: cardsFor(subj) }] };
    }
  }
}

function matchesSyllabus(hint: string): boolean {
  const words = hint.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  const hay = SUBJECTS.flatMap(topicsFor).map((t) => `${t.unitTitle} ${t.topic} ${t.subtopics.join(" ")}`.toLowerCase()).join(" ");
  return words.some((w) => hay.includes(w.slice(0, Math.max(4, w.length - 2))));
}

/** Anything outside the syllabus engine goes to the AI. `fallback` is shown if AI is off or fails. */
function openQuestion(text: string, lang?: Lang): Reply {
  return {
    servedFrom: "llm",
    lang,
    pending: null,
    open: text,
    blocks: [{
      type: "followup",
      text: "That one needs the AI model, which isn't switched on in this demo yet (add a GROQ_API_KEY to turn it on). I can already plan, explain your syllabus topics, quiz you and make flashcards:",
      chips: ["Explain method overriding", "Quiz me on DBMS", "OS test in 2 days"],
    }],
  };
}

function continuePlan(p: Pending, c: Ctx): Reply {
  if (!p.subject) {
    return { servedFrom: "ml", pending: { ...p, awaiting: "subject" }, blocks: [{ type: "followup", text: "Which subject is the exam for?", chips: SUBJECTS.slice(0, 6) }] };
  }
  if (!p.deadline) {
    return { servedFrom: "ml", pending: { ...p, awaiting: "deadline" }, blocks: [{ type: "followup", text: `When is the ${short(p.subject)} exam?`, chips: ["Tonight", "Tomorrow 10am", "In 3 days", "Next week", "In a month"] }] };
  }
  const deadline = new Date(p.deadline);
  const mode = modeFor(deadline, c.now);
  if (mode === "crash" && !p.hours) {
    return { servedFrom: "ml", pending: { ...p, awaiting: "hours" }, blocks: [{ type: "followup", text: `Got it: ${p.subject}, ${timeWord(deadline, c.now)}. How many hours can you study each day?`, chips: ["2 hours", "3 hours", "4 hours", "5 hours"] }] };
  }
  return planReply({ subject: p.subject, deadline, hours: p.hours, weak: p.weak }, c);
}
