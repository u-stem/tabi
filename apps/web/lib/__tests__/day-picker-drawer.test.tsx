import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DayPickerDrawer } from "../../components/day-picker-drawer";

const MOCK_DAYS = [
  { id: "d1", date: "2026-11-03", dayIndex: 0 },
  { id: "d2", date: "2026-11-04", dayIndex: 1 },
  { id: "d3", date: "2026-11-05", dayIndex: 2 },
];

describe("DayPickerDrawer", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders day options", () => {
    render(
      <DayPickerDrawer
        open
        onOpenChange={vi.fn()}
        days={MOCK_DAYS}
        defaultDayIndex={0}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByText(/1日目/)).toBeDefined();
    expect(screen.getByText(/2日目/)).toBeDefined();
    expect(screen.getByText(/3日目/)).toBeDefined();
  });

  it("pre-selects the default day", () => {
    render(
      <DayPickerDrawer
        open
        onOpenChange={vi.fn()}
        days={MOCK_DAYS}
        defaultDayIndex={1}
        onConfirm={vi.fn()}
      />,
    );
    const radio = screen.getByRole("radio", { name: /2日目/ });
    expect((radio as HTMLInputElement).checked).toBe(true);
  });

  it("calls onConfirm with selected day id", () => {
    const onConfirm = vi.fn();
    render(
      <DayPickerDrawer
        open
        onOpenChange={vi.fn()}
        days={MOCK_DAYS}
        defaultDayIndex={0}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: /3日目/ }));
    fireEvent.click(screen.getByRole("button", { name: "追加する" }));
    expect(onConfirm).toHaveBeenCalledWith("d3", undefined);
  });
});
