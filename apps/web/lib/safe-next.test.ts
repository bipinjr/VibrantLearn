import { expect, it } from "vitest";
import { safeNext } from "./safe-next";

it("keeps relative app paths", () => {
  expect(safeNext("/app/s/123")).toBe("/app/s/123");
  expect(safeNext("/onboarding")).toBe("/onboarding");
  expect(safeNext("/app/plans?from=email")).toBe("/app/plans?from=email");
  expect(safeNext("/app/s/1#notes")).toBe("/app/s/1#notes");
});

it.each(["//evil.com", "/\\evil.com", "https://evil.com", "javascript:alert(1)", "", null, 42])(
  "falls back for %s",
  (v) => {
    expect(safeNext(v)).toBe("/app");
  },
);

// Browsers drop these characters before resolving, turning each of these into //evil.com.
it.each([
  "/\t/evil.com",
  "/\n/evil.com",
  "/\r/evil.com",
  "/\u0000/evil.com",
  "/\u0001/evil.com",
  "/ /evil.com",
  "/\u0085/evil.com",
])("blocks the control-character open redirect %j", (v) => {
  expect(safeNext(v)).toBe("/app");
});

it("never returns a value that resolves off-site", () => {
  for (const attempt of ["/\t//evil.com", "/\n\\evil.com", "/..//evil.com", "/%2F%2Fevil.com"]) {
    const resolved = new URL(safeNext(attempt), "https://vibrantlearn.app");
    expect(resolved.origin).toBe("https://vibrantlearn.app");
  }
});
