import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = { resetPasswordForEmail: vi.fn(), updateUser: vi.fn(), getClaims: vi.fn() };
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth }) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ delete: vi.fn() }) }));
const redirect = vi.fn((to: string) => {
  throw new Error(`redirect:${to}`);
});
vi.mock("next/navigation", () => ({ redirect: (to: string) => redirect(to) }));

const { requestReset, setNewPassword } = await import("./actions");
const form = (o: Record<string, string>) => {
  const f = new FormData();
  Object.entries(o).forEach(([k, v]) => f.set(k, v));
  return f;
};

describe("forgot password (F5)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("answers the same whether or not the email has an account", async () => {
    auth.resetPasswordForEmail.mockResolvedValueOnce({ error: null });
    const known = await requestReset(undefined, form({ email: "bipin@example.com" }));
    auth.resetPasswordForEmail.mockResolvedValueOnce({ error: { status: 400, message: "User not found" } });
    const unknown = await requestReset(undefined, form({ email: "nobody@example.com" }));
    expect(known).toEqual({ sentTo: "bipin@example.com" });
    expect(unknown).toEqual({ sentTo: "nobody@example.com" });
    expect(auth.resetPasswordForEmail.mock.calls[0][1].redirectTo).toMatch(/\/auth\/callback\?next=\/reset-password$/);
  });

  it("says when to retry if rate limited, and rejects a bad email", async () => {
    auth.resetPasswordForEmail.mockResolvedValueOnce({ error: { status: 429 } });
    expect((await requestReset(undefined, form({ email: "a@b.co" })))?.error).toMatch(/Wait a few minutes/);
    expect((await requestReset(undefined, form({ email: "not-an-email" })))?.error).toMatch(/Enter an email/);
  });

  it("new password follows the sign-up rules and needs the link's session", async () => {
    expect((await setNewPassword(undefined, form({ password: "short1" })))?.error).toMatch(/10 characters/);
    auth.getClaims.mockResolvedValueOnce({ data: null });
    expect((await setNewPassword(undefined, form({ password: "longenough123" })))?.error).toMatch(/expired/);
    auth.getClaims.mockResolvedValueOnce({ data: { claims: { sub: "u1" } } });
    auth.updateUser.mockResolvedValueOnce({ error: null });
    await expect(setNewPassword(undefined, form({ password: "longenough123" }))).rejects.toThrow("redirect:/app");
  });
});
