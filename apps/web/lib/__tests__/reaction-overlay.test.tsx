import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReactionOverlay } from "@/components/reaction-overlay";
import type { FloatingReaction } from "../hooks/use-reaction";

afterEach(() => {
  cleanup();
});

describe("ReactionOverlay", () => {
  it("renders nothing when reactions array is empty", () => {
    const { container } = render(<ReactionOverlay reactions={[]} onAnimationEnd={vi.fn()} />);
    expect(container.querySelector("[data-testid='reaction-overlay']")?.children).toHaveLength(0);
  });

  it("renders emoji + mini avatar for each reaction", () => {
    const reactions: FloatingReaction[] = [
      { id: "r1", emoji: "🎉", name: "Test", color: "bg-blue-500", x: 50 },
    ];
    render(<ReactionOverlay reactions={reactions} onAnimationEnd={vi.fn()} />);

    expect(screen.getByText("🎉")).toBeDefined();
    expect(screen.getByText("T")).toBeDefined();
  });

  it("positioned at correct X coordinate", () => {
    const reactions: FloatingReaction[] = [
      { id: "r1", emoji: "👍", name: "User", color: "bg-rose-500", x: 75 },
    ];
    const { container } = render(
      <ReactionOverlay reactions={reactions} onAnimationEnd={vi.fn()} />,
    );
    const el = container.querySelector("[data-reaction-id='r1']") as HTMLElement;
    expect(el.style.left).toBe("75%");
  });

  it("has animation style on each reaction element", () => {
    const reactions: FloatingReaction[] = [
      { id: "r1", emoji: "🔥", name: "User", color: "bg-amber-500", x: 30 },
    ];
    const { container } = render(
      <ReactionOverlay reactions={reactions} onAnimationEnd={vi.fn()} />,
    );
    const el = container.querySelector("[data-reaction-id='r1']") as HTMLElement;
    expect(el.style.animation).toContain("reaction-float-up");
  });
});
