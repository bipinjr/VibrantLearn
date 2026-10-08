// Sample note shown beside onboarding so the preview explains the choices.
import { OVERRIDING, type Lang, type Style } from "@/lib/demo/notes-i18n";

export type { Lang, Style };
export const SAMPLE_NOTE = OVERRIDING;

export const FORMAT_LABELS = {
  quiz: "Quizzes",
  flashcards: "Flashcards",
  notes: "Short notes",
  important_questions: "Important questions",
  pyq: "Past-paper style questions",
  timetable: "Timetable",
} as const;

export type Format = keyof typeof FORMAT_LABELS;
