// Sample data for demo mode. Shapes mirror the DB tables so swapping in Supabase reads is mechanical.
// ponytail: computed per request from `now`; real data replaces this in M3+.

import { OVERRIDING, type Lang } from "./notes-i18n";

export type { Lang };
export type StepKind = "block" | "checkpoint" | "exam";
export type PlanStep = {
  id: string;
  kind: StepKind;
  title: string;
  unit?: string;
  start: string; // ISO
  end?: string; // ISO
  minutes?: number;
  done: boolean;
};
export type Mode = "sprint" | "crash" | "steady" | "deep";
export type Plan = { id: string; sessionId: string; subject: string; deadline: string; mode: Mode; hours: number; steps: PlanStep[] };
export type FileStatus = "uploading" | "scanning" | "processing" | "ready" | "failed";
export type StudyFile = {
  id: string;
  sessionId: string;
  name: string;
  sizeBytes: number;
  pages?: number;
  status: FileStatus;
  progress?: number;
  error?: string;
  added: string;
};
export type QuizQuestion = { q: string; options: string[]; answer: number; why: string; topic: string };
export type Flashcard = { front: string; back: string };
export type Block =
  | { type: "followup"; text: string; chips: string[]; picked?: string }
  | { type: "plan"; planId: string }
  | { type: "notes"; topic: string; text: Record<Lang, string>; sources?: string[]; lang?: Lang }
  | { type: "questions"; topic: string; items: { marks: 2 | 5 | 10; q: string }[] }
  | { type: "quiz"; topic: string; questions: QuizQuestion[] }
  | { type: "flashcards"; topic: string; cards: Flashcard[] }
  | { type: "text"; text: string; sources?: string[] };
export type Message = {
  id: string;
  role: "user" | "assistant";
  content?: string;
  blocks?: Block[];
  servedFrom?: "ml" | "cache" | "llm";
  at: string;
};
export type Session = {
  id: string;
  title: string;
  subject: string;
  deadline: string;
  mode: Mode;
  updated: string;
};

const IST_OFFSET_MIN = 330;

/** A Date for a wall-clock time in Asia/Kolkata, `dayOffset` days from today (IST). */
function ist(now: Date, dayOffset: number, h: number, m: number): Date {
  const local = new Date(now.getTime() + IST_OFFSET_MIN * 60_000);
  return new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + dayOffset, h, m) -
      IST_OFFSET_MIN * 60_000,
  );
}
const addMin = (d: Date, m: number) => new Date(d.getTime() + m * 60_000);
const iso = (d: Date) => d.toISOString();

function chain(
  start: Date,
  items: { title: string; unit?: string; minutes?: number; kind?: StepKind }[],
  idPrefix: string,
  gap = 5,
): { steps: PlanStep[]; end: Date } {
  let t = start;
  const steps = items.map((it, i) => {
    const kind = it.kind ?? "block";
    const minutes = it.minutes ?? 0;
    const s: PlanStep = {
      id: `${idPrefix}-${i}`,
      kind,
      title: it.title,
      unit: it.unit,
      start: iso(t),
      end: minutes ? iso(addMin(t, minutes)) : undefined,
      minutes: minutes || undefined,
      done: false,
    };
    t = addMin(t, minutes + gap);
    return s;
  });
  return { steps, end: t };
}

export const JAVA_NOTES: Record<Lang, string> = {
  en: OVERRIDING.en.detailed,
  kn: OVERRIDING.kn.detailed,
  hi: OVERRIDING.hi.detailed,
};

export const JAVA_QUIZ: QuizQuestion[] = [
  {
    q: "Which keyword calls the parent class version of an overridden method?",
    options: ["this", "super", "extends", "final"],
    answer: 1,
    why: "super refers to the immediate parent class, so super.show() runs the parent's show().",
    topic: "Method overriding",
  },
  {
    q: "Which of these methods can NOT be overridden?",
    options: ["A public method", "A protected method", "A final method", "An abstract method"],
    answer: 2,
    why: "final stops a method from being overridden. Abstract methods must be overridden.",
    topic: "Abstract classes and final",
  },
  {
    q: "Dynamic method dispatch decides which method runs based on…",
    options: ["the reference type", "the object's actual type", "the method's return type", "the package"],
    answer: 1,
    why: "At runtime Java looks at the object, not the reference. That's runtime polymorphism.",
    topic: "Method overriding",
  },
  {
    q: "Java doesn't allow multiple inheritance with classes mainly to avoid…",
    options: ["slow compilation", "the diamond problem", "garbage collection issues", "too many constructors"],
    answer: 1,
    why: "Two parents with the same method would make the call ambiguous. Interfaces solve this safely.",
    topic: "Inheritance and its types",
  },
  {
    q: "Which block always runs, whether or not an exception is thrown?",
    options: ["try", "catch", "finally", "throws"],
    answer: 2,
    why: "finally runs after try/catch every time, which is why it's used to close files and connections.",
    topic: "Exception handling",
  },
];

export const JAVA_CARDS: Flashcard[] = [
  { front: "Method overriding", back: "Subclass redefines an inherited method with the same signature. Resolved at runtime." },
  { front: "Method overloading", back: "Same method name, different parameter lists in one class. Resolved at compile time." },
  { front: "super keyword", back: "Refers to the parent class: call its constructor with super(), its methods with super.m()." },
  { front: "Abstract class", back: "Can't be instantiated. May have abstract and concrete methods. Use extends." },
  { front: "Interface", back: "A contract of methods a class implements. A class can implement many interfaces." },
  { front: "Checked exception", back: "Checked at compile time, must be caught or declared with throws. Example: IOException." },
];

export function getDemo(now = new Date()) {
  // ---- Java internal tomorrow 10am (crash) ----
  const jStart = new Date(Math.floor(addMin(now, -55).getTime() / 300_000) * 300_000);
  const tonight = chain(
    jStart,
    [
      { title: "Inheritance and its types", unit: "Unit 3", minutes: 45 },
      { title: "Method overriding and dynamic dispatch", unit: "Unit 3", minutes: 45 },
      { title: "Exception handling: try, catch, finally, throws", unit: "Unit 4", minutes: 40 },
      { title: "Interfaces and abstract classes", unit: "Unit 3", minutes: 30 },
      { title: "10-question quiz on tonight's topics", kind: "checkpoint", minutes: 10 },
    ],
    "java",
  );
  const morning = chain(
    ist(now, 1, 6, 30),
    [
      { title: "Constructors and the this keyword", unit: "Unit 2", minutes: 40 },
      { title: "Threads and the thread life cycle", unit: "Unit 4", minutes: 35 },
      { title: "Redo the questions you got wrong", minutes: 25 },
      { title: "15-minute mock test", kind: "checkpoint", minutes: 15 },
    ],
    "java-am",
  );
  const javaDeadline = ist(now, 1, 10, 0);
  const javaSteps = [
    ...tonight.steps,
    ...morning.steps,
    { id: "java-exam", kind: "exam" as const, title: "Java internal", start: iso(javaDeadline), done: false },
  ];
  javaSteps[0].done = true;

  // ---- DBMS unit test in 3 days ----
  const dbDeadline = ist(now, 3, 11, 0);
  const db1 = chain(ist(now, 1, 18, 0), [
    { title: "ER diagrams: entities, attributes, cardinality", unit: "Unit 2", minutes: 50 },
    { title: "Keys: super, candidate, primary, foreign", unit: "Unit 2", minutes: 30 },
    { title: "Draw an ER diagram for a library", kind: "checkpoint", minutes: 15 },
  ], "db1");
  const db2 = chain(ist(now, 2, 18, 0), [
    { title: "Normal forms 1NF to BCNF", unit: "Unit 4", minutes: 60 },
    { title: "SQL joins, GROUP BY and subqueries", unit: "Unit 3", minutes: 50 },
    { title: "Normalise one table yourself", kind: "checkpoint", minutes: 15 },
  ], "db2");
  const dbSteps = [...db1.steps, ...db2.steps, { id: "db-exam", kind: "exam" as const, title: "DBMS unit test", start: iso(dbDeadline), done: false }];

  // ---- Python lab Friday-ish (5 days) ----
  const pyDeadline = ist(now, 5, 9, 30);
  const pySteps = [
    ...chain(ist(now, 2, 19, 0), [
      { title: "Lists, tuples and comprehensions", unit: "Unit 3", minutes: 45 },
      { title: "Dictionaries and sets", unit: "Unit 3", minutes: 40 },
    ], "py1").steps,
    ...chain(ist(now, 3, 19, 0), [
      { title: "File handling with the with statement", unit: "Unit 4", minutes: 40 },
      { title: "Write a word-count program from memory", kind: "checkpoint", minutes: 20 },
    ], "py2").steps,
    { id: "py-exam", kind: "exam" as const, title: "Python lab exam", start: iso(pyDeadline), done: false },
  ];

  // ---- Data structures semester (steady, 5 weeks) ----
  const dsDeadline = ist(now, 35, 10, 0);
  const dsSteps: PlanStep[] = [
    { id: "ds-w1", kind: "block", title: "Week 1: stacks, queues and their applications", start: iso(ist(now, 1, 17, 0)), minutes: 300, done: false },
    { id: "ds-w2", kind: "block", title: "Week 2: linked lists, all three kinds", start: iso(ist(now, 8, 17, 0)), minutes: 300, done: false },
    { id: "ds-c1", kind: "checkpoint", title: "Weekend checkpoint: 20 mixed questions", start: iso(ist(now, 13, 11, 0)), minutes: 40, done: false },
    { id: "ds-w3", kind: "block", title: "Week 3: trees and binary search trees", start: iso(ist(now, 15, 17, 0)), minutes: 300, done: false },
    { id: "ds-w4", kind: "block", title: "Week 4: sorting, searching and graphs", start: iso(ist(now, 22, 17, 0)), minutes: 300, done: false },
    { id: "ds-w5", kind: "block", title: "Week 5: revision loops (1, 3, 7 days)", start: iso(ist(now, 29, 17, 0)), minutes: 240, done: false },
    { id: "ds-exam", kind: "exam", title: "Data Structures semester exam", start: iso(dsDeadline), done: false },
  ];

  const plans: Plan[] = [
    { id: "p-java", sessionId: "java-internal", subject: "Java Programming", deadline: iso(javaDeadline), mode: "crash", hours: 4, steps: javaSteps },
    { id: "p-dbms", sessionId: "dbms-unit-test", subject: "Database Management Systems", deadline: iso(dbDeadline), mode: "crash", hours: 2.5, steps: dbSteps },
    { id: "p-python", sessionId: "python-lab", subject: "Python Programming", deadline: iso(pyDeadline), mode: "steady", hours: 2.5, steps: pySteps },
    { id: "p-ds", sessionId: "ds-semester", subject: "Data Structures", deadline: iso(dsDeadline), mode: "deep", hours: 25, steps: dsSteps },
  ];

  const sessions: Session[] = [
    { id: "java-internal", title: "Java internal", subject: "Java Programming", deadline: iso(javaDeadline), mode: "crash", updated: iso(addMin(now, -3)) },
    { id: "dbms-unit-test", title: "DBMS unit test", subject: "Database Management Systems", deadline: iso(dbDeadline), mode: "crash", updated: iso(addMin(now, -180)) },
    { id: "python-lab", title: "Python lab exam", subject: "Python Programming", deadline: iso(pyDeadline), mode: "steady", updated: iso(addMin(now, -60 * 26)) },
    { id: "ds-semester", title: "Data Structures sem exam", subject: "Data Structures", deadline: iso(dsDeadline), mode: "deep", updated: iso(addMin(now, -60 * 50)) },
  ];

  const files: StudyFile[] = [
    { id: "f1", sessionId: "java-internal", name: "Unit3_Inheritance.pdf", sizeBytes: 2_480_000, pages: 18, status: "ready", added: iso(addMin(now, -40)) },
    { id: "f2", sessionId: "java-internal", name: "Exceptions_slides.pptx", sizeBytes: 6_900_000, pages: 32, status: "processing", added: iso(addMin(now, -2)) },
    { id: "f3", sessionId: "java-internal", name: "notebook_page_14.jpg", sizeBytes: 1_200_000, status: "ready", added: iso(addMin(now, -35)) },
    { id: "f4", sessionId: "dbms-unit-test", name: "DBMS_Normalization.pdf", sizeBytes: 3_100_000, pages: 24, status: "ready", added: iso(addMin(now, -200)) },
    { id: "f5", sessionId: "dbms-unit-test", name: "Korth_full_textbook.pdf", sizeBytes: 71_000_000, status: "failed", error: "This file is over 50 MB. Split it into parts (for example by chapter) and upload each part.", added: iso(addMin(now, -190)) },
    { id: "f6", sessionId: "python-lab", name: "lab_programs.py", sizeBytes: 14_000, status: "ready", added: iso(addMin(now, -60 * 26)) },
  ];

  const t = (min: number) => iso(addMin(now, -min));
  const messages: Record<string, Message[]> = {
    "java-internal": [
      { id: "m1", role: "user", content: "Java internal tomorrow 10am, help me", at: t(70) },
      {
        id: "m2", role: "assistant", servedFrom: "ml", at: t(70),
        blocks: [{ type: "followup", text: "Got it: Java Programming, internal at 10:00 AM tomorrow. How many hours can you study tonight?", chips: ["2 hours", "3 hours", "4 hours", "5+ hours"], picked: "4 hours" }],
      },
      { id: "m3", role: "user", content: "4 hours", at: t(69) },
      {
        id: "m4", role: "assistant", servedFrom: "ml", at: t(69),
        blocks: [
          { type: "text", text: "Four good hours tonight and a short morning slot. Unit 3 carries the most marks, so it goes first. I've kept 11 PM to 6 AM free for sleep." },
          { type: "plan", planId: "p-java" },
        ],
      },
      { id: "m5", role: "user", content: "explain method overriding in kannada", at: t(40) },
      {
        id: "m6", role: "assistant", servedFrom: "llm", at: t(40),
        blocks: [{ type: "notes", topic: "Method overriding", text: JAVA_NOTES, sources: ["Unit3_Inheritance.pdf · p. 4"] }],
      },
      { id: "m7", role: "user", content: "important questions from @Unit3_Inheritance.pdf", at: t(30) },
      {
        id: "m8", role: "assistant", servedFrom: "llm", at: t(30),
        blocks: [{
          type: "questions", topic: "Unit 3: Inheritance and polymorphism",
          items: [
            { marks: 2, q: "Define method overriding." },
            { marks: 2, q: "What is the use of the super keyword?" },
            { marks: 5, q: "Differentiate method overloading and method overriding with examples." },
            { marks: 5, q: "Explain the types of inheritance supported by Java with diagrams." },
            { marks: 10, q: "Explain dynamic method dispatch with a Java program and its output." },
          ],
        }],
      },
      { id: "m9", role: "user", content: "quiz me", at: t(12) },
      { id: "m10", role: "assistant", servedFrom: "cache", at: t(12), blocks: [{ type: "quiz", topic: "Unit 3 and 4", questions: JAVA_QUIZ }] },
      { id: "m11", role: "user", content: "flashcards for revision", at: t(3) },
      { id: "m12", role: "assistant", servedFrom: "cache", at: t(3), blocks: [{ type: "flashcards", topic: "Unit 3 key terms", cards: JAVA_CARDS }] },
    ],
    "dbms-unit-test": [
      { id: "d1", role: "user", content: "DBMS unit test in 3 days, normalization tumba weak", at: t(185) },
      {
        id: "d2", role: "assistant", servedFrom: "ml", at: t(185),
        blocks: [
          { type: "text", text: "Three days, so two evening sessions with a checkpoint each. Normalization gets the biggest block because it's both high-mark and your weak spot." },
          { type: "plan", planId: "p-dbms" },
        ],
      },
    ],
    "python-lab": [
      { id: "py1", role: "user", content: "python lab exam on friday", at: t(60 * 26) },
      { id: "py2", role: "assistant", servedFrom: "ml", at: t(60 * 26), blocks: [{ type: "plan", planId: "p-python" }] },
    ],
    "ds-semester": [
      { id: "ds1", role: "user", content: "data structures sem exam in 5 weeks, I want to finish everything", at: t(60 * 50) },
      { id: "ds2", role: "assistant", servedFrom: "ml", at: t(60 * 50), blocks: [{ type: "text", text: "Five weeks is enough for every unit plus spaced revision. One unit a week, a checkpoint every weekend, and the last week only for revision." }, { type: "plan", planId: "p-ds" }] },
    ],
  };

  const profile = {
    username: "bipin.jr",
    fullName: "Bipin",
    university: "Bengaluru City University",
    course: "BCA",
    semester: 3,
    scheme: "SEP",
    language: "kn" as Lang,
    style: "short" as "short" | "detailed",
    formats: ["quiz", "flashcards", "notes", "important_questions"] as string[],
  };

  const usage = {
    messages: { used: 9, limit: 30, window: "10 minutes" },
    plans: { used: 2, limit: 10, window: "hour" },
    uploads: { used: 3, limit: 20, window: "day" },
    storageMb: { used: 41, limit: 300, window: "day" },
    servedLocally: 0.58,
  };

  return { now: iso(now), profile, sessions, plans, files, messages, usage };
}

export type Demo = ReturnType<typeof getDemo>;
