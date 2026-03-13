# SpSwipeTabs Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SP版の5ページに分散しているタブ+スワイプ実装を統一 `SpSwipeTabs` コンポーネントに統合し、ネイティブアプリに近い操作感を実現する。

**Architecture:** 新規 `SpSwipeTabs` コンポーネントが `useSwipeTab` hookを内部利用し、タブバー描画・スワイプジェスチャー・隣接タブマウント・スクロール位置保存を一括管理する。各ページは `tabs` / `activeTab` / `onTabChange` / `renderContent` を渡すだけで統一的なタブUI+スワイプを得る。

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Vitest, @testing-library/react

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `apps/web/components/sp-swipe-tabs.tsx` | 統一スワイプタブコンポーネント |
| Create | `apps/web/lib/__tests__/sp-swipe-tabs.test.tsx` | コンポーネントテスト |
| Modify | `apps/web/app/(sp)/sp/home/page.tsx` | SpSwipeTabs に置き換え |
| Modify | `apps/web/app/(sp)/sp/friends/page.tsx` | SpSwipeTabs に置き換え |
| Modify | `apps/web/app/(sp)/sp/tools/roulette/page.tsx` | SpSwipeTabs に置き換え |
| Modify | `apps/web/app/(sp)/sp/trips/[id]/page.tsx` | SpSwipeTabs に置き換え |
| Modify | `apps/web/app/(authenticated)/trips/[id]/page.tsx` | モバイルレイアウトを SpSwipeTabs に置き換え |
| Delete | `apps/web/components/mobile-content-tabs.tsx` | SpSwipeTabs に吸収 |
| Delete | `apps/web/lib/__tests__/mobile-content-tabs.test.tsx` | 新テストに置き換え |
| Modify | `apps/web/components/sp-bottom-nav.tsx` | `active:scale` 削除 |
| Modify | `apps/web/app/(authenticated)/settings/page.tsx` | SP版タブの `active:scale` 削除 |

---

## Chunk 1: SpSwipeTabs コンポーネント作成 + テスト

### Task 1: SpSwipeTabs テスト作成

**Files:**
- Create: `apps/web/lib/__tests__/sp-swipe-tabs.test.tsx`

- [x] **Step 1: テストファイルを作成**

```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SpSwipeTabs } from "../../components/sp-swipe-tabs";

const TABS = [
  { id: "a", label: "Tab A" },
  { id: "b", label: "Tab B" },
  { id: "c", label: "Tab C" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function renderTabs(overrides: Partial<Parameters<typeof SpSwipeTabs<TabId>>[0]> = {}) {
  const props = {
    tabs: [...TABS],
    activeTab: "a" as TabId,
    onTabChange: vi.fn(),
    renderContent: (id: TabId) => <div>Content {id}</div>,
    ...overrides,
  };
  return { ...render(<SpSwipeTabs {...props} />), onTabChange: props.onTabChange };
}

describe("SpSwipeTabs", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders all tabs with role=tab", () => {
    renderTabs();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
  });

  it("renders each tab label", () => {
    renderTabs();
    expect(screen.getByRole("tab", { name: "Tab A" })).toBeDefined();
    expect(screen.getByRole("tab", { name: "Tab B" })).toBeDefined();
    expect(screen.getByRole("tab", { name: "Tab C" })).toBeDefined();
  });

  it("marks active tab with aria-selected=true", () => {
    renderTabs({ activeTab: "b" });
    expect(screen.getByRole("tab", { name: "Tab B" }).getAttribute("aria-selected")).toBe("true");
  });

  it("marks inactive tab with aria-selected=false", () => {
    renderTabs({ activeTab: "b" });
    expect(screen.getByRole("tab", { name: "Tab A" }).getAttribute("aria-selected")).toBe("false");
  });

  it("sets tabIndex=0 on active tab", () => {
    renderTabs({ activeTab: "b" });
    expect(screen.getByRole("tab", { name: "Tab B" }).getAttribute("tabindex")).toBe("0");
  });

  it("sets tabIndex=-1 on inactive tab", () => {
    renderTabs({ activeTab: "b" });
    expect(screen.getByRole("tab", { name: "Tab A" }).getAttribute("tabindex")).toBe("-1");
  });

  it("applies active style class to selected tab", () => {
    renderTabs({ activeTab: "a" });
    const tabA = screen.getByRole("tab", { name: "Tab A" });
    expect(tabA.className).toContain("bg-background");
  });

  it("calls onTabChange on click", () => {
    const { onTabChange } = renderTabs();
    fireEvent.click(screen.getByRole("tab", { name: "Tab B" }));
    expect(onTabChange).toHaveBeenCalledWith("b");
  });

  it("does not call onTabChange when clicking already active tab", () => {
    const { onTabChange } = renderTabs({ activeTab: "a" });
    fireEvent.click(screen.getByRole("tab", { name: "Tab A" }));
    expect(onTabChange).not.toHaveBeenCalled();
  });

  it("navigates with ArrowRight", () => {
    const { onTabChange } = renderTabs({ activeTab: "a" });
    fireEvent.keyDown(screen.getByRole("tab", { name: "Tab A" }), { key: "ArrowRight" });
    expect(onTabChange).toHaveBeenCalledWith("b");
  });

  it("navigates with ArrowLeft", () => {
    const { onTabChange } = renderTabs({ activeTab: "b" });
    fireEvent.keyDown(screen.getByRole("tab", { name: "Tab B" }), { key: "ArrowLeft" });
    expect(onTabChange).toHaveBeenCalledWith("a");
  });

  it("wraps ArrowRight from last tab to first", () => {
    const { onTabChange } = renderTabs({ activeTab: "c" });
    fireEvent.keyDown(screen.getByRole("tab", { name: "Tab C" }), { key: "ArrowRight" });
    expect(onTabChange).toHaveBeenCalledWith("a");
  });

  it("wraps ArrowLeft from first tab to last", () => {
    const { onTabChange } = renderTabs({ activeTab: "a" });
    fireEvent.keyDown(screen.getByRole("tab", { name: "Tab A" }), { key: "ArrowLeft" });
    expect(onTabChange).toHaveBeenCalledWith("c");
  });

  it("navigates to first with Home key", () => {
    const { onTabChange } = renderTabs({ activeTab: "c" });
    fireEvent.keyDown(screen.getByRole("tab", { name: "Tab C" }), { key: "Home" });
    expect(onTabChange).toHaveBeenCalledWith("a");
  });

  it("does not call onTabChange for Home on first tab", () => {
    const { onTabChange } = renderTabs({ activeTab: "a" });
    fireEvent.keyDown(screen.getByRole("tab", { name: "Tab A" }), { key: "Home" });
    expect(onTabChange).not.toHaveBeenCalled();
  });

  it("navigates to last with End key", () => {
    const { onTabChange } = renderTabs({ activeTab: "a" });
    fireEvent.keyDown(screen.getByRole("tab", { name: "Tab A" }), { key: "End" });
    expect(onTabChange).toHaveBeenCalledWith("c");
  });

  it("does not call onTabChange for End on last tab", () => {
    const { onTabChange } = renderTabs({ activeTab: "c" });
    fireEvent.keyDown(screen.getByRole("tab", { name: "Tab C" }), { key: "End" });
    expect(onTabChange).not.toHaveBeenCalled();
  });

  it("sets correct trigger id on tab", () => {
    renderTabs();
    expect(screen.getByRole("tab", { name: "Tab A" }).getAttribute("id")).toBe("mobile-tab-trigger-a");
  });

  it("sets correct aria-controls on tab", () => {
    renderTabs();
    expect(screen.getByRole("tab", { name: "Tab A" }).getAttribute("aria-controls")).toBe("mobile-tab-panel-a");
  });

  it("sets correct id on tabpanel", () => {
    renderTabs();
    expect(screen.getByRole("tabpanel").getAttribute("id")).toBe("mobile-tab-panel-a");
  });

  it("sets correct aria-labelledby on tabpanel", () => {
    renderTabs();
    expect(screen.getByRole("tabpanel").getAttribute("aria-labelledby")).toBe("mobile-tab-trigger-a");
  });

  it("renders active tab content", () => {
    renderTabs({ activeTab: "b" });
    expect(screen.getByText("Content b")).toBeDefined();
  });

  it("shows badge when count > 0", () => {
    renderTabs({
      tabs: [
        { id: "a", label: "Tab A", badge: 5 },
        { id: "b", label: "Tab B" },
      ],
      activeTab: "a",
    });
    expect(screen.getByText("5")).toBeDefined();
  });

  it("hides badge when count is 0", () => {
    renderTabs({
      tabs: [
        { id: "a", label: "Tab A", badge: 0 },
        { id: "b", label: "Tab B" },
      ],
      activeTab: "a",
    });
    expect(screen.queryByText("0")).toBeNull();
  });

  it("does not have active:scale in tab button classes", () => {
    renderTabs();
    const tabs = screen.getAllByRole("tab");
    for (const tab of tabs) {
      expect(tab.className).not.toContain("active:scale");
    }
  });

  it("does not have transition in tab button classes", () => {
    renderTabs();
    const tabs = screen.getAllByRole("tab");
    for (const tab of tabs) {
      expect(tab.className).not.toContain("transition");
    }
  });

  it("renders children between tab bar and swipe container", () => {
    render(
      <SpSwipeTabs
        tabs={[...TABS]}
        activeTab="a"
        onTabChange={vi.fn()}
        renderContent={(id) => <div>Content {id}</div>}
      >
        <div data-testid="toolbar">Toolbar</div>
      </SpSwipeTabs>,
    );
    expect(screen.getByTestId("toolbar")).toBeDefined();
  });

  it("hides swipe container when activeTab is not in tabs list", () => {
    render(
      <SpSwipeTabs
        tabs={[...TABS]}
        activeTab={"unknown" as string}
        onTabChange={vi.fn()}
        renderContent={(id) => <div>Content {id}</div>}
      />,
    );
    expect(screen.queryByRole("tabpanel")).toBeNull();
  });

  it("shows no tab as active when activeTab is not in tabs list", () => {
    render(
      <SpSwipeTabs
        tabs={[...TABS]}
        activeTab={"unknown" as string}
        onTabChange={vi.fn()}
        renderContent={(id) => <div>Content {id}</div>}
      />,
    );
    const tabs = screen.getAllByRole("tab");
    for (const tab of tabs) {
      expect(tab.getAttribute("aria-selected")).toBe("false");
    }
  });
});
```

- [x] **Step 2: テストが失敗することを確認**

Run: `bun run --filter @sugara/web test -- apps/web/lib/__tests__/sp-swipe-tabs.test.tsx`
Expected: FAIL (module not found)

- [x] **Step 3: Commit**

```bash
git add apps/web/lib/__tests__/sp-swipe-tabs.test.tsx
git commit -m "test: SpSwipeTabsのテストを追加"
```

---

### Task 2: SpSwipeTabs コンポーネント実装

**Files:**
- Create: `apps/web/components/sp-swipe-tabs.tsx`

- [x] **Step 1: コンポーネントを実装**

```tsx
"use client";

import { type ReactNode, type RefObject, useCallback, useLayoutEffect, useRef } from "react";
import { useSwipeTab } from "@/lib/hooks/use-swipe-tab";
import { cn } from "@/lib/utils";

export type SwipeTab<T extends string = string> = {
  id: T;
  label: string;
  badge?: number;
};

export type SpSwipeTabsProps<T extends string = string> = {
  tabs: SwipeTab<T>[];
  activeTab: T;
  onTabChange: (tabId: T) => void;
  renderContent: (tabId: T) => ReactNode;
  /** Content inserted between tab bar and swipe container (e.g. toolbar) */
  children?: ReactNode;
  preserveScroll?: boolean;
  scrollRef?: RefObject<HTMLElement | null>;
  swipeEnabled?: boolean;
  className?: string;
};

const GRID_COLS: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
};

export function getMobileTabTriggerId(tabId: string): string {
  return `mobile-tab-trigger-${tabId}`;
}

export function getMobileTabPanelId(tabId: string): string {
  return `mobile-tab-panel-${tabId}`;
}

export function SpSwipeTabs<T extends string = string>({
  tabs,
  activeTab,
  onTabChange,
  renderContent,
  children,
  preserveScroll = false,
  scrollRef,
  swipeEnabled = true,
  className,
}: SpSwipeTabsProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const swipeRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const scrollPositions = useRef<Record<string, number>>({});

  const currentTabIdx = tabs.findIndex((t) => t.id === activeTab);

  const handleSwipe = useCallback(
    (direction: "left" | "right") => {
      const idx = tabs.findIndex((t) => t.id === activeTabRef.current);
      if (idx === -1) return;
      const nextIdx = direction === "left" ? idx + 1 : idx - 1;
      if (nextIdx < 0 || nextIdx >= tabs.length) return;
      if (preserveScroll) {
        saveScrollPosition(activeTabRef.current);
      }
      onTabChange(tabs[nextIdx].id);
    },
    [tabs, onTabChange, preserveScroll],
  );

  const swipe = useSwipeTab(containerRef, swipeRef, {
    onSwipeComplete: handleSwipe,
    canSwipePrev: currentTabIdx > 0,
    canSwipeNext: currentTabIdx >= 0 && currentTabIdx < tabs.length - 1,
    enabled: swipeEnabled && currentTabIdx !== -1,
  });

  const adjacentTab =
    swipe.adjacent === "next"
      ? tabs[currentTabIdx + 1]?.id
      : swipe.adjacent === "prev"
        ? tabs[currentTabIdx - 1]?.id
        : undefined;

  function getScrollEl() {
    return scrollRef?.current ?? containerRef.current;
  }

  function saveScrollPosition(tabId: string) {
    const el = getScrollEl();
    if (el) {
      scrollPositions.current[tabId] = el.scrollTop;
    }
  }

  // Restore scroll position synchronously before paint
  useLayoutEffect(() => {
    if (!preserveScroll) return;
    const el = getScrollEl();
    el?.scrollTo(0, scrollPositions.current[activeTab] ?? 0);
  }, [activeTab, preserveScroll, scrollRef]);

  const handleTabClick = useCallback(
    (tabId: T) => {
      if (tabId === activeTabRef.current) return;
      if (preserveScroll) {
        saveScrollPosition(activeTabRef.current);
        // Pre-set scroll position before React commits DOM changes
        const el = getScrollEl();
        el?.scrollTo(0, scrollPositions.current[tabId] ?? 0);
      }
      onTabChange(tabId);
    },
    [onTabChange, preserveScroll, scrollRef],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      let targetId: T | undefined;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        targetId = tabs[(index + 1) % tabs.length].id;
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        targetId = tabs[(index - 1 + tabs.length) % tabs.length].id;
      } else if (e.key === "Home") {
        e.preventDefault();
        const first = tabs[0].id;
        if (first !== activeTabRef.current) targetId = first;
      } else if (e.key === "End") {
        e.preventDefault();
        const last = tabs[tabs.length - 1].id;
        if (last !== activeTabRef.current) targetId = last;
      }
      if (targetId !== undefined) {
        onTabChange(targetId);
      }
    },
    [tabs, onTabChange],
  );

  return (
    <div className={className}>
      {/* Tab bar */}
      <div
        role="tablist"
        aria-orientation="horizontal"
        className={cn(
          "grid gap-1 rounded-lg bg-muted p-1",
          GRID_COLS[tabs.length],
        )}
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            id={getMobileTabTriggerId(tab.id)}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={getMobileTabPanelId(tab.id)}
            tabIndex={activeTab === tab.id ? 0 : -1}
            className={cn(
              "min-w-0 rounded-md px-2 py-1.5 text-sm font-medium min-h-[36px] overflow-hidden",
              activeTab === tab.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => handleTabClick(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
          >
            <span className="flex w-full items-center justify-center gap-1 whitespace-nowrap">
              <span className="truncate">{tab.label}</span>
              {tab.badge != null && tab.badge > 0 && (
                <span className="shrink-0 text-xs">{tab.badge}</span>
              )}
            </span>
          </button>
        ))}
      </div>

      {children}

      {/* Swipe container — only rendered when activeTab is in tabs list */}
      {currentTabIdx !== -1 && (
        <div
          ref={containerRef}
          className="min-h-[60vh] overflow-x-hidden px-0.5 -mx-0.5 touch-pan-y"
        >
          <div ref={swipeRef} className="relative touch-pan-y will-change-transform">
            {/* Active tab content */}
            <div
              className="pt-0.5"
              id={getMobileTabPanelId(activeTab)}
              role="tabpanel"
              aria-labelledby={getMobileTabTriggerId(activeTab)}
            >
              {renderContent(activeTab)}
            </div>

            {/* Adjacent tab (rendered only during swipe) */}
            {swipe.adjacent && adjacentTab && (
              <div
                className="absolute top-0 left-0 w-full pt-0.5"
                aria-hidden="true"
                style={{
                  transform: swipe.adjacent === "next" ? "translateX(100%)" : "translateX(-100%)",
                }}
              >
                {renderContent(adjacentTab as T)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [x] **Step 2: テストが通ることを確認**

Run: `bun run --filter @sugara/web test -- apps/web/lib/__tests__/sp-swipe-tabs.test.tsx`
Expected: ALL PASS

- [x] **Step 3: 型チェック**

Run: `bun run check-types`
Expected: PASS

- [x] **Step 4: Commit**

```bash
git add apps/web/components/sp-swipe-tabs.tsx
git commit -m "feat: SpSwipeTabsコンポーネントを追加"
```

---

## Chunk 2: ページ置き換え (home, friends, roulette)

### Task 3: home ページ置き換え

**Files:**
- Modify: `apps/web/app/(sp)/sp/home/page.tsx`

home ページは SpSwipeTabs に置き換える。ただしツールバーとカードリストの間にスワイプコンテナがある構造のため、`renderContent` はカードリストのみを返す。ツールバーはスワイプコンテナの外に配置する（現状と同じ）。

- [x] **Step 1: import を変更**

`apps/web/app/(sp)/sp/home/page.tsx` で以下の変更を行う:
- `useSwipeTab` の import を削除
- `cn` の import を削除（他で使っていなければ）
- `SpSwipeTabs` を import

```tsx
// Remove:
import { useSwipeTab } from "@/lib/hooks/use-swipe-tab";
import { cn } from "@/lib/utils";

// Add:
import { SpSwipeTabs } from "@/components/sp-swipe-tabs";
```

- [x] **Step 2: swipe 関連の state と hook を削除**

以下を削除:
- `tabRef` (line 91)
- `contentRef` (line 92)
- `swipeRef` (line 93)
- `handleTabChange` 内の `tabRef.current = newTab` (line 101)
- `handleSwipe` callback (lines 112-121)
- `useSwipeTab` 呼び出し (lines 126-132)
- `adjacentTab` 計算 (lines 134-139)

`handleTabChange` はそのまま残す（フィルタリセットロジックがあるため）。ただし `tabRef` 使用箇所を除去:
```tsx
const handleTabChange = useCallback(
  (newTab: HomeTab) => {
    if (newTab === tab) return;
    setTab(newTab);
    setSearch("");
    setStatusFilter("all");
    setSortKey("updatedAt");
    setSelectionMode(false);
  },
  [tab, setTab, setSearch, setStatusFilter, setSortKey, setSelectionMode],
);
```

注意: `handleTabChange` の依存配列に `tab` を追加（`tabRef.current` の代わりに `tab` で直接比較するため）。

- [x] **Step 3: JSX をSpSwipeTabs に置き換え**

タブバー (lines 202-234) + スワイプエリア (lines 264-285) を `SpSwipeTabs` に置き換え:

```tsx
const homeTabs = [
  { id: "owned" as const, label: "自分の旅行" },
  { id: "shared" as const, label: "共有された旅行" },
];

// JSX:
<SpSwipeTabs
  tabs={homeTabs}
  activeTab={tab}
  onTabChange={handleTabChange}
  renderContent={renderCardList}
  swipeEnabled={!isLoading && !error}
  className="mt-4"
/>
```

ツールバーは `SpSwipeTabs` の外に置く（`renderContent` 内ではなく）。そのためツールバーは `SpSwipeTabs` と同列に配置:

```tsx
<LoadingBoundary ...>
  <SpSwipeTabs
    tabs={homeTabs}
    activeTab={tab}
    onTabChange={handleTabChange}
    renderContent={renderCardList}
    swipeEnabled={!isLoading && !error}
    className="mt-4"
  />
  {/* Toolbar — outside swipe to avoid input blocking swipe */}
  <div className="mt-4">
    <TripToolbar ... />
  </div>
</LoadingBoundary>
```

待って — 現在のレイアウトでは:
1. タブバー
2. ツールバー
3. スワイプエリア（カードリスト）

`SpSwipeTabs` はタブバーとスワイプエリアをまとめて描画するので、ツールバーを間に挟めない。

**対応方法**: `SpSwipeTabs` に `children` prop を追加して、タブバーとスワイプコンテナの間にコンテンツを挿入できるようにする。

```tsx
// SpSwipeTabsProps に追加:
children?: ReactNode;

// SpSwipeTabs の JSX:
<div className={className}>
  {/* Tab bar */}
  <div role="tablist" ...>...</div>
  {children}
  {/* Swipe container */}
  <div ref={containerRef} ...>...</div>
</div>
```

home ページでの使用:
```tsx
<SpSwipeTabs
  tabs={homeTabs}
  activeTab={tab}
  onTabChange={handleTabChange}
  renderContent={renderCardList}
  swipeEnabled={!isLoading && !error}
  className="mt-4"
>
  <div className="mt-4">
    <TripToolbar ... />
  </div>
</SpSwipeTabs>
```

**Task 2 の SpSwipeTabs に `children` prop を追加する。**

- [x] **Step 4: テスト実行**

Run: `bun run --filter @sugara/web test -- apps/web/lib/__tests__/sp-swipe-tabs.test.tsx`
Expected: ALL PASS

Run: `bun run check-types`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add apps/web/components/sp-swipe-tabs.tsx apps/web/app/\(sp\)/sp/home/page.tsx
git commit -m "refactor: homeページをSpSwipeTabsに置き換え"
```

---

### Task 4: friends ページ置き換え

**Files:**
- Modify: `apps/web/app/(sp)/sp/friends/page.tsx`

- [x] **Step 1: import 変更と swipe 関連削除**

```tsx
// Remove:
import { useSwipeTab } from "@/lib/hooks/use-swipe-tab";
import { cn } from "@/lib/utils";

// Add:
import { SpSwipeTabs } from "@/components/sp-swipe-tabs";
```

以下を削除:
- `tabRef` (line 82)
- `contentRef` (line 88)
- `swipeRef` (line 89)
- `currentTabIdx` (line 95)
- `changeTab` 内の `tabRef.current = t` (line 98)
- `handleSwipe` callback (lines 102-110)
- `useSwipeTab` 呼び出し (lines 112-117)
- `adjacentTab` 計算 (lines 119-124)

`changeTab` を簡素化:
```tsx
const changeTab = useCallback((t: Tab) => {
  setTab(t);
}, []);
```

- [x] **Step 2: JSX を置き換え**

タブバー (lines 183-215) + スワイプコンテナ (lines 218-237) を:

```tsx
const friendsTabs = TABS.map((t) => ({ id: t, label: TAB_LABELS[t] }));

<SpSwipeTabs
  tabs={friendsTabs}
  activeTab={tab}
  onTabChange={changeTab}
  renderContent={renderTab}
  swipeEnabled={!isLoading && !isGuest}
  className="mt-4"
/>
```

- [x] **Step 3: テスト・型チェック**

Run: `bun run check-types`
Expected: PASS

- [x] **Step 4: Commit**

```bash
git add apps/web/app/\(sp\)/sp/friends/page.tsx
git commit -m "refactor: friendsページをSpSwipeTabsに置き換え"
```

---

### Task 5: roulette ページ置き換え

**Files:**
- Modify: `apps/web/app/(sp)/sp/tools/roulette/page.tsx`

- [x] **Step 1: import 変更と swipe 関連削除**

```tsx
// Remove:
import { useSwipeTab } from "@/lib/hooks/use-swipe-tab";
import { cn } from "@/lib/utils";

// Add:
import { SpSwipeTabs } from "@/components/sp-swipe-tabs";
```

以下を削除:
- `modeRef` (line 17)
- `contentRef` (line 18)
- `swipeRef` (line 19)
- `changeMode` 内の `modeRef.current = next` (line 24)
- `handleSwipe` callback (lines 28-36)
- `useSwipeTab` 呼び出し (lines 38-43)
- `adjacentMode` 計算 (lines 45-50)

`changeMode` を簡素化:
```tsx
const changeMode = useCallback((next: Mode) => {
  setMode(next);
}, []);
```

- [x] **Step 2: JSX を置き換え**

```tsx
const rouletteTabs = ROULETTE_MODES.map((m) => ({ id: m.value, label: m.label }));

<div className="mt-4 mx-auto max-w-2xl space-y-6">
  <SpSwipeTabs
    tabs={rouletteTabs}
    activeTab={mode}
    onTabChange={changeMode}
    renderContent={(m) => <RouletteModeContent mode={m} />}
    swipeEnabled={true}
  />
</div>
```

- [x] **Step 3: テスト・型チェック**

Run: `bun run check-types`
Expected: PASS

- [x] **Step 4: Commit**

```bash
git add apps/web/app/\(sp\)/sp/tools/roulette/page.tsx
git commit -m "refactor: rouletteページをSpSwipeTabsに置き換え"
```

---

## Chunk 3: trips ページ置き換え

### Task 6: SP trips ページ置き換え

**Files:**
- Modify: `apps/web/app/(sp)/sp/trips/[id]/page.tsx`

SP trips ページは最も複雑。h-0 trick + tapAnimating + translateX base offset パターンを SpSwipeTabs に置き換える。`preserveScroll` + `scrollRef` を使用。

- [x] **Step 1: import 変更**

```tsx
// Remove:
import {
  getMobileTabIds,
  getMobileTabPanelId,
  getMobileTabTriggerId,
  type MobileContentTab,
  MobileContentTabs,
} from "@/components/mobile-content-tabs";
import { useSwipeTab } from "@/lib/hooks/use-swipe-tab";

// Add:
import { SpSwipeTabs } from "@/components/sp-swipe-tabs";
```

`MobileContentTab` 型をローカルで定義する（SpSwipeTabs は generic なので型引数で渡す）:

```tsx
type MobileContentTab = "schedule" | "candidates" | "expenses" | "souvenirs";
```

- [x] **Step 2: swipe 関連の state と hook を削除**

以下を削除:
- `scrollPositions` ref (line 122) — `SpSwipeTabs` が内部管理
- `mobileContentRef` ref (line 123) — `SpSwipeTabs` が内部管理
- `swipeContainerRef` ref (line 124) — `SpSwipeTabs` が内部管理
- `tapAnimating` state (line 125) — 不要
- `useLayoutEffect` for scroll restore (lines 183-186) — `SpSwipeTabs` が内部管理
- `handleMobileTabChange` (lines 188-203) — 簡素化して新規作成
- `handleSwipe` (lines 205-215) — 不要
- `tabIds` memo (line 217) — 不要
- `currentTabIdx` (line 218) — 不要
- `canSwipeMobileTabs` (line 219) — 不要
- `useSwipeTab` 呼び出し (lines 220-228) — 不要
- スワイプ中の `translateY` 補正ロジック (lines 329-361) — `SpSwipeTabs` のスコープ外、初期実装では補正なし
- スワイプ中の overflow 制御 (lines 367-374) — 不要

新しい `handleMobileTabChange`:
```tsx
const handleMobileTabChange = useCallback(
  (tab: MobileContentTab) => {
    mobileTabRef.current = tab;
    setMobileTab(tab);
  },
  [],
);
```

**bookmarks/activity/map タブの扱い**: `TripHeader` のメニューから `handleMobileTabChange("bookmarks")` 等で非スワイプタブに切り替えられる。`SpSwipeTabs` に `activeTab` が `tabs` リストにない値を渡すと、タブバーはアクティブなし状態で描画され、スワイプコンテナは非表示になる（Task 2 の `currentTabIdx === -1` ハンドリング）。非スワイプタブのコンテンツは `SpSwipeTabs` の外で描画する。

- [x] **Step 3: JSX を置き換え**

`MobileContentTabs` + スワイプコンテナ全体 (lines 656-703) を以下に置き換え:

```tsx
const SWIPE_TABS = [
  { id: "schedule" as const, label: "予定" },
  { id: "candidates" as const, label: "候補" },
  { id: "expenses" as const, label: "費用" },
  { id: "souvenirs" as const, label: "お土産" },
];

// candidateCount badge:
const spTripTabs = SWIPE_TABS.map((t) =>
  t.id === "candidates" ? { ...t, badge: dnd.localCandidates.length } : t,
);

const isSwipableTab = SWIPE_TABS.some((t) => t.id === mobileTab);
```

JSX:
```tsx
<div>
  <SpSwipeTabs
    tabs={spTripTabs}
    activeTab={mobileTab}
    onTabChange={handleMobileTabChange}
    renderContent={renderTabContent}
    swipeEnabled={isSwipableTab && !!trip}
    preserveScroll
    scrollRef={spScrollRef}
    className="my-2"
  />
  {!isSwipableTab && (
    <div className="pb-20">{renderTabContent(mobileTab)}</div>
  )}
</div>
```

- [x] **Step 5: translateY 補正ロジックを削除**

lines 329-361 (`compensatedElRef`, `isActivelySwiping`, `useLayoutEffect` for compensation) を削除。
lines 367-374 (overflow 制御の `useLayoutEffect`) を削除。
`compensatedElRef` ref (line 329) を削除。
`isActivelySwiping` (line 330) を削除。

- [x] **Step 6: テスト・型チェック**

Run: `bun run check-types`
Expected: PASS

- [x] **Step 7: Commit**

```bash
git add apps/web/components/sp-swipe-tabs.tsx apps/web/app/\(sp\)/sp/trips/\[id\]/page.tsx
git commit -m "refactor: SP tripsページをSpSwipeTabsに置き換え"
```

---

### Task 7: authenticated trips ページのモバイルレイアウト置き換え

**Files:**
- Modify: `apps/web/app/(authenticated)/trips/[id]/page.tsx`

authenticated trips ページはデスクトップとモバイルの両レイアウトを持つ。モバイル部分 (lg:hidden) のみ SpSwipeTabs に置き換える。

- [x] **Step 1: import 変更**

```tsx
// Remove:
import {
  getMobileTabIds,
  getMobileTabPanelId,
  getMobileTabTriggerId,
  type MobileContentTab,
  MobileContentTabs,
} from "@/components/mobile-content-tabs";
import { useSwipeTab } from "@/lib/hooks/use-swipe-tab";

// Add:
import { SpSwipeTabs, getMobileTabTriggerId, getMobileTabPanelId } from "@/components/sp-swipe-tabs";
```

`MobileContentTab` 型をローカルで定義:
```tsx
type MobileContentTab = "schedule" | "candidates" | "expenses" | "souvenirs";
```

注意: デスクトップレイアウトで `getMobileTabPanelId` / `getMobileTabTriggerId` を ARIA 参照に使っている場合がある。`SpSwipeTabs` から named export する。

- [x] **Step 2: swipe 関連を削除・簡素化**

以下を削除:
- `scrollPositions` ref (line 255)
- `mobileContentRef` ref (line 256)
- `swipeContainerRef` ref (line 257)
- `tapTransitionRef` ref (line 258)
- `useLayoutEffect` for scroll restore (lines 534-536)
- `handleSwipe` (lines 547-557)
- `tabIds` memo (line 559)
- `currentTabIdx` (line 560)
- `canSwipeMobileTabs` (line 561)
- `useSwipeTab` 呼び出し (lines 562-567)
- `isActivelySwiping` (line 673)
- `adjacentTabId` (lines 674-676)

`handleMobileTabChange` を簡素化:
```tsx
const handleMobileTabChange = useCallback((tab: MobileContentTab, source?: "tap") => {
  mobileTabRef.current = tab;
  setMobileTab(tab);
}, []);
```

注意: `source?: "tap"` は既存の呼び出し元 (`TripHeader`) との互換性のために残す。ただし `SpSwipeTabs` の `onTabChange` は `source` 引数を渡さないので問題ない。

- [x] **Step 3: モバイルレイアウト JSX を置き換え**

lines 893-948 のモバイルレイアウトを:

```tsx
const MOBILE_SWIPE_TABS = [
  { id: "schedule" as const, label: "予定" },
  { id: "candidates" as const, label: "候補" },
  { id: "expenses" as const, label: "費用" },
  { id: "souvenirs" as const, label: "お土産" },
];

const mobileTripTabs = MOBILE_SWIPE_TABS.map((t) =>
  t.id === "candidates" ? { ...t, badge: dnd.localCandidates.length } : t,
);

const isSwipableTab = MOBILE_SWIPE_TABS.some((t) => t.id === mobileTab);
```

```tsx
{/* Mobile layout */}
<div className="lg:hidden" inert={isLg || undefined}>
  <SpSwipeTabs
    tabs={mobileTripTabs}
    activeTab={mobileTab}
    onTabChange={handleMobileTabChange}
    renderContent={renderTabContent}
    swipeEnabled={isSwipableTab && !isLoading && !!trip}
    className="my-2"
  />
  {!isSwipableTab && (
    <div className="pb-20">{renderTabContent(mobileTab)}</div>
  )}
</div>
```

注意: authenticated trips ページのモバイルレイアウトでは `preserveScroll` を使わない（デスクトップレイアウトでは `mobileContentRef` が独立したスクロールコンテナだったが、`SpSwipeTabs` の内部コンテナに委ねる）。必要に応じて後から `preserveScroll` を追加できる。

- [x] **Step 4: デスクトップレイアウトの ARIA 参照を確認**

デスクトップレイアウト (lines 950+) で `getMobileTabPanelId` / `getMobileTabTriggerId` を使っている箇所があれば、import 元を `@/components/sp-swipe-tabs` に変更済みなので問題ない。

- [x] **Step 5: テスト・型チェック**

Run: `bun run check-types`
Expected: PASS

- [x] **Step 6: Commit**

```bash
git add apps/web/app/\(authenticated\)/trips/\[id\]/page.tsx
git commit -m "refactor: authenticated tripsページのモバイルレイアウトをSpSwipeTabsに置き換え"
```

---

## Chunk 4: クリーンアップ

### Task 8: 旧コンポーネント削除

**Files:**
- Delete: `apps/web/components/mobile-content-tabs.tsx`
- Delete: `apps/web/lib/__tests__/mobile-content-tabs.test.tsx`

- [x] **Step 1: 残存参照がないことを確認**

`mobile-content-tabs` を import している箇所を検索。SP trips と authenticated trips 以外にないことを確認。

- [x] **Step 2: ファイル削除**

```bash
rm apps/web/components/mobile-content-tabs.tsx
rm apps/web/lib/__tests__/mobile-content-tabs.test.tsx
```

- [x] **Step 3: テスト・型チェック**

Run: `bun run check-types`
Expected: PASS

Run: `bun run --filter @sugara/web test`
Expected: ALL PASS

- [x] **Step 4: Commit**

```bash
git add -u apps/web/components/mobile-content-tabs.tsx apps/web/lib/__tests__/mobile-content-tabs.test.tsx
git commit -m "refactor: MobileContentTabsを削除（SpSwipeTabsに統合済み）"
```

---

### Task 9: active:scale 削除

**Files:**
- Modify: `apps/web/components/sp-bottom-nav.tsx` (line 20)
- Modify: `apps/web/app/(authenticated)/settings/page.tsx` (line 192)

- [x] **Step 1: sp-bottom-nav.tsx の active:scale を削除**

`apps/web/components/sp-bottom-nav.tsx` line 20:
```tsx
// Before:
"relative flex flex-1 flex-col items-center justify-center gap-1 outline-none [-webkit-tap-highlight-color:transparent] transition-transform active:scale-[0.90]"

// After:
"relative flex flex-1 flex-col items-center justify-center gap-1 outline-none [-webkit-tap-highlight-color:transparent]"
```

`transition-transform` も `active:scale` がなくなったので不要。削除。

- [x] **Step 2: settings ページの SP版タブの active:scale を削除**

`apps/web/app/(authenticated)/settings/page.tsx` line 192:
```tsx
// Before:
"min-h-[36px] rounded-md px-2 py-1.5 text-sm font-medium transition-[colors,transform] active:scale-[0.97]",

// After (SP only, desktop keeps active:scale via md: prefix):
"min-h-[36px] rounded-md px-2 py-1.5 text-sm font-medium",
```

注意: settings ページのタブはレスポンシブで、SPではグリッド、デスクトップではサイドバーに変わる。line 194 に `md:active:scale-100` があるので、デスクトップでは既に無効化されている。SP版の `active:scale-[0.97]` を削除し、`transition-[colors,transform]` も不要になるので削除。

- [x] **Step 3: 型チェック**

Run: `bun run check-types`
Expected: PASS

- [x] **Step 4: Commit**

```bash
git add apps/web/components/sp-bottom-nav.tsx apps/web/app/\(authenticated\)/settings/page.tsx
git commit -m "refactor: SP版のactive:scaleを削除（ネイティブアプリ規約に準拠）"
```

---

### Task 10: 最終検証

- [x] **Step 1: 全テスト実行**

Run: `bun run test`
Expected: ALL PASS

- [x] **Step 2: lint・format**

Run: `bun run check`
Expected: PASS

- [x] **Step 3: 型チェック**

Run: `bun run check-types`
Expected: PASS
