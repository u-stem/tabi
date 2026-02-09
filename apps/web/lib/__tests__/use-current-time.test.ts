import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCurrentTime } from "../hooks/use-current-time";

describe("useCurrentTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns current time in HH:MM format", () => {
    vi.setSystemTime(new Date(2026, 1, 9, 14, 30));
    const { result } = renderHook(() => useCurrentTime());
    expect(result.current).toBe("14:30");
  });

  it("updates every minute", () => {
    vi.setSystemTime(new Date(2026, 1, 9, 14, 30, 0));
    const { result } = renderHook(() => useCurrentTime());
    expect(result.current).toBe("14:30");

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current).toBe("14:31");
  });

  it("pads single-digit hours and minutes with zero", () => {
    vi.setSystemTime(new Date(2026, 1, 9, 9, 5));
    const { result } = renderHook(() => useCurrentTime());
    expect(result.current).toBe("09:05");
  });

  it("cleans up interval on unmount", () => {
    const clearSpy = vi.spyOn(globalThis, "clearInterval");
    const { unmount } = renderHook(() => useCurrentTime());
    unmount();
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});
