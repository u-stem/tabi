import { describe, expect, it } from "vitest";
import { getCrossDayLabel, getStartDayLabel } from "../cross-day-label";

describe("getStartDayLabel", () => {
  it("returns check-in for hotel", () => {
    expect(getStartDayLabel("hotel")).toBe("チェックイン");
  });

  it("returns null for transport", () => {
    expect(getStartDayLabel("transport")).toBeNull();
  });

  it("returns generic start for other categories", () => {
    expect(getStartDayLabel("sightseeing")).toBe("開始");
    expect(getStartDayLabel("restaurant")).toBe("開始");
    expect(getStartDayLabel("activity")).toBe("開始");
    expect(getStartDayLabel("other")).toBe("開始");
  });
});

describe("getCrossDayLabel", () => {
  it("returns check-out for hotel final day", () => {
    expect(getCrossDayLabel("hotel", "final")).toBe("チェックアウト");
  });

  it("returns staying for hotel intermediate day", () => {
    expect(getCrossDayLabel("hotel", "intermediate")).toBe("滞在中");
  });

  it("returns null for transport", () => {
    expect(getCrossDayLabel("transport", "final")).toBeNull();
    expect(getCrossDayLabel("transport", "intermediate")).toBeNull();
  });

  it("returns generic labels for other categories", () => {
    expect(getCrossDayLabel("sightseeing", "final")).toBe("終了");
    expect(getCrossDayLabel("sightseeing", "intermediate")).toBe("継続中");
  });
});
