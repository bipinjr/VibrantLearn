import { describe, expect, it } from "vitest";
import { usernameProblem } from "./username";

describe("usernameProblem (same cases as the API tests)", () => {
  it.each(["bipin.jr", "abc", "a|b|c", "Darshan.HS", "x".repeat(30), "bca2026"])("accepts %s", (n) => {
    expect(usernameProblem(n)).toBeNull();
  });

  it.each([
    "ab", "x".repeat(31), ".abc", "abc.", "|abc", "a..b", "a||b", "a b", "a_b", "<b>", "ಕನ್ನಡ",
    "admin", "ADMIN", "v.ibrantlearn", "support", "root",
  ])("rejects %s", (n) => {
    expect(usernameProblem(n)).not.toBeNull();
  });
});
