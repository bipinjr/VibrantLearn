import { afterEach, describe, expect, it, vi } from "vitest";
import { demoAccount, isDemoEmail } from "./accounts";

afterEach(() => vi.unstubAllEnvs());

describe("demo accounts", () => {
  it("is off until both email and password are set", () => {
    vi.stubEnv("DEMO_STUDENT_EMAIL", "s@example.com");
    vi.stubEnv("DEMO_STUDENT_PASSWORD", "");
    expect(demoAccount("student")).toBeNull();
    vi.stubEnv("DEMO_STUDENT_PASSWORD", "pw");
    expect(demoAccount("student")).toEqual({ email: "s@example.com", password: "pw" });
  });

  it("recognises demo emails case-insensitively and nothing else", () => {
    vi.stubEnv("DEMO_TEACHER_EMAIL", "T@Example.com");
    vi.stubEnv("DEMO_TEACHER_PASSWORD", "pw");
    expect(isDemoEmail("t@example.com")).toBe(true);
    expect(isDemoEmail("someone@example.com")).toBe(false);
    expect(isDemoEmail(undefined)).toBe(false);
  });
});
