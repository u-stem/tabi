import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDesktopDownload } from "../hooks/use-desktop-download";

describe("useDesktopDownload", () => {
  beforeEach(() => {
    // Default: desktop Chrome, not Tauri, not standalone, not mobile
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0",
    });
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((_query: string) => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("showLink=true on desktop Chrome (not Tauri, not standalone, not mobile)", () => {
    const { result } = renderHook(() => useDesktopDownload());
    expect(result.current.showLink).toBe(true);
  });

  it("showLink=false when running as Tauri app", () => {
    vi.stubGlobal("navigator", {
      userAgent: "sugara-desktop/0.1.0",
    });
    const { result } = renderHook(() => useDesktopDownload());
    expect(result.current.showLink).toBe(false);
  });

  it("showLink=false when running as PWA standalone", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: query === "(display-mode: standalone)",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    const { result } = renderHook(() => useDesktopDownload());
    expect(result.current.showLink).toBe(false);
  });

  it("showLink=false on mobile UA (Android)", () => {
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/91.0",
    });
    const { result } = renderHook(() => useDesktopDownload());
    expect(result.current.showLink).toBe(false);
  });

  it("showLink=false on mobile UA (iPhone)", () => {
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    });
    const { result } = renderHook(() => useDesktopDownload());
    expect(result.current.showLink).toBe(false);
  });
});
