import { describe, expect, it } from "vitest";
import { respond, weakTopics, type Pending } from "./respond";

const NOW = new Date("2026-10-08T15:00:00Z"); // Thu 8:30 PM IST
const ctx = (pending?: Pending | null, files = [] as Parameters<typeof respond>[1]["files"]) => ({
  now: NOW,
  language: "kn" as const,
  pending,
  files,
  seen: new Set<string>(),
});

describe("respond: message in, study material out", () => {
  it("full plan conversation: request -> hours follow-up -> plan", () => {
    const first = respond("kal OS ka exam hai", ctx());
    expect(first.plan).toBeUndefined();
    expect(first.pending?.awaiting).toBe("hours");
    expect(first.blocks[0].type).toBe("followup");

    const second = respond("3 hours", ctx(first.pending));
    expect(second.plan?.subject).toBe("Operating Systems");
    expect(second.plan?.mode).toBe("crash");
    expect(second.plan?.steps.at(-1)?.kind).toBe("exam");
    expect(second.sessionPatch?.title).toBe("Operating Systems test");
    expect(second.servedFrom).toBe("ml");
  });

  it("asks for the subject, then the deadline, when both are missing", () => {
    const a = respond("help me plan my exam", ctx());
    expect(a.pending?.awaiting).toBe("subject");
    const b = respond("Data Structures", ctx(a.pending));
    expect(b.pending?.awaiting).toBe("deadline");
    const c = respond("In a month", ctx(b.pending));
    expect(c.plan?.mode).toBe("deep");
  });

  it("puts the topic the student called weak first", () => {
    expect(weakTopics("nale DBMS test ide, normalization weak")).toEqual(["normalization"]);
    expect(weakTopics("os exam tomorrow, I struggle with deadlocks")).toEqual(["deadlocks"]);
    const asked = respond("nale DBMS test ide, normalization weak", ctx());
    const plan = respond("2 hours", ctx(asked.pending));
    const first = plan.plan?.steps.find((s) => s.kind === "block");
    expect(first?.title).toMatch(/Normal forms|Functional dependencies/);
    expect(plan.blocks[0].type === "text" && plan.blocks[0].text).toMatch(/weak spot/);
  });

  it("sprint plans need no follow-up", () => {
    const r = respond("java test in 2 hrs", ctx());
    expect(r.plan?.mode).toBe("sprint");
  });

  it("explains a topic in all three languages and caches the repeat", () => {
    const c = ctx();
    const r = respond("explain normalization", c);
    const notes = r.blocks[0];
    expect(notes.type).toBe("notes");
    if (notes.type === "notes") {
      expect(notes.topic).toBe("Normal forms 1NF to BCNF");
      expect(notes.text.kn).toMatch(/[ಀ-೿]/); // Kannada script
      expect(notes.text.hi).toMatch(/[ऀ-ॿ]/); // Devanagari
    }
    expect(r.servedFrom).toBe("llm");
    expect(respond("explain normalization", c).servedFrom).toBe("cache");
  });

  it("makes quizzes, flashcards and 2/5/10-mark questions", () => {
    const q = respond("quiz me on java", ctx()).blocks[0];
    expect(q.type === "quiz" && q.questions.length).toBe(5);
    const f = respond("flashcards for dbms", ctx()).blocks[0];
    expect(f.type === "flashcards" && f.cards.length).toBeGreaterThan(3);
    const iq = respond("important questions for operating systems", ctx()).blocks[0];
    expect(iq.type === "questions" && [...new Set(iq.items.map((i) => i.marks))].sort()).toEqual([10, 2, 5]);
  });

  it("answers from a ready file with a source chip, and says when a file is still processing", () => {
    const files = [
      { id: "f1", sessionId: "s", name: "Unit3_Inheritance.pdf", sizeBytes: 1, pages: 18, status: "ready" as const, added: "" },
      { id: "f2", sessionId: "s", name: "Exceptions_slides.pptx", sizeBytes: 1, status: "processing" as const, added: "" },
    ];
    const ok = respond("in unit3 notes explain method overriding", ctx(null, files)).blocks[0];
    expect(ok.type === "text" && ok.sources?.[0]).toMatch(/Unit3_Inheritance\.pdf · p\. \d+/);
    const wait = respond("summarise @Exceptions_slides.pptx", ctx(null, files)).blocks[0];
    expect(wait.type === "text" && wait.text).toMatch(/still being processed/);
  });

  it("sends open questions to the AI, with a local fallback ready", () => {
    for (const q of ["who won the cricket match", "what is photosynthesis", "how do I stay focused while studying?"]) {
      const r = respond(q, ctx());
      expect(r.open, q).toBe(q);
      expect(r.blocks[0].type).toBe("followup");
      expect(r.plan).toBeUndefined();
    }
  });

  it("answers greetings, thanks, help and gibberish without dead ends", () => {
    expect(respond("hi", ctx()).blocks[0].type).toBe("followup");
    expect(respond("thanks!", ctx()).blocks[0]).toMatchObject({ type: "text" });
    const help = respond("what can you do", ctx()).blocks[0];
    expect(help.type === "followup" && help.text).toMatch(/plan your study hours/);
    const junk = respond("??? !!", ctx()).blocks[0];
    expect(junk.type === "followup" && junk.text).toMatch(/didn't catch that/);
  });

  it("re-asks politely when a follow-up answer doesn't fit, and lets the student change topic", () => {
    const asked = respond("kal OS ka exam hai", ctx());
    const unclear = respond("not sure", ctx(asked.pending));
    const block = unclear.blocks[0];
    expect(block.type === "followup" && block.text).toMatch(/didn't catch the number of hours/);
    expect(unclear.pending?.awaiting).toBe("hours");

    const switched = respond("quiz me on java", ctx(asked.pending));
    expect(switched.blocks[0].type).toBe("quiz");
  });

  it("answers in the language the student typed in, and asks the AI for real notes", () => {
    const kn = respond("normalization bagge heli", { ...ctx(), language: "en" });
    expect(kn.lang).toBe("kn");
    expect(kn.blocks[0]).toMatchObject({ type: "notes", lang: "kn" });
    expect(kn.aiNotes).toEqual({ subject: "Database Management Systems", topic: "Normal forms 1NF to BCNF" });

    const hi = respond("डेडलॉक समझाओ", { ...ctx(), language: "en" });
    expect(hi.lang).toBe("hi");

    // Method overriding has hand-written notes in all three languages: no AI call.
    expect(respond("explain method overriding", ctx()).aiNotes).toBeUndefined();
  });
});
