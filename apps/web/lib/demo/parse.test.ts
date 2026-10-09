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

describe("Kannada and Hindi script", () => {
  it.each([
    ["ನಾಳೆ ಜಾವಾ ಪರೀಕ್ಷೆ ಇದೆ", "make_plan", "Java Programming", "kn"],
    ["ನಾಳೆಗೆ ಡಿಬಿಎಂಎಸ್ ಟೆಸ್ಟ್", "make_plan", "Database Management Systems", "kn"],
    ["ಓವರ್‌ರೈಡಿಂಗ್ ವಿವರಿಸಿ", "explain_topic", "Java Programming", "kn"],
    ["ಜಾವಾ ರಸಪ್ರಶ್ನೆ", "make_quiz", "Java Programming", "kn"],
    ["ಜಾವಾ ಪ್ರಮುಖ ಪ್ರಶ್ನೆಗಳು", "important_questions", "Java Programming", "kn"],
    ["कल जावा की परीक्षा है", "make_plan", "Java Programming", "hi"],
    ["डेडलॉक समझाओ", "explain_topic", "Operating Systems", "hi"],
    ["डेटाबेस के महत्वपूर्ण सवाल", "important_questions", "Database Management Systems", "hi"],
    ["पायथन क्विज़", "make_quiz", "Python Programming", "hi"],
    ["नमस्ते", "smalltalk", undefined, "hi"],
  ])("%s", (text, intent, subject, language) => {
    const p = parseRequest(text, NOW);
    expect(p.intent).toBe(intent);
    expect(p.subject).toBe(subject);
    expect(p.language).toBe(language);
  });

  it.each([
    ["ನಾಳೆ", "Fri 09, 10:00"],
    ["ನಾಳೆ ಬೆಳಿಗ್ಗೆ ೯:೩೦", "Fri 09, 09:30"],
    ["ನಾಳೆ ೧೧ ಗಂಟೆಗೆ", "Fri 09, 11:00"],
    ["ನಾಡಿದ್ದು", "Sat 10, 10:00"],
    ["೨ ಗಂಟೆಯಲ್ಲಿ", "Thu 08, 22:30"],
    ["೩ ದಿನದಲ್ಲಿ", "Sun 11, 10:00"],
    ["ಸೋಮವಾರ", "Mon 12, 10:00"],
    ["कल", "Fri 09, 10:00"],
    ["कल सुबह १० बजे", "Fri 09, 10:00"],
    ["परसों शाम ५ बजे", "Sat 10, 17:00"],
    ["२ घंटे में", "Thu 08, 22:30"],
    ["३ दिन में", "Sun 11, 10:00"],
    ["2 हफ्ते में", "Thu 22, 10:00"],
    ["शुक्रवार", "Fri 09, 10:00"],
  ])("%s", (text, expected) => {
    expect(ist(parseDeadline(text, NOW))).toBe(expected);
  });

  it("reads native digits as hours", () => {
    expect(parseRequest("ದಿನಕ್ಕೆ ೪ ಗಂಟೆ ಓದಬಹುದು", NOW).hours).toBe(4);
    expect(parseRequest("रोज़ ३ घंटे पढ़ाई", NOW).hours).toBe(3);
  });
});

describe("Kannada and Hindi typed in English letters", () => {
  it.each([
    ["nale java exam ide", "make_plan", "Java Programming", "kn"],
    ["overriding bagge heli", "explain_topic", "Java Programming", "kn"],
    ["normalization artha agilla, swalpa explain maadi", "explain_topic", "Database Management Systems", "kn"],
    ["java mukhya prashnegalu kodi", "important_questions", "Java Programming", "kn"],
    ["dbms 3 dinadalli exam ide", "make_plan", "Database Management Systems", "kn"],
    ["kal DBMS ka exam hai", "make_plan", "Database Management Systems", "hi"],
    ["deadlock kya hai samjhao", "explain_topic", "Operating Systems", "hi"],
    ["java ke important sawal batao", "important_questions", "Java Programming", "hi"],
    ["mujhe python padhai ka plan chahiye", "make_plan", "Python Programming", "hi"],
    ["Java internal tomorrow 10am, help me", "make_plan", "Java Programming", undefined],
    ["explain normalization", "explain_topic", "Database Management Systems", undefined],
  ])("%s", (text, intent, subject, language) => {
    const p = parseRequest(text, NOW);
    expect(p.intent).toBe(intent);
    expect(p.subject).toBe(subject);
    expect(p.language).toBe(language);
  });

  it.each([
    ["3 dinadalli", "Sun 11, 10:00"],
    ["2 ganteyalli", "Thu 08, 22:30"],
    ["nale belige 9 gantege", "Fri 09, 09:00"],
    ["somavara", "Mon 12, 10:00"],
    ["3 din mein", "Sun 11, 10:00"],
    ["2 ghante mein", "Thu 08, 22:30"],
    ["kal subah 10 baje", "Fri 09, 10:00"],
    ["parso shaam 5 baje", "Sat 10, 17:00"],
    ["shukravar", "Fri 09, 10:00"],
  ])("%s", (text, expected) => {
    expect(ist(parseDeadline(text, NOW))).toBe(expected);
  });

  it("explicit language beats the guess", () => {
    expect(parseRequest("nale java exam ide, english alli heli", NOW).language).toBe("en");
  });
});
