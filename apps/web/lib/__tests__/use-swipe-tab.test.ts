import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSwipeTab } from "../hooks/use-swipe-tab";

function createMockElement(width = 375) {
  const listeners: Record<string, EventListener> = {};
  return {
    el: {
      offsetWidth: width,
      offsetHeight: 0,
      style: { transform: "", transition: "", willChange: "" },
      addEventListener: vi.fn((event: string, handler: EventListener, _opts?: unknown) => {
        listeners[event] = handler;
      }),
      removeEventListener: vi.fn((event: string, _handler: EventListener, _capture?: boolean) => {
        delete listeners[event];
      }),
    } as unknown as HTMLElement,
    listeners,
  };
}

function touch(clientX: number, clientY = 0) {
  return { clientX, clientY };
}

function fireTouchStart(listeners: Record<string, EventListener>, x: number, y = 0) {
  listeners.touchstart?.({ touches: [touch(x, y)] } as unknown as Event);
}

function fireTouchMove(listeners: Record<string, EventListener>, x: number, y = 0) {
  listeners.touchmove?.({ touches: [touch(x, y)] } as unknown as Event);
}

function fireTouchEnd(listeners: Record<string, EventListener>, x: number, y = 0) {
  listeners.touchend?.({ changedTouches: [touch(x, y)] } as unknown as Event);
}

describe("useSwipeTab", () => {
  let container: ReturnType<typeof createMockElement>;
  let swipeEl: ReturnType<typeof createMockElement>;

  beforeEach(() => {
    container = createMockElement();
    swipeEl = createMockElement();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function renderSwipeHook(overrides: Partial<Parameters<typeof useSwipeTab>[2]> = {}) {
    const containerRef = { current: container.el };
    const swipeRef = { current: swipeEl.el };
    return renderHook(
      (props) =>
        useSwipeTab(containerRef, swipeRef, {
          onSwipeComplete: props.onSwipeComplete,
          enabled: props.enabled,
          canSwipePrev: props.canSwipePrev,
          canSwipeNext: props.canSwipeNext,
        }),
      {
        initialProps: {
          onSwipeComplete: vi.fn() as (direction: "left" | "right") => void,
          enabled: true,
          canSwipePrev: true,
          canSwipeNext: true,
          ...overrides,
        },
      },
    );
  }

  it("registers listeners with capture: true", () => {
    renderSwipeHook();

    const calls = container.el.addEventListener as ReturnType<typeof vi.fn>;
    const touchStartCall = calls.mock.calls.find(
      (c: unknown[]) => c[0] === "touchstart",
    );
    expect(touchStartCall).toBeDefined();
    expect(touchStartCall![2]).toEqual({ passive: true, capture: true });
  });

  it("does not register listeners when disabled", () => {
    renderSwipeHook({ enabled: false });

    const calls = container.el.addEventListener as ReturnType<typeof vi.fn>;
    expect(calls).not.toHaveBeenCalled();
  });

  it("locks axis as horizontal when dx exceeds dy * bias", () => {
    const onSwipeComplete = vi.fn();
    renderSwipeHook({ onSwipeComplete });

    act(() => {
      fireTouchStart(container.listeners, 200);
      // Move horizontally past lock threshold
      fireTouchMove(container.listeners, 170, 0);
    });

    // swipeEl should have transform applied
    expect(swipeEl.el.style.transform).toBe("translateX(-30px)");
  });

  it("ignores touch when vertical movement dominates", () => {
    const onSwipeComplete = vi.fn();
    renderSwipeHook({ onSwipeComplete });

    act(() => {
      fireTouchStart(container.listeners, 200, 0);
      // Move vertically past lock threshold
      fireTouchMove(container.listeners, 200, 30);
      fireTouchEnd(container.listeners, 100, 30);
    });

    // No transform should be applied for vertical swipe
    expect(onSwipeComplete).not.toHaveBeenCalled();
  });

  it("sets adjacent to 'next' when swiping left", () => {
    const { result } = renderSwipeHook();

    act(() => {
      fireTouchStart(container.listeners, 200);
      fireTouchMove(container.listeners, 170, 0);
    });

    expect(result.current.adjacent).toBe("next");
  });

  it("sets adjacent to 'prev' when swiping right", () => {
    const { result } = renderSwipeHook();

    act(() => {
      fireTouchStart(container.listeners, 100);
      fireTouchMove(container.listeners, 130, 0);
    });

    expect(result.current.adjacent).toBe("prev");
  });

  it("applies rubber-band when at last tab (canSwipeNext: false)", () => {
    renderSwipeHook({ canSwipeNext: false });

    act(() => {
      fireTouchStart(container.listeners, 200);
      fireTouchMove(container.listeners, 140, 0);
    });

    // dx=-60, rubber-band: -60/3 = -20
    expect(swipeEl.el.style.transform).toBe("translateX(-20px)");
  });

  it("applies rubber-band when at first tab (canSwipePrev: false)", () => {
    renderSwipeHook({ canSwipePrev: false });

    act(() => {
      fireTouchStart(container.listeners, 100);
      fireTouchMove(container.listeners, 160, 0);
    });

    // dx=60, rubber-band: 60/3 = 20
    expect(swipeEl.el.style.transform).toBe("translateX(20px)");
  });

  it("completes swipe when distance exceeds threshold", () => {
    const onSwipeComplete = vi.fn();
    renderSwipeHook({ onSwipeComplete });

    act(() => {
      fireTouchStart(container.listeners, 200);
      fireTouchMove(container.listeners, 140, 0);
      fireTouchEnd(container.listeners, 140, 0);
    });

    // Should set transition for snap animation
    expect(swipeEl.el.style.transition).toContain("transform");
    expect(swipeEl.el.style.transform).toBe("translateX(-375px)");
  });

  it("springs back when distance is below threshold", () => {
    renderSwipeHook();

    act(() => {
      fireTouchStart(container.listeners, 200);
      fireTouchMove(container.listeners, 185, 0);
      fireTouchEnd(container.listeners, 185, 0);
    });

    // Should snap back to origin
    expect(swipeEl.el.style.transition).toContain("transform");
    expect(swipeEl.el.style.transform).toBe("translateX(0px)");
  });

  it("completes swipe on high velocity even with short distance", () => {
    const onSwipeComplete = vi.fn();
    renderSwipeHook({ onSwipeComplete });

    // Mock Date.now for velocity calculation
    const now = Date.now();
    vi.spyOn(Date, "now")
      .mockReturnValueOnce(now) // touchstart
      .mockReturnValueOnce(now + 50); // touchend (50ms, 30px => 0.6px/ms > 0.3)

    act(() => {
      fireTouchStart(container.listeners, 200);
      fireTouchMove(container.listeners, 170, 0);
      fireTouchEnd(container.listeners, 170, 0);
    });

    expect(swipeEl.el.style.transform).toBe("translateX(-375px)");
  });

  it("does not complete swipe at edge even if threshold met", () => {
    renderSwipeHook({ canSwipeNext: false });

    act(() => {
      fireTouchStart(container.listeners, 200);
      fireTouchMove(container.listeners, 100, 0);
      fireTouchEnd(container.listeners, 100, 0);
    });

    // Should spring back (rubber-band), not snap to full width
    expect(swipeEl.el.style.transform).toBe("translateX(0px)");
  });
});
