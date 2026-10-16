import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const api = vi.fn();
vi.mock("@/lib/api/client", async (orig) => ({ ...(await orig<typeof import("@/lib/api/client")>()), api: (...a: unknown[]) => api(...a) }));
const { Quiz } = await import("./Quiz");

// A signed-in quiz: no answer key in the browser at all.
const QS = [
  { q: "Which keyword calls the parent version?", options: ["this", "super", "extends", "final"], topic: "Overriding" },
  { q: "Which block always runs?", options: ["try", "catch", "finally", "throws"], topic: "Exceptions" },
];

describe("server-graded quiz (D3)", () => {
  it("asks the server to grade each answer and shows its verdict", async () => {
    api
      .mockResolvedValueOnce({ answer: 1, why: "super refers to the parent class." })
      .mockResolvedValueOnce({ answer: 2, why: "finally always runs." });
    render(<Quiz questions={QS} contentId="c1" />);

    fireEvent.click(screen.getByRole("button", { name: /super/ }));
    expect(screen.getByRole("status")).toHaveTextContent("Checking");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Correct. super refers to the parent class."));
    expect(api).toHaveBeenCalledWith("/quiz/c1/answers", expect.objectContaining({ body: JSON.stringify({ q: 0, choice: 1, restart: true }) }));

    fireEvent.click(screen.getByRole("button", { name: "Next question" }));
    fireEvent.click(screen.getByRole("button", { name: /catch/ }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Not quite."));
    expect(api).toHaveBeenLastCalledWith("/quiz/c1/answers", expect.objectContaining({ body: JSON.stringify({ q: 1, choice: 1, restart: false }) }));

    fireEvent.click(screen.getByRole("button", { name: "See my score" }));
    expect(screen.getByText("1 of 2 right")).toBeInTheDocument();
  });
});
