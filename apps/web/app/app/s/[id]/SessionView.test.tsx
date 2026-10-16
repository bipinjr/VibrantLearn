import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { getDemo, type Message } from "@/lib/demo/data";
import { DemoProvider } from "@/lib/demo/store";
import { SessionView } from "./SessionView";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/app" }));

describe("signed-in session page (B1)", () => {
  it("puts the thread in the server HTML, before any JavaScript runs", () => {
    const seed = { ...getDemo(), messages: {} }; // threads aren't in the layout any more
    const id = seed.sessions[0].id;
    const initial: Message[] = [
      { id: "u1", role: "user", content: "nale DBMS test ide", at: "2026-10-08T15:00:00.000Z" },
      { id: "a1", role: "assistant", blocks: [{ type: "text", text: "Got it: DBMS, tomorrow." }], servedFrom: "ml", at: "2026-10-08T15:00:01.000Z" },
    ];
    const html = renderToString(
      <DemoProvider seed={seed} account={{ userId: "u" }}>
        <SessionView id={id} initial={initial} />
      </DemoProvider>,
    );
    expect(html).toContain("nale DBMS test ide");
    expect(html).toContain("Got it: DBMS, tomorrow.");
  });
});
