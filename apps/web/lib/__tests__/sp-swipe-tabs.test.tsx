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

  it("moves focus to the target tab on ArrowRight", () => {
    renderTabs({ activeTab: "a" });
    const tabA = screen.getByRole("tab", { name: "Tab A" });
    tabA.focus();
    fireEvent.keyDown(tabA, { key: "ArrowRight" });
    expect(document.getElementById("mobile-tab-trigger-b")).toBe(document.activeElement);
  });

  it("sets correct trigger id on tab", () => {
    renderTabs();
    expect(screen.getByRole("tab", { name: "Tab A" }).getAttribute("id")).toBe(
      "mobile-tab-trigger-a",
    );
  });

  it("sets correct aria-controls on tab", () => {
    renderTabs();
    expect(screen.getByRole("tab", { name: "Tab A" }).getAttribute("aria-controls")).toBe(
      "mobile-tab-panel-a",
    );
  });

  it("renders all tab panels in DOM", () => {
    renderTabs({ activeTab: "a" });
    const panels = screen.getAllByRole("tabpanel", { hidden: true });
    expect(panels).toHaveLength(3);
  });

  it("sets inert on non-active tab panels", () => {
    renderTabs({ activeTab: "b" });
    const panelA = document.getElementById("mobile-tab-panel-a");
    const panelB = document.getElementById("mobile-tab-panel-b");
    const panelC = document.getElementById("mobile-tab-panel-c");
    expect(panelA?.hasAttribute("inert")).toBe(true);
    expect(panelB?.hasAttribute("inert")).toBe(false);
    expect(panelC?.hasAttribute("inert")).toBe(true);
  });

  it("sets correct id on active tabpanel", () => {
    renderTabs();
    const panel = document.getElementById("mobile-tab-panel-a");
    expect(panel).toBeDefined();
    expect(panel?.getAttribute("role")).toBe("tabpanel");
  });

  it("sets correct aria-labelledby on tabpanel", () => {
    renderTabs();
    const panel = document.getElementById("mobile-tab-panel-a");
    expect(panel?.getAttribute("aria-labelledby")).toBe("mobile-tab-trigger-a");
  });

  it("renders all tab contents", () => {
    renderTabs({ activeTab: "b" });
    expect(screen.getByText("Content a")).toBeDefined();
    expect(screen.getByText("Content b")).toBeDefined();
    expect(screen.getByText("Content c")).toBeDefined();
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
    expect(tabs.every((tab) => !tab.className.includes("active:scale"))).toBe(true);
  });

  it("does not have transition in tab button classes", () => {
    renderTabs();
    const tabs = screen.getAllByRole("tab");
    expect(tabs.every((tab) => !tab.className.includes("transition"))).toBe(true);
  });

  it("renders children between tab bar and scroll container", () => {
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

  it("hides scroll container when activeTab is not in tabs list", () => {
    render(
      <SpSwipeTabs
        tabs={[...TABS]}
        activeTab={"unknown" as string}
        onTabChange={vi.fn()}
        renderContent={(id) => <div>Content {id}</div>}
      />,
    );
    expect(screen.queryByRole("tabpanel", { hidden: true })).toBeNull();
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
    expect(tabs.every((tab) => tab.getAttribute("aria-selected") === "false")).toBe(true);
  });

  it("applies overflow-x-hidden when swipeEnabled is false", () => {
    renderTabs({ swipeEnabled: false });
    const panels = screen.getAllByRole("tabpanel", { hidden: true });
    const container = panels[0].parentElement;
    expect(container?.className).toContain("overflow-x-hidden");
    expect(container?.className).not.toContain("snap-x");
  });

  it("tab panels have overflow-y-auto for independent scroll", () => {
    renderTabs();
    const panels = screen.getAllByRole("tabpanel", { hidden: true });
    expect(panels.every((p) => p.className.includes("overflow-y-auto"))).toBe(true);
  });

  it("tab bar has sticky class", () => {
    renderTabs();
    const tablist = screen.getByRole("tablist");
    expect(tablist.className).toContain("sticky");
  });
});
