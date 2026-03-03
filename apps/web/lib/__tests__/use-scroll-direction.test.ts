import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useScrollDirection } from "../hooks/use-scroll-direction";

describe("useScrollDirection", () => {
  beforeEach(() => {
    Object.defineProperty(window, "scrollY", { writable: true, value: 0 });
  });

  afterEach(() => {
    Object.defineProperty(window, "scrollY", { writable: true, value: 0 });
  });

  it("初期状態では false を返す", () => {
    const { result } = renderHook(() => useScrollDirection());
    expect(result.current).toBe(false);
  });

  it("下方向にスクロールしたとき true を返す", () => {
    const { result } = renderHook(() => useScrollDirection(8));
    act(() => {
      Object.defineProperty(window, "scrollY", { writable: true, value: 100 });
      window.dispatchEvent(new Event("scroll"));
    });
    expect(result.current).toBe(true);
  });

  it("上方向にスクロールしたとき false を返す", () => {
    const { result } = renderHook(() => useScrollDirection(8));
    act(() => {
      Object.defineProperty(window, "scrollY", { writable: true, value: 100 });
      window.dispatchEvent(new Event("scroll"));
    });
    act(() => {
      Object.defineProperty(window, "scrollY", { writable: true, value: 80 });
      window.dispatchEvent(new Event("scroll"));
    });
    expect(result.current).toBe(false);
  });

  it("ページ上部付近（scrollY < 50）では常に false を返す", () => {
    const { result } = renderHook(() => useScrollDirection(8));
    act(() => {
      Object.defineProperty(window, "scrollY", { writable: true, value: 100 });
      window.dispatchEvent(new Event("scroll"));
    });
    expect(result.current).toBe(true);
    act(() => {
      Object.defineProperty(window, "scrollY", { writable: true, value: 30 });
      window.dispatchEvent(new Event("scroll"));
    });
    expect(result.current).toBe(false);
  });

  it("閾値未満の動きでは状態が変わらない", () => {
    const { result } = renderHook(() => useScrollDirection(8));
    act(() => {
      Object.defineProperty(window, "scrollY", { writable: true, value: 100 });
      window.dispatchEvent(new Event("scroll"));
    });
    act(() => {
      Object.defineProperty(window, "scrollY", { writable: true, value: 104 });
      window.dispatchEvent(new Event("scroll"));
    });
    // diff=4 < threshold=8 なので true のまま変わらない
    expect(result.current).toBe(true);
  });
});
