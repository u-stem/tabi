import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePullToRefresh } from "../hooks/use-pull-to-refresh";

type TouchListener = (e: Partial<TouchEvent>) => void;

function captureListeners() {
  const listeners: Record<string, TouchListener> = {};
  vi.spyOn(document, "addEventListener").mockImplementation(
    (event: string, handler: EventListenerOrEventListenerObject) => {
      listeners[event] = handler as TouchListener;
    },
  );
  vi.spyOn(document, "removeEventListener").mockImplementation(() => {});
  return listeners;
}

function touchEvent(clientY: number): Partial<TouchEvent> {
  const touch = { clientY } as Touch;
  const touches = Object.assign([touch], { item: (i: number) => [touch][i] ?? null });
  return { touches: touches as unknown as TouchList };
}

describe("usePullToRefresh", () => {
  let scrollY: number;

  beforeEach(() => {
    scrollY = 0;
    Object.defineProperty(window, "scrollY", { get: () => scrollY, configurable: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registers touch listeners when enabled", () => {
    const listeners = captureListeners();
    renderHook(() => usePullToRefresh({ onRefresh: vi.fn(), enabled: true }));

    expect(listeners.touchstart).toBeDefined();
    expect(listeners.touchmove).toBeDefined();
    expect(listeners.touchend).toBeDefined();
  });

  it("does not register listeners when disabled", () => {
    const listeners = captureListeners();
    renderHook(() => usePullToRefresh({ onRefresh: vi.fn(), enabled: false }));

    expect(listeners.touchstart).toBeUndefined();
    expect(listeners.touchmove).toBeUndefined();
    expect(listeners.touchend).toBeUndefined();
  });

  it("updates pullDistance with 0.4x damping on downward swipe", () => {
    const listeners = captureListeners();
    const { result } = renderHook(() =>
      usePullToRefresh({ onRefresh: vi.fn().mockResolvedValue(undefined) }),
    );

    act(() => {
      listeners.touchstart(touchEvent(100));
    });
    act(() => {
      listeners.touchmove(touchEvent(200));
    });

    // 100px raw distance * 0.4 = 40px dampened
    expect(result.current.pullDistance).toBe(40);
    expect(result.current.pulling).toBe(true);
  });

  it("calls onRefresh when pullDistance >= threshold on touchend", async () => {
    const listeners = captureListeners();
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => usePullToRefresh({ onRefresh }));

    act(() => {
      listeners.touchstart(touchEvent(0));
    });
    // 200px * 0.4 = 80px >= 60px threshold
    act(() => {
      listeners.touchmove(touchEvent(200));
    });
    await act(async () => {
      listeners.touchend({});
    });

    expect(onRefresh).toHaveBeenCalledOnce();
    expect(result.current.pullDistance).toBe(0);
  });

  it("resets pullDistance when below threshold on touchend", () => {
    const listeners = captureListeners();
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => usePullToRefresh({ onRefresh }));

    act(() => {
      listeners.touchstart(touchEvent(100));
    });
    // 50px * 0.4 = 20px < 60px threshold
    act(() => {
      listeners.touchmove(touchEvent(150));
    });
    act(() => {
      listeners.touchend({});
    });

    expect(onRefresh).not.toHaveBeenCalled();
    expect(result.current.pullDistance).toBe(0);
  });

  it("ignores pull when page is scrolled", () => {
    const listeners = captureListeners();
    const { result } = renderHook(() =>
      usePullToRefresh({ onRefresh: vi.fn().mockResolvedValue(undefined) }),
    );

    scrollY = 100;
    act(() => {
      listeners.touchstart(touchEvent(100));
    });
    act(() => {
      listeners.touchmove(touchEvent(300));
    });

    expect(result.current.pullDistance).toBe(0);
    expect(result.current.pulling).toBe(false);
  });

  it("ignores touchmove while refreshing", () => {
    const listeners = captureListeners();
    let resolveRefresh!: () => void;
    const onRefresh = vi.fn(
      () => new Promise<void>((resolve) => { resolveRefresh = resolve; }),
    );
    const { result } = renderHook(() => usePullToRefresh({ onRefresh }));

    // Trigger refresh
    act(() => { listeners.touchstart(touchEvent(0)); });
    act(() => { listeners.touchmove(touchEvent(200)); });
    act(() => { listeners.touchend({}); });

    // Try to pull again while refreshing
    act(() => { listeners.touchstart(touchEvent(0)); });
    act(() => { listeners.touchmove(touchEvent(300)); });

    // 300 * 0.4 = 120 would appear if not ignored; stays at 80 from first pull
    expect(result.current.pullDistance).toBe(80);

    // Cleanup: avoid unhandled promise
    resolveRefresh();
  });

  it("does not call onRefresh again while refreshing", () => {
    const listeners = captureListeners();
    let resolveRefresh!: () => void;
    const onRefresh = vi.fn(
      () => new Promise<void>((resolve) => { resolveRefresh = resolve; }),
    );
    renderHook(() => usePullToRefresh({ onRefresh }));

    // Trigger refresh
    act(() => { listeners.touchstart(touchEvent(0)); });
    act(() => { listeners.touchmove(touchEvent(200)); });
    act(() => { listeners.touchend({}); });

    // Second pull + touchend while refreshing
    act(() => { listeners.touchstart(touchEvent(0)); });
    act(() => { listeners.touchmove(touchEvent(200)); });
    act(() => { listeners.touchend({}); });

    expect(onRefresh).toHaveBeenCalledOnce();

    resolveRefresh();
  });

  it("resets state when refresh completes", async () => {
    const listeners = captureListeners();
    let resolveRefresh!: () => void;
    const onRefresh = vi.fn(
      () => new Promise<void>((resolve) => { resolveRefresh = resolve; }),
    );
    const { result } = renderHook(() => usePullToRefresh({ onRefresh }));

    act(() => { listeners.touchstart(touchEvent(0)); });
    act(() => { listeners.touchmove(touchEvent(200)); });
    act(() => { listeners.touchend({}); });

    await act(async () => { resolveRefresh(); });

    expect(result.current.refreshing).toBe(false);
    expect(result.current.pullDistance).toBe(0);
  });
});
