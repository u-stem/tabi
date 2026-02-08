import { describe, expect, it } from "vitest";
import { createTripSchema, tripStatusSchema } from "../schemas/trip";

describe("createTripSchema", () => {
  it("validates a valid trip", () => {
    const result = createTripSchema.safeParse({
      title: "Kyoto 3-day trip",
      destination: "Kyoto",
      startDate: "2025-03-15",
      endDate: "2025-03-17",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty title", () => {
    const result = createTripSchema.safeParse({
      title: "",
      destination: "Kyoto",
      startDate: "2025-03-15",
      endDate: "2025-03-17",
    });
    expect(result.success).toBe(false);
  });

  it("rejects end date before start date", () => {
    const result = createTripSchema.safeParse({
      title: "Trip",
      destination: "Kyoto",
      startDate: "2025-03-17",
      endDate: "2025-03-15",
    });
    expect(result.success).toBe(false);
  });
});

describe("tripStatusSchema", () => {
  it("accepts valid statuses", () => {
    for (const status of ["draft", "planned", "active", "completed"]) {
      expect(tripStatusSchema.safeParse(status).success).toBe(true);
    }
  });

  it("rejects invalid status", () => {
    expect(tripStatusSchema.safeParse("invalid").success).toBe(false);
  });
});
