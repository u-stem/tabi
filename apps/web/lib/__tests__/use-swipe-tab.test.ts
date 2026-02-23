import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";
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

function createTarget(tagName: string, attrs?: Record<string, string>) {
  const el = document.createElement(tagName);
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      el.setAttribute(key, value);
    }
  }
  return el;
}

function pointer(
  clientX: number,
  clientY = 0,
  pointerId = 1,
  pointerType = "touch",
  target?: EventTarget | null,
) {
  return { clientX, clientY, pointerId, pointerType, target: target ?? null };
}

function touch(clientX: number, clientY = 0, target?: EventTarget | null) {
  return { clientX, clientY, target: target ?? null };
}

function fireTouchStart(
  listeners: Record<string, EventListener>,
  x: number,
  y = 0,
  target?: EventTarget | null,
) {
  listeners.touchstart?.({ touches: [touch(x, y, target)], target: target ?? null } as unknown as Event);
}

function fireTouchMove(listeners: Record<string, EventListener>, x: number, y = 0) {
  listeners.touchmove?.({ touches: [touch(x, y)] } as unknown as Event);
}

function fireTouchEnd(listeners: Record<string, EventListener>, x: number, y = 0) {
  listeners.touchend?.({ changedTouches: [touch(x, y)] } as unknown as Event);
}

function fireTouchCancel(listeners: Record<string, EventListener>) {
  listeners.touchcancel?.({} as Event);
}

function firePointerDown(
  listeners: Record<string, EventListener>,
  x: number,
  y = 0,
  pointerId = 1,
  pointerType = "touch",
  target?: EventTarget | null,
) {
  listeners.pointerdown?.(pointer(x, y, pointerId, pointerType, target) as unknown as Event);
}

function firePointerMove(
  listeners: Record<string, EventListener>,
  x: number,
  y = 0,
  pointerId = 1,
  pointerType = "touch",
) {
  listeners.pointermove?.(pointer(x, y, pointerId, pointerType) as unknown as Event);
}

function firePointerUp(
  listeners: Record<string, EventListener>,
  x: number,
  y = 0,
  pointerId = 1,
  pointerType = "touch",
) {
  listeners.pointerup?.(pointer(x, y, pointerId, pointerType) as unknown as Event);
}

function firePointerCancel(
  listeners: Record<string, EventListener>,
  x: number,
  y = 0,
  pointerId = 1,
  pointerType = "touch",
) {
  listeners.pointercancel?.(pointer(x, y, pointerId, pointerType) as unknown as Event);
}

describe("useSwipeTab", () => {
  let container: ReturnType<typeof createMockElement>;
  let swipeEl: ReturnType<typeof createMockElement>;
  let docListeners: Record<string, EventListener>;
  let addSpy: MockInstance;
  let removeSpy: MockInstance;

  beforeEach(() => {
    container = createMockElement();
    swipeEl = createMockElement();
    docListeners = {};
    vi.useFakeTimers();

    addSpy = vi
      .spyOn(document, "addEventListener")
      .mockImplementation(
        (event: string, handler: EventListenerOrEventListenerObject, _opts?: unknown) => {
          docListeners[event] = handler as EventListener;
        },
      );
    removeSpy = vi
      .spyOn(document, "removeEventListener")
      .mockImplementation(
        (event: string, _handler: EventListenerOrEventListenerObject, _opts?: unknown) => {
          delete docListeners[event];
        },
      );
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

  it("registers pointerdown on container with capture: true", () => {
    renderSwipeHook();

    const calls = container.el.addEventListener as ReturnType<typeof vi.fn>;
    const pointerDownCall = calls.mock.calls.find((c: unknown[]) => c[0] === "pointerdown");
    expect(pointerDownCall).toBeDefined();
    expect(pointerDownCall?.[2]).toEqual({ passive: true, capture: true });
  });

  it("registers pointermove/pointerup/pointercancel on document", () => {
    renderSwipeHook();

    const moveCall = addSpy.mock.calls.find((c: unknown[]) => c[0] === "pointermove");
    const upCall = addSpy.mock.calls.find((c: unknown[]) => c[0] === "pointerup");
    const cancelCall = addSpy.mock.calls.find((c: unknown[]) => c[0] === "pointercancel");
    expect(moveCall).toBeDefined();
    expect(upCall).toBeDefined();
    expect(cancelCall).toBeDefined();
    expect(moveCall?.[2]).toEqual({ passive: true });
    expect(upCall?.[2]).toEqual({ passive: true });
    expect(cancelCall?.[2]).toEqual({ passive: true });
  });

  it("registers touchmove/touchend/touchcancel on document", () => {
    renderSwipeHook();

    const moveCall = addSpy.mock.calls.find((c: unknown[]) => c[0] === "touchmove");
    const endCall = addSpy.mock.calls.find((c: unknown[]) => c[0] === "touchend");
    const cancelCall = addSpy.mock.calls.find((c: unknown[]) => c[0] === "touchcancel");
    expect(moveCall).toBeDefined();
    expect(endCall).toBeDefined();
    expect(cancelCall).toBeDefined();
    expect(moveCall?.[2]).toEqual({ passive: true });
    expect(endCall?.[2]).toEqual({ passive: true });
    expect(cancelCall?.[2]).toEqual({ passive: true });
  });

  it("does not register listeners when disabled", () => {
    renderSwipeHook({ enabled: false });

    const calls = container.el.addEventListener as ReturnType<typeof vi.fn>;
    expect(calls).not.toHaveBeenCalled();
    const moveCall = addSpy.mock.calls.find((c: unknown[]) => c[0] === "pointermove");
    expect(moveCall).toBeUndefined();
  });

  it("locks axis as horizontal when dx exceeds dy * bias (pointer)", () => {
    renderSwipeHook();

    act(() => {
      firePointerDown(container.listeners, 200);
      firePointerMove(docListeners, 170, 0);
    });

    expect(swipeEl.el.style.transform).toBe("translateX(-30px)");
  });

  it("ignores pointer when vertical movement dominates", () => {
    const onSwipeComplete = vi.fn();
    renderSwipeHook({ onSwipeComplete });

    act(() => {
      firePointerDown(container.listeners, 200, 0);
      firePointerMove(docListeners, 200, 30);
      firePointerUp(docListeners, 100, 30);
    });

    expect(onSwipeComplete).not.toHaveBeenCalled();
  });

  it("sets adjacent to 'next' when swiping left", () => {
    const { result } = renderSwipeHook();

    act(() => {
      firePointerDown(container.listeners, 200);
      firePointerMove(docListeners, 170, 0);
    });

    expect(result.current.adjacent).toBe("next");
  });

  it("sets adjacent to 'prev' when swiping right", () => {
    const { result } = renderSwipeHook();

    act(() => {
      firePointerDown(container.listeners, 100);
      firePointerMove(docListeners, 130, 0);
    });

    expect(result.current.adjacent).toBe("prev");
  });

  it("applies rubber-band when at last tab (canSwipeNext: false)", () => {
    renderSwipeHook({ canSwipeNext: false });

    act(() => {
      firePointerDown(container.listeners, 200);
      firePointerMove(docListeners, 140, 0);
    });

    // dx=-60, rubber-band: -60/3 = -20
    expect(swipeEl.el.style.transform).toBe("translateX(-20px)");
  });

  it("applies rubber-band when at first tab (canSwipePrev: false)", () => {
    renderSwipeHook({ canSwipePrev: false });

    act(() => {
      firePointerDown(container.listeners, 100);
      firePointerMove(docListeners, 160, 0);
    });

    // dx=60, rubber-band: 60/3 = 20
    expect(swipeEl.el.style.transform).toBe("translateX(20px)");
  });

  it("completes swipe when distance exceeds threshold", () => {
    renderSwipeHook();

    act(() => {
      firePointerDown(container.listeners, 200);
      firePointerMove(docListeners, 140, 0);
      firePointerUp(docListeners, 140, 0);
    });

    expect(swipeEl.el.style.transition).toContain("transform");
    expect(swipeEl.el.style.transform).toBe("translateX(-375px)");
  });

  it("springs back when distance is below threshold", () => {
    renderSwipeHook();

    act(() => {
      firePointerDown(container.listeners, 200);
      firePointerMove(docListeners, 180, 0);
      firePointerUp(docListeners, 180, 0);
    });

    expect(swipeEl.el.style.transition).toContain("transform");
    expect(swipeEl.el.style.transform).toBe("translateX(0px)");
  });

  it("completes swipe on high velocity even with short distance", () => {
    renderSwipeHook();

    const now = Date.now();
    vi.spyOn(Date, "now")
      .mockReturnValueOnce(now) // pointerdown
      .mockReturnValueOnce(now + 50); // pointerup (50ms, 30px => 0.6px/ms > 0.3)

    act(() => {
      firePointerDown(container.listeners, 200);
      firePointerMove(docListeners, 170, 0);
      firePointerUp(docListeners, 170, 0);
    });

    expect(swipeEl.el.style.transform).toBe("translateX(-375px)");
  });

  it("does not complete swipe at edge even if threshold met", () => {
    renderSwipeHook({ canSwipeNext: false });

    act(() => {
      firePointerDown(container.listeners, 200);
      firePointerMove(docListeners, 100, 0);
      firePointerUp(docListeners, 100, 0);
    });

    expect(swipeEl.el.style.transform).toBe("translateX(0px)");
  });

  it("ignores pointermove/pointerup without prior pointerdown on container", () => {
    renderSwipeHook();

    act(() => {
      // No pointerdown on container — fire move/up directly on document
      firePointerMove(docListeners, 170, 0);
      firePointerUp(docListeners, 170, 0);
    });

    // No transform should be applied since tracking was never set
    expect(swipeEl.el.style.transform).toBe("");
  });

  it("ignores non-touch pointer events", () => {
    const onSwipeComplete = vi.fn();
    renderSwipeHook({ onSwipeComplete });

    act(() => {
      firePointerDown(container.listeners, 200, 0, 1, "mouse");
      firePointerMove(docListeners, 120, 0, 1, "mouse");
      firePointerUp(docListeners, 120, 0, 1, "mouse");
    });

    expect(onSwipeComplete).not.toHaveBeenCalled();
    expect(swipeEl.el.style.transform).toBe("");
  });

  it("does not start swipe from interactive targets (pointer)", () => {
    const onSwipeComplete = vi.fn();
    renderSwipeHook({ onSwipeComplete });
    const button = createTarget("button");
    const input = createTarget("input");
    const select = createTarget("select");
    const textarea = createTarget("textarea");

    act(() => {
      firePointerDown(container.listeners, 200, 0, 1, "touch", button);
      firePointerMove(docListeners, 140, 0);
      firePointerUp(docListeners, 140, 0);

      firePointerDown(container.listeners, 200, 0, 1, "touch", input);
      firePointerMove(docListeners, 140, 0);
      firePointerUp(docListeners, 140, 0);

      firePointerDown(container.listeners, 200, 0, 1, "touch", select);
      firePointerMove(docListeners, 140, 0);
      firePointerUp(docListeners, 140, 0);

      firePointerDown(container.listeners, 200, 0, 1, "touch", textarea);
      firePointerMove(docListeners, 140, 0);
      firePointerUp(docListeners, 140, 0);
    });

    expect(onSwipeComplete).not.toHaveBeenCalled();
    expect(swipeEl.el.style.transform).toBe("");
  });

  it("does not start swipe from combobox/button role targets", () => {
    const onSwipeComplete = vi.fn();
    renderSwipeHook({ onSwipeComplete });
    const combobox = createTarget("div", { role: "combobox" });
    const roleButton = createTarget("div", { role: "button" });

    act(() => {
      firePointerDown(container.listeners, 200, 0, 1, "touch", combobox);
      firePointerMove(docListeners, 140, 0);
      firePointerUp(docListeners, 140, 0);

      firePointerDown(container.listeners, 200, 0, 1, "touch", roleButton);
      firePointerMove(docListeners, 140, 0);
      firePointerUp(docListeners, 140, 0);
    });

    expect(onSwipeComplete).not.toHaveBeenCalled();
    expect(swipeEl.el.style.transform).toBe("");
  });

  it("allows swipe from data-allow-swipe targets", () => {
    const onSwipeComplete = vi.fn();
    renderSwipeHook({ onSwipeComplete });
    const button = createTarget("button", { "data-allow-swipe": "true" });

    act(() => {
      firePointerDown(container.listeners, 200, 0, 1, "touch", button);
      firePointerMove(docListeners, 140, 0);
      firePointerUp(docListeners, 140, 0);
    });

    expect(swipeEl.el.style.transform).toBe("translateX(-375px)");
  });

  it("supports touch fallback swipe flow", () => {
    renderSwipeHook();

    act(() => {
      fireTouchStart(container.listeners, 200);
      fireTouchMove(docListeners, 150);
      fireTouchEnd(docListeners, 150);
    });

    expect(swipeEl.el.style.transform).toBe("translateX(-375px)");
  });

  it("does not start touch fallback swipe from interactive targets", () => {
    const onSwipeComplete = vi.fn();
    renderSwipeHook({ onSwipeComplete });
    const input = createTarget("input");

    act(() => {
      fireTouchStart(container.listeners, 200, 0, input);
      fireTouchMove(docListeners, 140, 0);
      fireTouchEnd(docListeners, 140, 0);
    });

    expect(onSwipeComplete).not.toHaveBeenCalled();
    expect(swipeEl.el.style.transform).toBe("");
  });

  it("resets swipe on touchcancel", () => {
    renderSwipeHook();

    act(() => {
      fireTouchStart(container.listeners, 200);
      fireTouchMove(docListeners, 170);
      fireTouchCancel(docListeners);
    });

    expect(swipeEl.el.style.transform).toBe("");
    expect(swipeEl.el.style.transition).toBe("");
  });

  it("resets swipe on pointercancel", () => {
    renderSwipeHook();

    act(() => {
      firePointerDown(container.listeners, 200);
      firePointerMove(docListeners, 170);
      firePointerCancel(docListeners, 170);
    });

    expect(swipeEl.el.style.transform).toBe("");
    expect(swipeEl.el.style.transition).toBe("");
  });

  it("cleans up document listeners on unmount", () => {
    const { unmount } = renderSwipeHook();

    unmount();

    const pointerMoveRemoved = removeSpy.mock.calls.find((c: unknown[]) => c[0] === "pointermove");
    const pointerUpRemoved = removeSpy.mock.calls.find((c: unknown[]) => c[0] === "pointerup");
    const pointerCancelRemoved = removeSpy.mock.calls.find(
      (c: unknown[]) => c[0] === "pointercancel",
    );
    const touchMoveRemoved = removeSpy.mock.calls.find((c: unknown[]) => c[0] === "touchmove");
    const touchEndRemoved = removeSpy.mock.calls.find((c: unknown[]) => c[0] === "touchend");
    const touchCancelRemoved = removeSpy.mock.calls.find((c: unknown[]) => c[0] === "touchcancel");
    expect(pointerMoveRemoved).toBeDefined();
    expect(pointerUpRemoved).toBeDefined();
    expect(pointerCancelRemoved).toBeDefined();
    expect(touchMoveRemoved).toBeDefined();
    expect(touchEndRemoved).toBeDefined();
    expect(touchCancelRemoved).toBeDefined();
  });
});
