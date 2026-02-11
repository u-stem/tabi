import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useInstallPrompt } from "../hooks/use-install-prompt";

describe("useInstallPrompt", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns canInstall=false initially", () => {
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.canInstall).toBe(false);
  });

  it("captures beforeinstallprompt event and sets canInstall=true", () => {
    const { result } = renderHook(() => useInstallPrompt());

    const mockEvent = new Event("beforeinstallprompt");
    Object.assign(mockEvent, {
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: "dismissed" }),
    });

    act(() => {
      window.dispatchEvent(mockEvent);
    });

    expect(result.current.canInstall).toBe(true);
  });

  it("calls prompt and resets on acceptance", async () => {
    const { result } = renderHook(() => useInstallPrompt());

    const mockPrompt = vi.fn().mockResolvedValue(undefined);
    const mockEvent = new Event("beforeinstallprompt");
    Object.assign(mockEvent, {
      prompt: mockPrompt,
      userChoice: Promise.resolve({ outcome: "accepted" }),
    });

    act(() => {
      window.dispatchEvent(mockEvent);
    });

    expect(result.current.canInstall).toBe(true);

    await act(async () => {
      await result.current.promptInstall();
    });

    expect(mockPrompt).toHaveBeenCalledOnce();
    expect(result.current.canInstall).toBe(false);
  });
});
