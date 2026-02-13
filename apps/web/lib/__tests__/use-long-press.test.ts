import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLongPress } from "../hooks/use-long-press";

function touch(x: number, y: number) {
  return { touches: [{ clientX: x, clientY: y }] } as unknown as React.TouchEvent;
}

describe("useLongPress", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls onLongPress after 500ms", () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress }));

    act(() => {
      result.current.onTouchStart(touch(100, 200));
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onLongPress).toHaveBeenCalledWith({ x: 100, y: 200 });
  });

  it("does not call onLongPress if touchend before 500ms", () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress }));

    act(() => {
      result.current.onTouchStart(touch(100, 200));
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    act(() => {
      result.current.onTouchEnd();
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("cancels if finger moves more than 10px", () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress }));

    act(() => {
      result.current.onTouchStart(touch(100, 200));
    });
    act(() => {
      result.current.onTouchMove(touch(100, 211));
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("does not cancel at exactly 10px movement", () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress }));

    act(() => {
      result.current.onTouchStart(touch(100, 200));
    });
    act(() => {
      result.current.onTouchMove(touch(100, 210));
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onLongPress).toHaveBeenCalledOnce();
  });

  it("still fires if finger moves less than 10px", () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress }));

    act(() => {
      result.current.onTouchStart(touch(100, 200));
    });
    act(() => {
      result.current.onTouchMove(touch(105, 208));
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onLongPress).toHaveBeenCalledOnce();
  });

  it("clears timer on unmount", () => {
    const clearSpy = vi.spyOn(globalThis, "clearTimeout");
    const onLongPress = vi.fn();
    const { result, unmount } = renderHook(() => useLongPress({ onLongPress }));

    act(() => {
      result.current.onTouchStart(touch(100, 200));
    });
    unmount();

    expect(clearSpy).toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onLongPress).not.toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});
