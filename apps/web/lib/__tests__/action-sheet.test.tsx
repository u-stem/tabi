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

  it("renders href action as anchor link", () => {
    const onOpenChange = vi.fn();
    render(
      <ActionSheet
        open
        onOpenChange={onOpenChange}
        actions={[{ label: "印刷 / PDF", href: "/trips/123/print" }]}
      />,
    );
    const link = screen.getByRole("link", { name: "印刷 / PDF" });
    expect(link).toBeDefined();
    expect(link.getAttribute("href")).toBe("/trips/123/print");
  });

  it("closes drawer when href action link is clicked", () => {
    const onOpenChange = vi.fn();
    render(
      <ActionSheet
        open
        onOpenChange={onOpenChange}
        actions={[{ label: "エクスポート", href: "/trips/123/export" }]}
      />,
    );
    fireEvent.click(screen.getByRole("link", { name: "エクスポート" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
