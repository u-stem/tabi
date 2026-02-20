import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MobileContentTabs } from "../../components/mobile-content-tabs";

describe("MobileContentTabs", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders three tabs", () => {
    render(<MobileContentTabs activeTab="schedule" onTabChange={vi.fn()} candidateCount={0} />);
    expect(screen.getByRole("tab", { name: "予定" })).toBeDefined();
    expect(screen.getByRole("tab", { name: "候補" })).toBeDefined();
    expect(screen.getByRole("tab", { name: "費用" })).toBeDefined();
  });

  it("marks active tab as selected", () => {
    render(<MobileContentTabs activeTab="candidates" onTabChange={vi.fn()} candidateCount={3} />);
    const tabs = screen.getAllByRole("tab");
    const candidatesTab = tabs.find((t) => t.getAttribute("aria-selected") === "true");
    expect(candidatesTab?.textContent).toContain("候補");
  });

  it("calls onTabChange when tab is clicked", () => {
    const onChange = vi.fn();
    render(<MobileContentTabs activeTab="schedule" onTabChange={onChange} candidateCount={0} />);
    fireEvent.click(screen.getByRole("tab", { name: "費用" }));
    expect(onChange).toHaveBeenCalledWith("expenses");
  });

  it("shows candidate count badge when count is positive", () => {
    render(<MobileContentTabs activeTab="schedule" onTabChange={vi.fn()} candidateCount={5} />);
    expect(screen.getByText("5")).toBeDefined();
  });

  it("hides candidate count badge when count is zero", () => {
    render(<MobileContentTabs activeTab="schedule" onTabChange={vi.fn()} candidateCount={0} />);
    expect(screen.queryByText("0")).toBeNull();
  });
});
