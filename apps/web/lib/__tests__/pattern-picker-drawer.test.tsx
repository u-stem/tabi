import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PatternPickerDrawer } from "../../components/pattern-picker-drawer";
import { renderWithIntl } from "../test-utils";

const MOCK_PATTERNS = [
  { id: "p1", label: "プランA", isDefault: true },
  { id: "p2", label: "プランB", isDefault: false },
  { id: "p3", label: "雨の日", isDefault: false },
];

describe("PatternPickerDrawer", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders pattern options", () => {
    renderWithIntl(
      <PatternPickerDrawer
        open
        onOpenChange={vi.fn()}
        patterns={MOCK_PATTERNS}
        currentPatternIndex={0}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("プランA")).toBeDefined();
    expect(screen.getByText("プランB")).toBeDefined();
    expect(screen.getByText("雨の日")).toBeDefined();
  });

  it("marks current pattern as selected", () => {
    renderWithIntl(
      <PatternPickerDrawer
        open
        onOpenChange={vi.fn()}
        patterns={MOCK_PATTERNS}
        currentPatternIndex={1}
        onSelect={vi.fn()}
      />,
    );
    const radio = screen.getByRole("radio", { name: "プランB" });
    expect((radio as HTMLInputElement).checked).toBe(true);
  });

  it("calls onSelect when a pattern is clicked", () => {
    const onSelect = vi.fn();
    renderWithIntl(
      <PatternPickerDrawer
        open
        onOpenChange={vi.fn()}
        patterns={MOCK_PATTERNS}
        currentPatternIndex={0}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "雨の日" }));
    expect(onSelect).toHaveBeenCalledWith(2);
  });
});
