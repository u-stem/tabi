import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "@/lib/test-utils";
import { ActionSheet } from "../../components/action-sheet";

describe("ActionSheet", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders action buttons", () => {
    renderWithIntl(
      <ActionSheet
        open
        onOpenChange={vi.fn()}
        actions={[
          { label: "Edit", onClick: vi.fn() },
          { label: "Delete", onClick: vi.fn(), variant: "destructive" },
        ]}
      />,
    );
    expect(screen.getByRole("button", { name: "Edit" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Delete" })).toBeDefined();
    expect(screen.getByRole("button", { name: /キャンセル/ })).toBeDefined();
  });

  it("calls action onClick and closes", () => {
    const onClick = vi.fn();
    const onOpenChange = vi.fn();
    renderWithIntl(
      <ActionSheet open onOpenChange={onOpenChange} actions={[{ label: "Edit", onClick }]} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders href action as anchor link", () => {
    const onOpenChange = vi.fn();
    renderWithIntl(
      <ActionSheet
        open
        onOpenChange={onOpenChange}
        actions={[{ label: "Print / PDF", href: "/trips/123/print" }]}
      />,
    );
    const link = screen.getByRole("link", { name: "Print / PDF" });
    expect(link).toBeDefined();
    expect(link.getAttribute("href")).toBe("/trips/123/print");
  });

  it("closes drawer when href action link is clicked", () => {
    const onOpenChange = vi.fn();
    renderWithIntl(
      <ActionSheet
        open
        onOpenChange={onOpenChange}
        actions={[{ label: "Export", href: "/trips/123/export" }]}
      />,
    );
    fireEvent.click(screen.getByRole("link", { name: "Export" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
