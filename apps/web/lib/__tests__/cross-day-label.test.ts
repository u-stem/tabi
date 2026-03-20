import { describe, expect, it } from "vitest";
import { getCrossDayLabel, getStartDayLabel } from "../cross-day-label";

const t = {
  hotelCheckin: "Check-in",
  hotelStaying: "Staying",
  hotelCheckout: "Checkout",
  genericStart: "Start",
  genericContinuing: "Continuing",
  genericEnd: "End",
};

describe("getStartDayLabel", () => {
  it("returns check-in for hotel", () => {
    expect(getStartDayLabel("hotel", t)).toBe("Check-in");
  });

  it("returns null for transport", () => {
    expect(getStartDayLabel("transport", t)).toBeNull();
  });

  it("returns generic start for other categories", () => {
    expect(getStartDayLabel("sightseeing", t)).toBe("Start");
    expect(getStartDayLabel("restaurant", t)).toBe("Start");
    expect(getStartDayLabel("activity", t)).toBe("Start");
    expect(getStartDayLabel("other", t)).toBe("Start");
  });
});

describe("getCrossDayLabel", () => {
  it("returns check-out for hotel final day", () => {
    expect(getCrossDayLabel("hotel", "final", t)).toBe("Checkout");
  });

  it("returns staying for hotel intermediate day", () => {
    expect(getCrossDayLabel("hotel", "intermediate", t)).toBe("Staying");
  });

  it("returns null for transport", () => {
    expect(getCrossDayLabel("transport", "final", t)).toBeNull();
    expect(getCrossDayLabel("transport", "intermediate", t)).toBeNull();
  });

  it("returns generic labels for other categories", () => {
    expect(getCrossDayLabel("sightseeing", "final", t)).toBe("End");
    expect(getCrossDayLabel("sightseeing", "intermediate", t)).toBe("Continuing");
  });
});
