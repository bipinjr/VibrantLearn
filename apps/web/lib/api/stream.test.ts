import { describe, expect, it } from "vitest";
import { parseEvents } from "./stream";

describe("SSE parsing", () => {
  it("handles an event split across two network chunks", () => {
    const first = parseEvents('event: status\ndata: {"label":"Building your plan"}\n\nevent: block\ndata: {"type":"te');
    expect(first.events).toEqual([{ event: "status", data: { label: "Building your plan" } }]);
    const second = parseEvents(first.rest + 'xt","text":"ನಮಸ್ಕಾರ"}\n\n');
    expect(second.events).toEqual([{ event: "block", data: { type: "text", text: "ನಮಸ್ಕಾರ" } }]);
    expect(second.rest).toBe("");
  });

  it("skips unknown and malformed events instead of showing them", () => {
    const { events } = parseEvents("event: hack\ndata: {}\n\nevent: block\ndata: not json\n\n");
    expect(events).toEqual([]);
  });
});
