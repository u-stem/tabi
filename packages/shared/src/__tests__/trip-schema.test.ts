import { describe, expect, it } from "vitest";
import { createTripSchema, updateTripSchema, tripStatusSchema } from "../schemas/trip";

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

describe("updateTripSchema", () => {
  it("accepts partial update with title only", () => {
    const result = updateTripSchema.safeParse({ title: "New Title" });
    expect(result.success).toBe(true);
  });

  it("accepts partial update with status only", () => {
    const result = updateTripSchema.safeParse({ status: "active" });
    expect(result.success).toBe(true);
  });

  it("rejects end date before start date when both provided", () => {
    const result = updateTripSchema.safeParse({
      startDate: "2025-03-17",
      endDate: "2025-03-15",
    });
    expect(result.success).toBe(false);
  });

  it("accepts when only startDate is provided", () => {
    const result = updateTripSchema.safeParse({
      startDate: "2025-03-17",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty title", () => {
    const result = updateTripSchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
  });
});

describe("tripStatusSchema", () => {
  it.each(["draft", "planned", "active", "completed"])("accepts '%s'", (status) => {
    expect(tripStatusSchema.safeParse(status).success).toBe(true);
  });

  it("rejects invalid status", () => {
    expect(tripStatusSchema.safeParse("invalid").success).toBe(false);
  });
});
