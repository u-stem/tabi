import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ActionSheet } from "../../components/action-sheet";

describe("ActionSheet", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders action buttons", () => {
    render(
      <ActionSheet
        open
        onOpenChange={vi.fn()}
        actions={[
          { label: "編集", onClick: vi.fn() },
          { label: "削除", onClick: vi.fn(), variant: "destructive" },
        ]}
      />,
    );
    expect(screen.getByRole("button", { name: "編集" })).toBeDefined();
    expect(screen.getByRole("button", { name: "削除" })).toBeDefined();
    expect(screen.getByRole("button", { name: "キャンセル" })).toBeDefined();
  });

  it("calls action onClick and closes", () => {
    const onClick = vi.fn();
    const onOpenChange = vi.fn();
    render(<ActionSheet open onOpenChange={onOpenChange} actions={[{ label: "編集", onClick }]} />);
    fireEvent.click(screen.getByRole("button", { name: "編集" }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
