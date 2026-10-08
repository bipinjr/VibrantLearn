import { expect, it } from "vitest";
import { safeNext } from "./safe-next";

it("keeps relative app paths", () => {
  expect(safeNext("/app/s/123")).toBe("/app/s/123");
  expect(safeNext("/onboarding")).toBe("/onboarding");
});

it.each(["//evil.com", "/\\evil.com", "https://evil.com", "javascript:alert(1)", "", null, 42])(
  "falls back for %s",
  (v) => {
    expect(safeNext(v)).toBe("/app");
  },
);
