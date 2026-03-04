import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoadingBoundary } from "./loading-boundary";

describe("LoadingBoundary", () => {
  afterEach(cleanup);

  it("renders nothing during fast load (before 200ms delay)", () => {
    vi.useFakeTimers();
    const { container } = render(
      <LoadingBoundary isLoading skeleton={<div>skeleton</div>}>
        <div>content</div>
      </LoadingBoundary>,
    );
    expect(container.firstChild).toBeNull();
    vi.useRealTimers();
  });

  it("renders skeleton after 200ms delay elapses", async () => {
    vi.useFakeTimers();
    render(
      <LoadingBoundary isLoading skeleton={<div>skeleton</div>}>
        <div>content</div>
      </LoadingBoundary>,
    );
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByText("skeleton")).toBeDefined();
    vi.useRealTimers();
  });

  it("renders children when not loading", () => {
    render(
      <LoadingBoundary isLoading={false} skeleton={<div>skeleton</div>}>
        <div>content</div>
      </LoadingBoundary>,
    );
    expect(screen.getByText("content")).toBeDefined();
    expect(screen.queryByText("skeleton")).toBeNull();
  });

  it("renders errorFallback when error is provided and not loading", () => {
    render(
      <LoadingBoundary
        isLoading={false}
        skeleton={<div>skeleton</div>}
        error={new Error("fail")}
        errorFallback={<div>error ui</div>}
      >
        <div>content</div>
      </LoadingBoundary>,
    );
    expect(screen.getByText("error ui")).toBeDefined();
    expect(screen.queryByText("content")).toBeNull();
  });
});
