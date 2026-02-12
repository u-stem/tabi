import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useOnlineStatus } from "../hooks/use-online-status";

describe("useOnlineStatus", () => {
  const listeners: Record<string, EventListener> = {};

  beforeEach(() => {
    vi.stubGlobal("navigator", { onLine: true });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("ok", { status: 200 })));
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

  it("returns true when navigator.onLine is true", () => {
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);
  });

  it("verifies connectivity on mount when navigator.onLine is false", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const { result } = renderHook(() => useOnlineStatus());

    // Verification fetch succeeds → still online
    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });

  it("goes offline on mount when navigator.onLine is false and fetch fails", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));
    const { result } = renderHook(() => useOnlineStatus());

    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });

  it("stays online when offline event fires but fetch succeeds", async () => {
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);

    await act(async () => {
      listeners.offline(new Event("offline"));
    });

    expect(result.current).toBe(true);
  });

  it("goes offline when offline event fires and fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);

    await act(async () => {
      listeners.offline(new Event("offline"));
    });

    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });

  it("discards stale offline verification when online event arrives first", async () => {
    let fetchResolve: () => void;
    const slowFetch = new Promise<Response>((resolve) => {
      fetchResolve = () => resolve(new Response("", { status: 503 }));
    });
    // First call (mount verification) succeeds immediately
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("ok", { status: 200 }))
      .mockReturnValueOnce(slowFetch);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);

    // Offline event triggers slow verification
    act(() => {
      listeners.offline(new Event("offline"));
    });

    // Online event arrives before verification completes
    act(() => {
      listeners.online(new Event("online"));
    });
    expect(result.current).toBe(true);

    // Stale verification finally resolves → should NOT override online state
    await act(async () => {
      fetchResolve!();
    });

    expect(result.current).toBe(true);
  });

  it("updates when going online after being offline", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));
    const { result } = renderHook(() => useOnlineStatus());

    await waitFor(() => {
      expect(result.current).toBe(false);
    });

    act(() => {
      vi.stubGlobal("navigator", { onLine: true });
      listeners.online(new Event("online"));
    });
    expect(result.current).toBe(true);
  });
});
