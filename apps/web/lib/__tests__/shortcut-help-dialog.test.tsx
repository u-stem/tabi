import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl as render } from "@/lib/test-utils";
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
      { key: "n", description: "新規作成" },
    ],
  },
];

const tripShortcuts: ShortcutGroup[] = [
  {
    group: "ナビゲーション",
    items: [
      { key: "1-9", description: "N日目に切替" },
      { key: "[", description: "前の日へ" },
      { key: "]", description: "次の日へ" },
      { key: "p", description: "日程調整タブ" },
    ],
  },
  {
    group: "パターン",
    items: [
      { key: "{", description: "前のパターンへ" },
      { key: "}", description: "次のパターンへ" },
    ],
  },
  {
    group: "操作",
    items: [
      { key: "a", description: "予定を追加" },
      { key: "c", description: "候補を追加" },
      { key: "e", description: "旅行を編集" },
    ],
  },
  {
    group: "パネル",
    items: [
      { key: "g c", description: "候補" },
      { key: "g x", description: "費用" },
      { key: "g l", description: "履歴" },
      { key: "g b", description: "ブックマーク" },
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
    expect(screen.getAllByText("新規作成").length).toBeGreaterThan(0);
  });

  it("calls onOpenChange when closed via Escape", () => {
    const onOpenChange = vi.fn();
    render(<ShortcutHelpDialog open={true} onOpenChange={onOpenChange} shortcuts={shortcuts} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("ShortcutHelpDialog with trip shortcuts", () => {
  it("renders pattern group", () => {
    render(<ShortcutHelpDialog open={true} onOpenChange={vi.fn()} shortcuts={tripShortcuts} />);
    expect(screen.getByText("パターン")).toBeDefined();
    const kbds = document.querySelectorAll("kbd[data-shortcut-key]");
    const keys = [...kbds].map((el) => el.textContent);
    expect(keys).toContain("{");
    expect(keys).toContain("}");
  });

  it("renders panel group with sequence keys as separate kbd elements", () => {
    render(<ShortcutHelpDialog open={true} onOpenChange={vi.fn()} shortcuts={tripShortcuts} />);
    expect(screen.getAllByText("パネル").length).toBeGreaterThan(0);
    const kbds = document.querySelectorAll("kbd[data-shortcut-key]");
    const keys = [...kbds].map((el) => el.textContent);
    // Sequence keys are split: "g c" renders as separate <kbd>g</kbd> → <kbd>c</kbd>
    // Panel shortcuts: g c, g x, g l, g b (g h removed with chat feature)
    expect(keys.filter((k) => k === "g").length).toBeGreaterThanOrEqual(4);
    expect(keys).toContain("x");
    expect(keys).toContain("l");
    expect(keys).toContain("b");
    // Arrow separators are rendered between sequence parts
    expect(screen.getAllByText("→").length).toBeGreaterThanOrEqual(4);
  });

  it("renders poll toggle shortcut", () => {
    render(<ShortcutHelpDialog open={true} onOpenChange={vi.fn()} shortcuts={tripShortcuts} />);
    const kbds = document.querySelectorAll("kbd[data-shortcut-key]");
    const keys = [...kbds].map((el) => el.textContent);
    expect(keys).toContain("p");
    expect(screen.getAllByText("日程調整タブ").length).toBeGreaterThan(0);
  });
});
