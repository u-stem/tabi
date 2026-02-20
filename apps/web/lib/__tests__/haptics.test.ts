import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { haptics } from "../haptics";

describe("haptics", () => {
  let vibrateSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vibrateSpy = vi.fn(() => true);
    Object.defineProperty(navigator, "vibrate", {
      value: vibrateSpy,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("light calls vibrate with short duration", () => {
    haptics.light();
    expect(vibrateSpy).toHaveBeenCalledWith(10);
  });

  it("medium calls vibrate with medium duration", () => {
    haptics.medium();
    expect(vibrateSpy).toHaveBeenCalledWith(20);
  });

  it("heavy calls vibrate with pattern", () => {
    haptics.heavy();
    expect(vibrateSpy).toHaveBeenCalledWith([30, 10, 30]);
  });

  it("success calls vibrate with success pattern", () => {
    haptics.success();
    expect(vibrateSpy).toHaveBeenCalledWith([10, 50, 10]);
  });

  it("does not throw when vibrate is unavailable", () => {
    Object.defineProperty(navigator, "vibrate", {
      value: undefined,
      writable: true,
      configurable: true,
    });
    expect(() => haptics.light()).not.toThrow();
  });
});
