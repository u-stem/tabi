import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { type ShortcutGroup, ShortcutHelpDialog } from "../../components/shortcut-help-dialog";

const shortcuts: ShortcutGroup[] = [
  {
    group: "全般",
    items: [{ key: "?", description: "ショートカット一覧" }],
  },
  {
    group: "ナビゲーション",
    items: [
      { key: "/", description: "検索にフォーカス" },
      { key: "n", description: "新規旅行を作成" },
    ],
  },
];

describe("ShortcutHelpDialog", () => {
  it("renders nothing when closed", () => {
    render(<ShortcutHelpDialog open={false} onOpenChange={vi.fn()} shortcuts={shortcuts} />);
    expect(screen.queryByText("全般")).toBeNull();
  });

  it("renders group headings when open", () => {
    render(<ShortcutHelpDialog open={true} onOpenChange={vi.fn()} shortcuts={shortcuts} />);
    expect(screen.getByText("全般")).toBeDefined();
    expect(screen.getByText("ナビゲーション")).toBeDefined();
  });

  it("renders shortcut keys in kbd elements", () => {
    render(<ShortcutHelpDialog open={true} onOpenChange={vi.fn()} shortcuts={shortcuts} />);
    const kbds = document.querySelectorAll("kbd[data-shortcut-key]");
    const keys = [...kbds].map((el) => el.textContent);
    expect(keys).toContain("?");
    expect(keys).toContain("/");
    expect(keys).toContain("n");
  });

  it("renders shortcut descriptions", () => {
    render(<ShortcutHelpDialog open={true} onOpenChange={vi.fn()} shortcuts={shortcuts} />);
    expect(screen.getAllByText("ショートカット一覧").length).toBeGreaterThan(0);
    expect(screen.getAllByText("検索にフォーカス").length).toBeGreaterThan(0);
    expect(screen.getAllByText("新規旅行を作成").length).toBeGreaterThan(0);
  });

  it("calls onOpenChange when closed via Escape", () => {
    const onOpenChange = vi.fn();
    render(<ShortcutHelpDialog open={true} onOpenChange={onOpenChange} shortcuts={shortcuts} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
