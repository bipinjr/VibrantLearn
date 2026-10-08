import { describe, expect, it } from "vitest";
import { clock, dayLabel, timeLeft, timeRange } from "./format";

// 2026-10-08 20:30 IST == 15:00 UTC
const NOW = "2026-10-08T15:00:00.000Z";

describe("format (Asia/Kolkata)", () => {
  it("shows IST clock time", () => {
    expect(clock(NOW)).toBe("8:30 PM");
  });
  it("collapses shared AM/PM in ranges", () => {
    expect(timeRange("2026-10-08T15:00:00Z", "2026-10-08T15:45:00Z")).toBe("8:30 – 9:15 PM");
    expect(timeRange("2026-10-08T06:00:00Z", "2026-10-08T07:00:00Z")).toBe("11:30 AM – 12:30 PM");
  });
  it("labels days relative to now", () => {
    expect(dayLabel("2026-10-08T16:00:00Z", NOW)).toBe("Tonight");
    expect(dayLabel("2026-10-09T04:30:00Z", NOW)).toBe("Tomorrow morning");
  });
  it("counts down", () => {
    expect(timeLeft("2026-10-09T04:30:00Z", NOW)).toBe("13 h 30 min");
    expect(timeLeft("2026-10-11T15:00:00Z", NOW)).toBe("3 days");
    expect(timeLeft("2026-11-12T15:00:00Z", NOW)).toBe("5 weeks");
  });
});
