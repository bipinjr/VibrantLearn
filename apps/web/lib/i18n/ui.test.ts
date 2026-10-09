import { describe, expect, it } from "vitest";
import { parseRequest } from "@/lib/demo/parse";
import { ago, dayLabel, timeLeft } from "@/lib/format";
import { placeholderMismatches, translate } from "./ui";

describe("interface translations", () => {
  it("every translation keeps the same {placeholders}", () => {
    expect(placeholderMismatches()).toEqual([]);
  });

  it("fills placeholders and falls back to English", () => {
    expect(translate("kn", "{a} of {b}", { a: 3, b: 9 })).toBe("9 ರಲ್ಲಿ 3");
    expect(translate("hi", "Semester {n}", { n: 4 })).toBe("सेमेस्टर 4");
    expect(translate("en", "Semester {n}", { n: 4 })).toBe("Semester 4");
    expect(translate("kn", "Not in the dictionary")).toBe("Not in the dictionary");
  });

  it("relative times read naturally", () => {
    const now = "2026-10-08T15:00:00Z"; // 8:30 PM IST
    expect(dayLabel("2026-10-09T04:30:00Z", now, "kn")).toBe("ನಾಳೆ ಬೆಳಿಗ್ಗೆ");
    expect(dayLabel("2026-10-09T04:30:00Z", now, "hi")).toBe("कल सुबह");
    expect(timeLeft("2026-10-11T15:00:00Z", now, "hi")).toBe("3 दिन");
    expect(ago("2026-10-08T14:50:00Z", now, "kn")).toBe("10 ನಿಮಿಷದ ಹಿಂದೆ");
  });

  it("the Kannada and Hindi quick-start chips still parse", () => {
    const NOW = new Date("2026-10-08T15:00:00Z");
    expect(parseRequest("nale 10 gantege Java internal", NOW)).toMatchObject({ intent: "make_plan", subject: "Java Programming", language: "kn" });
    expect(parseRequest("Stacks mele quiz kodi", NOW)).toMatchObject({ intent: "make_quiz", subject: "Data Structures" });
    expect(parseRequest("Deadlock bagge Kannadadalli heli", NOW)).toMatchObject({ intent: "explain_topic", language: "kn" });
    expect(parseRequest("kal subah 10 baje Java internal hai", NOW)).toMatchObject({ intent: "make_plan", language: "hi" });
    expect(parseRequest("Stacks par quiz lo", NOW)).toMatchObject({ intent: "make_quiz", subject: "Data Structures" });
    expect(parseRequest("Deadlock Hindi mein samjhao", NOW)).toMatchObject({ intent: "explain_topic", language: "hi" });
  });
});
