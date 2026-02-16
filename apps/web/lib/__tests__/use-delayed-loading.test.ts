import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDelayedLoading } from "../hooks/use-delayed-loading";

describe("useDelayedLoading", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns false initially even when loading is true", () => {
    const { result } = renderHook(() => useDelayedLoading(true));
    expect(result.current).toBe(false);
  });

  it("returns true after the delay when still loading", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useDelayedLoading(true, 200));

    act(() => vi.advanceTimersByTime(199));
    expect(result.current).toBe(false);

    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(true);
  });

  it("returns false when loading finishes before the delay", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ loading }) => useDelayedLoading(loading, 200), {
      initialProps: { loading: true },
    });

    act(() => vi.advanceTimersByTime(100));
    rerender({ loading: false });

    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe(false);
  });

  it("stays visible for minimum delay after being shown", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ loading }) => useDelayedLoading(loading, 200), {
      initialProps: { loading: true },
    });

    // Skeleton appears at 200ms
    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe(true);

    // Loading finishes at 230ms (30ms after skeleton shown)
    act(() => vi.advanceTimersByTime(30));
    rerender({ loading: false });
    // Still visible because minimum display time not met
    expect(result.current).toBe(true);

    // At 370ms (170ms after loading=false), still showing
    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe(true);

    // At 400ms (200ms after skeleton shown), minimum met
    act(() => vi.advanceTimersByTime(70));
    expect(result.current).toBe(false);
  });

  it("hides immediately if shown for longer than minimum delay", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ loading }) => useDelayedLoading(loading, 200), {
      initialProps: { loading: true },
    });

    // Skeleton appears at 200ms
    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe(true);

    // Loading finishes at 500ms (300ms after skeleton shown)
    act(() => vi.advanceTimersByTime(300));
    rerender({ loading: false });
    // Already shown for 300ms > 200ms minimum, hides immediately
    expect(result.current).toBe(false);
  });

  it("uses 200ms as default delay", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useDelayedLoading(true));

    act(() => vi.advanceTimersByTime(199));
    expect(result.current).toBe(false);

    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(true);
  });
});
