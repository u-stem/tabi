import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Fab } from "../../components/fab";

describe("Fab", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders with aria-label", () => {
    render(<Fab onClick={vi.fn()} label="予定を追加" />);
    expect(screen.getByRole("button", { name: "予定を追加" })).toBeDefined();
  });

  it("calls onClick when pressed", () => {
    const onClick = vi.fn();
    render(<Fab onClick={onClick} label="予定を追加" />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("is hidden when hidden prop is true", () => {
    render(<Fab onClick={vi.fn()} label="予定を追加" hidden />);
    expect(screen.queryByRole("button", { name: "予定を追加" })).toBeNull();
  });
});
