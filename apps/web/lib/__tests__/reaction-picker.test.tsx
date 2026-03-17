import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReactionPicker } from "@/components/reaction-picker";
import { REACTION_EMOJIS } from "../hooks/use-reaction";

afterEach(() => {
  cleanup();
});

describe("ReactionPicker", () => {
  it("renders all emojis from REACTION_EMOJIS", () => {
    render(<ReactionPicker onSelect={vi.fn()} cooldown={false} />);

    for (const emoji of REACTION_EMOJIS) {
      expect(screen.getByRole("button", { name: emoji })).toBeDefined();
    }
  });

  it("calls onSelect with the emoji when clicked", () => {
    const onSelect = vi.fn();
    render(<ReactionPicker onSelect={onSelect} cooldown={false} />);

    fireEvent.click(screen.getByRole("button", { name: "🎉" }));

    expect(onSelect).toHaveBeenCalledWith("🎉");
  });

  it("disables buttons during cooldown", () => {
    render(<ReactionPicker onSelect={vi.fn()} cooldown={true} />);

    const button = screen.getByRole("button", { name: "🎉" });
    expect(button).toHaveProperty("disabled", true);
  });

  it("does not call onSelect when cooldown is active", () => {
    const onSelect = vi.fn();
    render(<ReactionPicker onSelect={onSelect} cooldown={true} />);

    fireEvent.click(screen.getByRole("button", { name: "🎉" }));

    expect(onSelect).not.toHaveBeenCalled();
  });
});
