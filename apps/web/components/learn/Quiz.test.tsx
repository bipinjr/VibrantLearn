import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Quiz } from "./Quiz";

const QS = [
  { q: "2 + 2?", options: ["three", "four", "five", "twenty-two"], answer: 1, why: "Basic addition.", topic: "Maths" },
  { q: "Capital of Karnataka?", options: ["Mysuru", "Hubballi", "Bengaluru", "Mangaluru"], answer: 2, why: "Bengaluru.", topic: "GK" },
];

describe("Quiz", () => {
  it("scores answers, shows explanations and lists topics to revise", () => {
    const onRevise = vi.fn();
    render(<Quiz questions={QS} onRevise={onRevise} />);

    fireEvent.click(screen.getByRole("button", { name: /four/ }));
    expect(screen.getByRole("status")).toHaveTextContent("Correct. Basic addition.");
    fireEvent.click(screen.getByRole("button", { name: "Next question" }));

    fireEvent.click(screen.getByRole("button", { name: /Mysuru/ }));
    expect(screen.getByRole("status")).toHaveTextContent("Not quite.");
    fireEvent.click(screen.getByRole("button", { name: "See my score" }));

    expect(screen.getByText("1 of 2 right")).toBeInTheDocument();
    expect(screen.getByText("GK")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Explain what I missed" }));
    expect(onRevise).toHaveBeenCalledWith(["GK"]);
  });
});
