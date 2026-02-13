import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useDelayedLoading } from "../use-delayed-loading";

describe("useDelayedLoading", () => {
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

    vi.useRealTimers();
  });

  it("returns false when loading finishes before the delay", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ loading }) => useDelayedLoading(loading, 200),
      { initialProps: { loading: true } },
    );

    act(() => vi.advanceTimersByTime(100));
    rerender({ loading: false });

    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe(false);

    vi.useRealTimers();
  });

  it("resets to false when loading becomes false", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ loading }) => useDelayedLoading(loading, 200),
      { initialProps: { loading: true } },
    );

    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe(true);

    rerender({ loading: false });
    expect(result.current).toBe(false);

    vi.useRealTimers();
  });

  it("uses 200ms as default delay", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useDelayedLoading(true));

    act(() => vi.advanceTimersByTime(199));
    expect(result.current).toBe(false);

    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(true);

    vi.useRealTimers();
  });
});
