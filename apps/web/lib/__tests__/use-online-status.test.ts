import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useOnlineStatus } from "../hooks/use-online-status";

describe("useOnlineStatus", () => {
  const listeners: Record<string, EventListener> = {};

  beforeEach(() => {
    vi.stubGlobal("navigator", { onLine: true });
    vi.spyOn(window, "addEventListener").mockImplementation(
      (event: string, handler: EventListenerOrEventListenerObject) => {
        listeners[event] = handler as EventListener;
      },
    );
    vi.spyOn(window, "removeEventListener").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    for (const key of Object.keys(listeners)) {
      delete listeners[key];
    }
  });

  it("returns true when online", () => {
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);
  });

  it("returns false when offline", () => {
    vi.stubGlobal("navigator", { onLine: false });
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(false);
  });

  it("updates when going offline", () => {
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);

    act(() => {
      vi.stubGlobal("navigator", { onLine: false });
      listeners.offline(new Event("offline"));
    });
    expect(result.current).toBe(false);
  });

  it("updates when going online", () => {
    vi.stubGlobal("navigator", { onLine: false });
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(false);

    act(() => {
      vi.stubGlobal("navigator", { onLine: true });
      listeners.online(new Event("online"));
    });
    expect(result.current).toBe(true);
  });
});
