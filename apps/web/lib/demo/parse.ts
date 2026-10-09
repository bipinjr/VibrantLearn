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

// Kannada and Devanagari script -> the Latin words the rules below already know. Substring
// replacement on purpose: Kannada/Hindi add suffixes (ನಾಳೆಗೆ, परीक्षाओं), and JS `\b` doesn't see
// Indic letters as word characters. Longest keys are replaced first (ಸೋಮವಾರ before ವಾರ).
const SCRIPT_WORDS: Record<string, string> = {
  // time
  "ನಾಡಿದ್ದು": "naadidu", "ನಾಳೆ": "nale", "ಇವತ್ತು": "ivattu", "ಇಂದು": "ivattu", "ರಾತ್ರಿ": "raatri",
  "ಗಂಟೆ": "gante", "ನಿಮಿಷ": "min", "ದಿನ": "days", "ವಾರ": "weeks", "ತಿಂಗಳು": "months", "ತಿಂಗಳ": "months", "ಬಾಕಿ": "baaki",
  "ಭಾನುವಾರ": "sunday", "ಸೋಮವಾರ": "monday", "ಮಂಗಳವಾರ": "tuesday", "ಬುಧವಾರ": "wednesday",
  "ಗುರುವಾರ": "thursday", "ಶುಕ್ರವಾರ": "friday", "ಶನಿವಾರ": "saturday",
  "परसों": "parso", "कल": "kal", "आज": "aaj", "रात": "raat", "घंटे": "ghante", "घंटा": "ghante", "मिनट": "min",
  "दिन": "days", "हफ़्ते": "weeks", "हफ्ते": "weeks", "हफ्ता": "weeks", "सप्ताह": "weeks", "महीने": "months", "महीना": "months", "बाकी": "baaki",
  "रविवार": "sunday", "सोमवार": "monday", "मंगलवार": "tuesday", "बुधवार": "wednesday",
  "गुरुवार": "thursday", "शुक्रवार": "friday", "शनिवार": "saturday",
  // exams and requests
  "ಪರೀಕ್ಷೆ": "exam", "ಎಕ್ಸಾಮ್": "exam", "ಟೆಸ್ಟ್": "test", "ಇಂಟರ್ನಲ್": "internal", "ಇದೆ": "ide",
  "ಯೋಜನೆ": "plan", "ಓದು": "study", "ರಸಪ್ರಶ್ನೆ": "quiz", "ಕ್ವಿಜ್": "quiz", "ಫ್ಲ್ಯಾಶ್‌ಕಾರ್ಡ್": "flashcards", "ಫ್ಲಾಶ್ ಕಾರ್ಡ್": "flashcards",
  "ಪ್ರಮುಖ": "important", "ಮುಖ್ಯ": "important", "ಪ್ರಶ್ನೆ": "questions", "ವಿವರಿಸಿ": "explain", "ವಿವರಿಸು": "explain",
  "ಎಂದರೇನು": "explain", "ಅರ್ಥ": "artha", "ಕಷ್ಟ": "kashta", "ನಮಸ್ಕಾರ": "namaskara", "ಹಿಂದಿ": "hindi", "ಇಂಗ್ಲಿಷ್": "english",
  "परीक्षा": "exam", "इम्तिहान": "exam", "एग्जाम": "exam", "टेस्ट": "test", "इंटरनल": "internal", "है": "hai",
  "योजना": "plan", "पढ़ाई": "study", "पढ़ना": "study", "क्विज़": "quiz", "क्विज": "quiz", "फ्लैशकार्ड": "flashcards", "फ़्लैशकार्ड": "flashcards",
  "महत्वपूर्ण": "important", "ज़रूरी": "important", "जरूरी": "important", "प्रश्न": "questions", "सवाल": "questions",
  "समझाओ": "samjhao", "समझाइए": "samjhao", "समझा": "samjha", "क्या है": "explain", "मतलब": "meaning of", "कठिन": "difficult", "मुश्किल": "difficult",
  "नमस्ते": "namaste", "कन्नड़": "kannada", "अंग्रेज़ी": "english", "अंग्रेजी": "english",
  // subjects and common topics
  "ಜಾವಾ": "java", "ಪೈಥಾನ್": "python", "ಡಿಬಿಎಂಎಸ್": "dbms", "ಡೇಟಾಬೇಸ್": "database", "ಓವರ್ರೈಡಿಂಗ್": "overriding",
  "ಇನ್ಹೆರಿಟೆನ್ಸ್": "inheritance", "ನಾರ್ಮಲೈಸೇಶನ್": "normalization", "ಡೆಡ್‌ಲಾಕ್": "deadlock", "ಡೆಡ್ಲಾಕ್": "deadlock", "ಸ್ಟ್ಯಾಕ್": "stack",
  "जावा": "java", "पायथन": "python", "डीबीएमएस": "dbms", "डेटाबेस": "database", "ओवरराइडिंग": "overriding",
  "इनहेरिटेंस": "inheritance", "नॉर्मलाइजेशन": "normalization", "डेडलॉक": "deadlock", "स्टैक": "stack",
};
const SCRIPT_KEYS = Object.keys(SCRIPT_WORDS).map((k) => k.replace(/‌|‍/g, "")).sort((a, b) => b.length - a.length);
const SCRIPT_RE = new RegExp(SCRIPT_KEYS.join("|"), "g");
const SCRIPT_MAP = new Map(Object.entries(SCRIPT_WORDS).map(([k, v]) => [k.replace(/‌|‍/g, ""), v]));

/** Native-script digits and words -> ASCII/Latin, so "ನಾಳೆ ೧೦ ಗಂಟೆಗೆ ಜಾವಾ ಪರೀಕ್ಷೆ" parses like "nale at 10 java exam". */
export function toLatin(text: string): string {
  let s = text
    .normalize("NFC")
    .replace(/[‌‍]/g, "")
    .replace(/[೦-೯]/g, (d) => String(d.charCodeAt(0) - 0x0ce6))
    .replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - 0x0966));
  if (/[ಀ-೿ऀ-ॿ]/.test(s)) s = scriptToLatin(s);
  return romanToEnglish(s);
}

function scriptToLatin(text: string): string {
  let s = text;
  const N = String.raw`(\d+(?:\.\d+)?)`;
  const C = String.raw`(\d{1,2}(?::\d{2})?)`;
  s = s
    // "ಬೆಳಿಗ್ಗೆ 10" / "सुबह 10 बजे" = 10 am; "ಸಂಜೆ 5" / "शाम 5 बजे" = 5 pm
    .replace(new RegExp(String.raw`(?:ಬೆಳಿಗ್ಗೆ|ಬೆಳಗ್ಗೆ|सुबह)\s*${C}\s*(?:ಗಂಟೆಗೆ|बजे)?`, "g"), " $1 am ")
    .replace(new RegExp(String.raw`(?:ಸಂಜೆ|ಮಧ್ಯಾಹ್ನ|शाम|दोपहर)\s*${C}\s*(?:ಗಂಟೆಗೆ|बजे)?`, "g"), " $1 pm ")
    .replace(new RegExp(String.raw`${C}\s*(?:ಗಂಟೆಗೆ|बजे)`, "g"), " at $1 ")
    // "2 ಗಂಟೆಯಲ್ಲಿ" / "2 घंटे में" = in 2 hours; same for minutes, days, weeks
    .replace(new RegExp(String.raw`${N}\s*(?:ಗಂಟೆಯಲ್ಲಿ|ಗಂಟೆಗಳಲ್ಲಿ|घंटे में|घंटों में)`, "g"), " in $1 hours ")
    .replace(new RegExp(String.raw`${N}\s*(?:ನಿಮಿಷದಲ್ಲಿ|ನಿಮಿಷಗಳಲ್ಲಿ|मिनट में)`, "g"), " in $1 min ")
    .replace(new RegExp(String.raw`${N}\s*(?:ದಿನದಲ್ಲಿ|ದಿನಗಳಲ್ಲಿ|दिन में|दिनों में)`, "g"), " in $1 days ")
    .replace(new RegExp(String.raw`${N}\s*(?:ವಾರದಲ್ಲಿ|ವಾರಗಳಲ್ಲಿ|हफ्ते में|हफ़्ते में|हफ्तों में)`, "g"), " in $1 weeks ")
    .replace(SCRIPT_RE, (w) => ` ${SCRIPT_MAP.get(w)} `);
  return s.replace(/\s+/g, " ").trim();
}

// Kannada/Hindi typed in English letters: "3 dinadalli", "2 ghante mein", "belige 10 gantege".
const ROMAN_WEEKDAYS: Record<string, string> = {
  bhanuvara: "sunday", somavara: "monday", mangalavara: "tuesday", budhavara: "wednesday", guruvara: "thursday", shukravara: "friday", shanivara: "saturday",
  ravivar: "sunday", somvar: "monday", mangalvar: "tuesday", budhvar: "wednesday", guruvar: "thursday", shukravar: "friday", shanivar: "saturday",
};
const ROMAN_WEEKDAY_RE = new RegExp(String.raw`\b(${Object.keys(ROMAN_WEEKDAYS).join("|")})\b`, "gi");

function romanToEnglish(text: string): string {
  const N = String.raw`(\d+(?:\.\d+)?)\s*`;
  const C = String.raw`(\d{1,2}(?::\d{2})?)\s*`;
  const AT = "(?:gantege|ganteg|baje)";
  const rx = (body: string) => new RegExp(String.raw`\b${body}\b`, "gi");
  return text
    .replace(rx(String.raw`(?:belige|beligge|belagge|subah|subha)\s+${C}${AT}?`), "$1 am ")
    .replace(rx(String.raw`(?:sanje|madhyahna|shaam|sham|dopahar)\s+${C}${AT}?`), "$1 pm ")
    .replace(rx(`${C}${AT}`), "at $1 ")
    .replace(rx(`${N}(?:ganteyalli|gantealli|gante alli|ghante (?:mein|me|main)|ghanton mein)`), "in $1 hours ")
    .replace(rx(`${N}(?:nimishadalli|minute (?:mein|me)|min (?:mein|me))`), "in $1 min ")
    .replace(rx(`${N}(?:dinadalli|dina alli|dinagalalli|din (?:mein|me|main)|dino mein)`), "in $1 days ")
    .replace(rx(`${N}(?:varadalli|vaaradalli|hafte (?:mein|me|main)|hafton mein)`), "in $1 weeks ")
    .replace(rx(`${N}(?:dina|din)`), "$1 days ")
    .replace(rx(`${N}(?:vaara|vara|hafte|hafta)`), "$1 weeks ")
    .replace(rx(`${N}(?:tingalu|tingala|mahine|mahina)`), "$1 months ")
    .replace(ROMAN_WEEKDAY_RE, (w) => ROMAN_WEEKDAYS[w.toLowerCase()])
    .replace(/\s+/g, " ")
    .trim();
}

// Words that only show up when someone writes Kannada or Hindi in English letters.
const KANGLISH = /\b(nale|naale|naadidu|nadidu|ivattu|ide|idhe|illa|beku|bekagide|maadi|madi|maadu|madu|heli|helu|helkodi|bagge|enu|yenu|yaake|hege|hegge|swalpa|tumba|gottilla|gothilla|artha|aagilla|agilla|kashta|odbeku|odu|oduttini|saaku|alli|dalli|kodi|kodu|namaskara|prashne|prashnegalu|mukhya|gantege|dinadalli|ganteyalli|belige|sanje|nanage|nange|nanna|nimma|hosa|hegiddira)\b/g;
const HINGLISH = /\b(kal|parso|parson|hai|hain|kya|kaise|kyun|kyu|mujhe|mera|meri|mere|samjhao|samjha|samjhaiye|batao|bataiye|karo|chahiye|nahi|nahin|aaj|raat|ghante|ghanta|hafte|mahine|mein|padhai|padhna|yaad|sawal|sawaal|namaste|accha|acha|thoda|zaroori|jaruri|kitne|baje|subah|shaam)\b/g;

/** Kannada or Hindi written in English letters? Needs 2 such words, or 1 in a short message. */
export function detectRomanLang(text: string): Lang | undefined {
  const s = text.toLowerCase();
  const kn = s.match(KANGLISH)?.length ?? 0;
  const hi = s.match(HINGLISH)?.length ?? 0;
  const need = s.split(/\s+/).filter(Boolean).length <= 4 ? 1 : 2;
  if (kn >= need && kn > hi) return "kn";
  if (hi >= need && hi > kn) return "hi";
  return undefined;
}

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
  const s = toLatin(text).toLowerCase();
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
  const raw = text.normalize("NFC");
  const s = toLatin(text).toLowerCase().normalize("NFKC");
  const subject = SUBJECTS.find(([re]) => re.test(s))?.[1];
  const deadline = parseDeadline(s, now);
  const H = "(?:h|hr|hrs|hours?|ghante|gante|ganta)";
  const noDeadlinePhrase = s.replace(new RegExp(String.raw`\bin\s+\d+(?:\.\d+)?\s*${H}\b`, "g"), "");
  const hm = noDeadlinePhrase.match(new RegExp(String.raw`\b(\d+(?:\.\d+)?)\s*\+?\s*${H}\b`));
  const hours = hm ? Number(hm[1]) : undefined;
  const language: Lang | undefined = /kannada|ಕನ್ನಡ/.test(s) ? "kn" : /hindi|हिन्दी|हिंदी/.test(s) ? "hi" : /english/.test(s) ? "en"
    : /[ಀ-೿]/.test(raw) ? "kn" : /[ऀ-ॿ]/.test(raw) ? "hi" // typed in script = answer in it
    : detectRomanLang(raw); // "nale java exam ide" = Kannada in English letters

  let intent: Intent;
  if (/\bquiz|\bmcq|test me|quiz me|rasaprashne/.test(s)) intent = "make_quiz";
  else if (/flash ?cards?|\bcards\b/.test(s)) intent = "make_flashcards";
  else if (/important q|imp q|likely q|\bpyq|previous year|questions? (from|for|on)|exam questions|\bprashne|\bsawaa?l\b/.test(s)) intent = "important_questions";
  else if (/@\S+\.(pdf|pptx|docx|txt|md|jpg|png|py)|\bin (my |the )?\w*\s?notes\b|\bunit ?\d+ notes\b/.test(s)) intent = "ask_about_file";
  else if (/\bexplain|what is|what are|\bdefine|notes on|samjhao|samjha|artha|meaning of|difference between|\b(bagge|heli|helkodi|batao|bataiye|enu|yenu)\b|kya (hai|hota)/.test(s)) intent = "explain_topic";
  else if (deadline || /\b(exam|test|internal|internals|sem|semester|plan|prepare|study|revision|ide|idhe|hai|pariksha|odbeku|padhai)\b/.test(s) || hours) intent = "make_plan";
  else if (/^(hi|hey|hello|thanks|thank you|ok|okay|namaskara|namaste|hegiddira|kaise ho)\b/.test(s)) intent = "smalltalk";
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
