import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useInstallBanner } from "../hooks/use-install-banner";

describe("useInstallBanner", () => {
  beforeEach(() => {
    localStorage.clear();
    // Default: Android Chrome, not standalone
    vi.stubGlobal("navigator", {
      userAgent:
        "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/91.0",
    });
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("showBanner=false when already standalone (installed)", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    const { result } = renderHook(() => useInstallBanner());
    expect(result.current.showBanner).toBe(false);
  });

  it("showBanner=false when dismissed", () => {
    localStorage.setItem("install-banner-dismissed", "1");
    const { result } = renderHook(() => useInstallBanner());
    expect(result.current.showBanner).toBe(false);
  });

  it("showBanner=false when no beforeinstallprompt and not iOS", () => {
    const { result } = renderHook(() => useInstallBanner());
    expect(result.current.showBanner).toBe(false);
  });

  it("showBanner=true when beforeinstallprompt fires (Android)", () => {
    const { result } = renderHook(() => useInstallBanner());

    const mockEvent = new Event("beforeinstallprompt");
    Object.assign(mockEvent, {
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: "dismissed" }),
    });

    act(() => {
      window.dispatchEvent(mockEvent);
    });

    expect(result.current.showBanner).toBe(true);
    expect(result.current.isIos).toBe(false);
  });

  it("showBanner=true and isIos=true on iOS Safari UA", () => {
    vi.stubGlobal("navigator", {
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    });
    const { result } = renderHook(() => useInstallBanner());
    expect(result.current.showBanner).toBe(true);
    expect(result.current.isIos).toBe(true);
  });

  it("dismiss() hides banner and saves to localStorage", () => {
    vi.stubGlobal("navigator", {
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    });
    const { result } = renderHook(() => useInstallBanner());

    expect(result.current.showBanner).toBe(true);

    act(() => {
      result.current.dismiss();
    });

    expect(result.current.showBanner).toBe(false);
    expect(localStorage.getItem("install-banner-dismissed")).toBe("1");
  });
});
