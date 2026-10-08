import { describe, expect, it } from "vitest";
import { parseDeadline, parseRequest } from "./parse";

// Thursday 2026-10-08, 8:30 PM IST
const NOW = new Date("2026-10-08T15:00:00Z");
const ist = (d: Date | undefined) =>
  d && new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", weekday: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);

describe("parseRequest intents and subjects", () => {
  it.each([
    ["Java internal tomorrow 10am, help me", "make_plan", "Java Programming"],
    ["nale Java test ide", "make_plan", "Java Programming"],
    ["kal DBMS ka exam hai", "make_plan", "Database Management Systems"],
    ["DBMS unit test in 3 days, normalization weak", "make_plan", "Database Management Systems"],
    ["python lab exam on friday", "make_plan", "Python Programming"],
    ["data structures sem exam in 5 weeks", "make_plan", "Data Structures"],
    ["OS internals in 2 hrs", "make_plan", "Operating Systems"],
    ["CN test day after tomorrow", "make_plan", "Computer Networks"],
    ["quiz me on inheritance", "make_quiz", "Java Programming"],
    ["give me flashcards for sql joins", "make_flashcards", "Database Management Systems"],
    ["important questions from unit 3 java", "important_questions", "Java Programming"],
    ["pyq style questions for stacks", "important_questions", "Data Structures"],
    ["explain method overriding in kannada", "explain_topic", "Java Programming"],
    ["what is normalization", "explain_topic", "Database Management Systems"],
    ["deadlock samjhao hindi mein", "explain_topic", "Operating Systems"],
    ["in unit3 notes, explain method overriding", "ask_about_file", "Java Programming"],
    ["summarise @Unit3_Inheritance.pdf", "ask_about_file", "Java Programming"],
    ["hi", "smalltalk", undefined],
    ["who won the cricket match", "out_of_scope", undefined],
  ])("%s", (text, intent, subject) => {
    const p = parseRequest(text, NOW);
    expect(p.intent).toBe(intent);
    expect(p.subject).toBe(subject);
  });

  it("picks up language and hours", () => {
    expect(parseRequest("explain interfaces in kannada", NOW).language).toBe("kn");
    expect(parseRequest("hindi mein samjhao deadlock, hindi", NOW).language).toBe("hi");
    expect(parseRequest("4 hours", NOW).hours).toBe(4);
    expect(parseRequest("I have 2.5 hrs tonight for java", NOW).hours).toBe(2.5);
    expect(parseRequest("java test in 2 hours", NOW).hours).toBeUndefined();
  });
});

describe("parseDeadline (Asia/Kolkata)", () => {
  it.each([
    ["tomorrow 10am", "Fri 09, 10:00"],
    ["nale 9:30 am", "Fri 09, 09:30"],
    ["kal", "Fri 09, 10:00"],
    ["in 2 hrs", "Thu 08, 22:30"],
    ["in 90 mins", "Thu 08, 22:00"],
    ["tonight", "Thu 08, 21:00"],
    ["in 3 days", "Sun 11, 10:00"],
    ["in 2 weeks", "Thu 22, 10:00"],
    ["on friday", "Fri 09, 10:00"],
    ["next monday", "Mon 12, 10:00"],
    ["day after tomorrow", "Sat 10, 10:00"],
    ["parso", "Sat 10, 10:00"],
    ["15/11", "Sun 15, 10:00"],
  ])("%s", (text, expected) => {
    expect(ist(parseDeadline(text, NOW))).toBe(expected);
  });

  it("returns undefined when there is no time", () => {
    expect(parseDeadline("explain stacks", NOW)).toBeUndefined();
  });

  it("sets the mode from the time left", () => {
    expect(parseRequest("java in 2 hrs", NOW).mode).toBe("sprint");
    expect(parseRequest("java tomorrow", NOW).mode).toBe("crash");
    expect(parseRequest("java in 2 weeks", NOW).mode).toBe("steady");
    expect(parseRequest("java in 2 months", NOW).mode).toBe("deep");
  });
});
