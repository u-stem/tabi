import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useIsMobile } from "../hooks/use-is-mobile";

function mockMatchMedia(matches: boolean, legacy = false) {
  const listeners: Array<(e: { matches: boolean }) => void> = [];
  const mql = {
    matches,
    addEventListener: legacy
      ? undefined
      : vi.fn((_: string, cb: (e: { matches: boolean }) => void) => {
          listeners.push(cb);
        }),
    removeEventListener: legacy
      ? undefined
      : vi.fn((_: string, cb: (e: { matches: boolean }) => void) => {
          const idx = listeners.indexOf(cb);
          if (idx >= 0) listeners.splice(idx, 1);
        }),
    addListener: vi.fn((cb: (e: { matches: boolean }) => void) => {
      listeners.push(cb);
    }),
    removeListener: vi.fn((cb: (e: { matches: boolean }) => void) => {
      const idx = listeners.indexOf(cb);
      if (idx >= 0) listeners.splice(idx, 1);
    }),
  };
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => mql),
  );
  return { mql, listeners };
}

describe("useIsMobile", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses configured mobile media query", () => {
    mockMatchMedia(true);
    renderHook(() => useIsMobile());
    expect(matchMedia).toHaveBeenCalledWith("(max-width: 767px)");
  });

  it("returns true when viewport is narrow", () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it("returns false when viewport is wide", () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it("updates when media query changes", () => {
    const { mql, listeners } = mockMatchMedia(false);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    act(() => {
      mql.matches = true;
      for (const cb of listeners) cb({ matches: true });
    });
    expect(result.current).toBe(true);
  });

  it("cleans up listener on unmount", () => {
    const { mql } = mockMatchMedia(false);
    const { unmount } = renderHook(() => useIsMobile());
    unmount();
    expect(mql.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });

  it("falls back to addListener/removeListener on legacy MediaQueryList", () => {
    const { mql } = mockMatchMedia(false, true);
    const { unmount } = renderHook(() => useIsMobile());
    expect(mql.addListener).toHaveBeenCalledWith(expect.any(Function));
    unmount();
    expect(mql.removeListener).toHaveBeenCalledWith(expect.any(Function));
  });
});
