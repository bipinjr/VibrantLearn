// Demo-mode request understanding (PRD F5), no LLM. The production version lives in apps/api/app/ml.
import type { Lang, Mode } from "./data";

export type Intent =
  | "make_plan"
  | "important_questions"
  | "make_quiz"
  | "make_flashcards"
  | "explain_topic"
  | "ask_about_file"
  | "smalltalk"
  | "out_of_scope";

export type Parsed = {
  intent: Intent;
  subject?: string;
  deadline?: Date;
  hours?: number;
  language?: Lang;
  mode?: Mode;
  topicHint?: string;
};

const SUBJECTS: [RegExp, string][] = [
  [/\bjava\b|inheritance|overrid|polymorph|applet|jvm/, "Java Programming"],
  [/\bpython\b|\bpy\b|lambda|dictionar|tuple/, "Python Programming"],
  [/\bdbms\b|database|\bsql\b|normali[sz]|\ber diagram|transaction/, "Database Management Systems"],
  [/data ?structures?|\bdsa?\b|linked ?list|\bstack|\bqueue|binary tree|\bbst\b/, "Data Structures"],
  [/computer networks?|\bnetworks?\b|\bcn\b|subnet|osi model|tcp/, "Computer Networks"],
  [/operating systems?|\bos\b|deadlock|paging|cpu scheduling|semaphore/, "Operating Systems"],
];

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const IST = 330 * 60_000;

/** IST wall-clock -> Date. dayOffset from today's IST date. */
function istAt(now: Date, dayOffset: number, h: number, m = 0): Date {
  const l = new Date(now.getTime() + IST);
  return new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate() + dayOffset, h, m) - IST);
}

function readClock(s: string): { h: number; m: number } | null {
  const t = s.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/) ?? s.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\b/);
  if (!t) return null;
  let h = Number(t[1]);
  const m = Number(t[2] ?? 0);
  if (t[3] === "pm" && h < 12) h += 12;
  if (t[3] === "am" && h === 12) h = 0;
  if (!t[3] && h < 8) h += 12; // "at 5" for an exam means 5 PM
  return h < 24 && m < 60 ? { h, m } : null;
}

export function parseDeadline(text: string, now: Date): Date | undefined {
  const s = text.toLowerCase();
  const clock = readClock(s);
  const day = (offset: number) => istAt(now, offset, clock?.h ?? 10, clock?.m ?? 0);

  let m = s.match(/\bin\s+(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours|ghante|ganta|gante)\b/);
  if (m) return new Date(now.getTime() + Number(m[1]) * 3_600_000);
  m = s.match(/\bin\s+(\d+)\s*(?:m|min|mins|minutes)\b/);
  if (m) return new Date(now.getTime() + Number(m[1]) * 60_000);
  if (/day after tomorrow|parso|naadidu|nadidu/.test(s)) return day(2);
  if (/\b(tomorrow|tmrw|tmr|nale|naale|kal)\b/.test(s)) return day(1);
  if (/\btonight\b|\bivattu raatri\b|\baaj raat\b/.test(s)) return istAt(now, 0, clock?.h ?? 21, clock?.m ?? 0);
  if (/\btoday\b|\bivattu\b|\baaj\b/.test(s) && clock) return day(0);
  m = s.match(/\bin\s+(\d+)\s*days?\b|\b(\d+)\s*days?\s*(?:left|later|baaki|alli)\b/);
  if (m) return day(Number(m[1] ?? m[2]));
  m = s.match(/\bin\s+(\d+)\s*weeks?\b|\b(\d+)\s*weeks?\b/);
  if (m) return day(7 * Number(m[1] ?? m[2]));
  m = s.match(/\b(\d+)\s*months?\b/);
  if (m) return day(30 * Number(m[1]));
  m = s.match(/\b(\d{1,2})\/(\d{1,2})\b/);
  if (m) {
    const l = new Date(now.getTime() + IST);
    let target = new Date(Date.UTC(l.getUTCFullYear(), Number(m[2]) - 1, Number(m[1]), clock?.h ?? 10, clock?.m ?? 0) - IST);
    if (target < now) target = new Date(Date.UTC(l.getUTCFullYear() + 1, Number(m[2]) - 1, Number(m[1]), 10) - IST);
    return target;
  }
  const wd = WEEKDAYS.findIndex((d) => new RegExp(`\\b${d}|\\b${d.slice(0, 3)}\\b`).test(s));
  if (wd >= 0) {
    const today = new Date(now.getTime() + IST).getUTCDay();
    const diff = (wd - today + 7) % 7 || 7; // "monday" = the coming Monday
    return day(diff);
  }
  return undefined;
}

export function modeFor(deadline: Date, now: Date): Mode {
  const h = (deadline.getTime() - now.getTime()) / 3_600_000;
  if (h <= 6) return "sprint";
  if (h <= 72) return "crash";
  if (h <= 24 * 28) return "steady";
  return "deep";
}

export function parseRequest(text: string, now: Date): Parsed {
  const s = text.toLowerCase().normalize("NFKC");
  const subject = SUBJECTS.find(([re]) => re.test(s))?.[1];
  const deadline = parseDeadline(s, now);
  const H = "(?:h|hr|hrs|hours?|ghante|gante|ganta)";
  const noDeadlinePhrase = s.replace(new RegExp(String.raw`\bin\s+\d+(?:\.\d+)?\s*${H}\b`, "g"), "");
  const hm = noDeadlinePhrase.match(new RegExp(String.raw`\b(\d+(?:\.\d+)?)\s*\+?\s*${H}\b`));
  const hours = hm ? Number(hm[1]) : undefined;
  const language: Lang | undefined = /kannada|ಕನ್ನಡ/.test(s) ? "kn" : /hindi|हिन्दी|हिंदी/.test(s) ? "hi" : /english/.test(s) ? "en" : undefined;

  let intent: Intent;
  if (/\bquiz|\bmcq|test me|quiz me/.test(s)) intent = "make_quiz";
  else if (/flash ?cards?|\bcards\b/.test(s)) intent = "make_flashcards";
  else if (/important q|imp q|likely q|\bpyq|previous year|questions? (from|for|on)|exam questions/.test(s)) intent = "important_questions";
  else if (/@\S+\.(pdf|pptx|docx|txt|md|jpg|png|py)|\bin (my |the )?\w*\s?notes\b|\bunit ?\d+ notes\b/.test(s)) intent = "ask_about_file";
  else if (/\bexplain|what is|what are|\bdefine|notes on|samjhao|samjha|artha|meaning of|difference between/.test(s)) intent = "explain_topic";
  else if (deadline || /\b(exam|test|internal|internals|sem|semester|plan|prepare|study|revision|ide|hai)\b/.test(s) || hours) intent = "make_plan";
  else if (/^(hi|hey|hello|thanks|thank you|ok|okay|namaskara|namaste)\b/.test(s)) intent = "smalltalk";
  else if (subject) intent = "explain_topic";
  else intent = "out_of_scope";

  const topicHint = s.match(/(?:explain|what is|what are|define|notes on|about)\s+([a-z0-9 ,'-]{3,60})/)?.[1]?.replace(/\b(in|from) (kannada|hindi|english)\b.*$/, "").trim();

  return {
    intent,
    subject,
    deadline,
    hours,
    language,
    mode: deadline ? modeFor(deadline, now) : undefined,
    topicHint,
  };
}
