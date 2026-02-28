import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSeason } from "../season";

describe("getSeason", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns spring for March", () => {
    vi.setSystemTime(new Date(2026, 2, 1)); // March
    expect(getSeason()).toBe("spring");
  });

  it("returns spring for May", () => {
    vi.setSystemTime(new Date(2026, 4, 31)); // May
    expect(getSeason()).toBe("spring");
  });

  it("returns summer for June", () => {
    vi.setSystemTime(new Date(2026, 5, 1)); // June
    expect(getSeason()).toBe("summer");
  });

  it("returns summer for August", () => {
    vi.setSystemTime(new Date(2026, 7, 31)); // August
    expect(getSeason()).toBe("summer");
  });

  it("returns autumn for September", () => {
    vi.setSystemTime(new Date(2026, 8, 1)); // September
    expect(getSeason()).toBe("autumn");
  });

  it("returns autumn for November", () => {
    vi.setSystemTime(new Date(2026, 10, 30)); // November
    expect(getSeason()).toBe("autumn");
  });

  it("returns winter for December", () => {
    vi.setSystemTime(new Date(2026, 11, 1)); // December
    expect(getSeason()).toBe("winter");
  });

  it("returns winter for January", () => {
    vi.setSystemTime(new Date(2026, 0, 15)); // January
    expect(getSeason()).toBe("winter");
  });

  it("returns winter for February", () => {
    vi.setSystemTime(new Date(2026, 1, 28)); // February
    expect(getSeason()).toBe("winter");
  });
});
