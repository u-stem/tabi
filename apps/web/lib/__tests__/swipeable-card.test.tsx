import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SwipeableCard } from "../../components/swipeable-card";

describe("SwipeableCard", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders children", () => {
    render(
      <SwipeableCard actions={[]}>
        <div>Card content</div>
      </SwipeableCard>,
    );
    expect(screen.getByText("Card content")).toBeDefined();
  });

  it("renders action buttons", () => {
    render(
      <SwipeableCard
        actions={[
          { label: "編集", color: "blue", onClick: vi.fn() },
          { label: "削除", color: "red", onClick: vi.fn() },
        ]}
      >
        <div>Card</div>
      </SwipeableCard>,
    );
    expect(screen.getByRole("button", { name: "編集" })).toBeDefined();
    expect(screen.getByRole("button", { name: "削除" })).toBeDefined();
  });

  it("does not render action buttons when disabled", () => {
    render(
      <SwipeableCard actions={[{ label: "編集", color: "blue", onClick: vi.fn() }]} disabled>
        <div>Card</div>
      </SwipeableCard>,
    );
    expect(screen.queryByRole("button", { name: "編集" })).toBeNull();
  });
});
