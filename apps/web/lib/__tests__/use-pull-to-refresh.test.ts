import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePullToRefresh } from "../hooks/use-pull-to-refresh";

function createMockElement(scrollTop = 0) {
  const listeners: Record<string, EventListener> = {};
  return {
    el: {
      scrollTop,
      addEventListener: vi.fn((event: string, handler: EventListener) => {
        listeners[event] = handler;
      }),
      removeEventListener: vi.fn((event: string) => {
        delete listeners[event];
      }),
    } as unknown as HTMLElement,
    listeners,
  };
}

function fireTouchStart(listeners: Record<string, EventListener>, x: number, y: number) {
  listeners.touchstart?.({
    touches: [{ clientX: x, clientY: y }],
  } as unknown as Event);
}

function fireTouchMove(
  listeners: Record<string, EventListener>,
  x: number,
  y: number,
  cancelable = true,
) {
  const prevented = { called: false };
  listeners.touchmove?.({
    touches: [{ clientX: x, clientY: y }],
    cancelable,
    preventDefault: () => {
      prevented.called = true;
    },
  } as unknown as Event);
  return prevented;
}

function fireTouchEnd(listeners: Record<string, EventListener>) {
  listeners.touchend?.({} as unknown as Event);
}

describe("usePullToRefresh", () => {
  const onRefresh = vi.fn(() => Promise.resolve());

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("activates pull on downward swipe", () => {
    const mock = createMockElement();
    const ref = { current: mock.el };

    const { result } = renderHook(() => usePullToRefresh(ref, null, onRefresh));

    act(() => {
      fireTouchStart(mock.listeners, 100, 0);
      fireTouchMove(mock.listeners, 100, 100);
    });

    expect(result.current.pulling).toBe(true);
    expect(result.current.pullDistance).toBeGreaterThan(0);
  });

  it("does not activate pull on horizontal swipe", () => {
    const mock = createMockElement();
    const ref = { current: mock.el };

    const { result } = renderHook(() => usePullToRefresh(ref, null, onRefresh));

    act(() => {
      fireTouchStart(mock.listeners, 100, 0);
      const prevented = fireTouchMove(mock.listeners, 250, 10);
      expect(prevented.called).toBe(false);
    });

    expect(result.current.pulling).toBe(false);
    expect(result.current.pullDistance).toBe(0);
  });

  it("does not preventDefault when deltaX > deltaY", () => {
    const mock = createMockElement();
    const ref = { current: mock.el };

    renderHook(() => usePullToRefresh(ref, null, onRefresh));

    act(() => {
      fireTouchStart(mock.listeners, 100, 100);
    });

    // Diagonal swipe — more horizontal than vertical
    let prevented: { called: boolean } = { called: false };
    act(() => {
      prevented = fireTouchMove(mock.listeners, 200, 130);
    });
    expect(prevented.called).toBe(false);
  });

  it("calls preventDefault on vertical pull", () => {
    const mock = createMockElement();
    const ref = { current: mock.el };

    renderHook(() => usePullToRefresh(ref, null, onRefresh));

    act(() => {
      fireTouchStart(mock.listeners, 100, 0);
    });

    let prevented: { called: boolean } = { called: false };
    act(() => {
      prevented = fireTouchMove(mock.listeners, 105, 100);
    });
    expect(prevented.called).toBe(true);
  });

  it("triggers refresh when pulled past threshold", async () => {
    const mock = createMockElement();
    const ref = { current: mock.el };

    const { result } = renderHook(() => usePullToRefresh(ref, null, onRefresh));

    act(() => {
      fireTouchStart(mock.listeners, 100, 0);
      // Pull distance = deltaY * 0.5; threshold = 80; need deltaY >= 160
      fireTouchMove(mock.listeners, 100, 200);
    });

    await act(async () => {
      fireTouchEnd(mock.listeners);
    });

    expect(onRefresh).toHaveBeenCalledOnce();
    expect(result.current.refreshing).toBe(false);
  });

  it("does not trigger refresh when pulled below threshold", async () => {
    const mock = createMockElement();
    const ref = { current: mock.el };

    renderHook(() => usePullToRefresh(ref, null, onRefresh));

    act(() => {
      fireTouchStart(mock.listeners, 100, 0);
      fireTouchMove(mock.listeners, 100, 50);
    });

    await act(async () => {
      fireTouchEnd(mock.listeners);
    });

    expect(onRefresh).not.toHaveBeenCalled();
  });
});
