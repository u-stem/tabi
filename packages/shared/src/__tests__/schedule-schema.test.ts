import { describe, expect, it } from "vitest";
import {
  createScheduleSchema,
  reorderSchedulesSchema,
  scheduleCategorySchema,
  transportMethodSchema,
  updateScheduleSchema,
} from "../schemas/schedule";

describe("scheduleCategorySchema", () => {
  it.each([
    "sightseeing",
    "restaurant",
    "hotel",
    "transport",
    "activity",
    "other",
  ])("accepts '%s'", (cat) => {
    expect(scheduleCategorySchema.safeParse(cat).success).toBe(true);
  });

  it("rejects invalid category", () => {
    expect(scheduleCategorySchema.safeParse("invalid").success).toBe(false);
  });
});

describe("createScheduleSchema", () => {
  it("validates a valid schedule", () => {
    const result = createScheduleSchema.safeParse({
      name: "Kinkaku-ji",
      category: "sightseeing",
    });
    expect(result.success).toBe(true);
  });

  it("validates schedule with all optional fields", () => {
    const result = createScheduleSchema.safeParse({
      name: "Kinkaku-ji",
      category: "sightseeing",
      address: "1 Kinkakujicho, Kita Ward, Kyoto",
      startTime: "09:00",
      endTime: "10:30",
      memo: "Golden Pavilion",
      url: "https://example.com",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = createScheduleSchema.safeParse({
      name: "",
      category: "sightseeing",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid time format", () => {
    const result = createScheduleSchema.safeParse({
      name: "Schedule",
      category: "sightseeing",
      startTime: "9:00",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateScheduleSchema", () => {
  it("accepts partial update with name only", () => {
    const result = updateScheduleSchema.safeParse({ name: "New Name" });
    expect(result.success).toBe(true);
  });

  it("accepts empty object", () => {
    const result = updateScheduleSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("rejects invalid category", () => {
    const result = updateScheduleSchema.safeParse({ category: "invalid" });
    expect(result.success).toBe(false);
  });
});

describe("transportMethodSchema", () => {
  it.each([
    "train",
    "shinkansen",
    "bus",
    "taxi",
    "walk",
    "car",
    "airplane",
  ])("accepts '%s'", (method) => {
    expect(transportMethodSchema.safeParse(method).success).toBe(true);
  });

  it("rejects invalid method", () => {
    expect(transportMethodSchema.safeParse("helicopter").success).toBe(false);
  });
});

describe("createScheduleSchema transport fields", () => {
  it("accepts transport-specific fields", () => {
    const result = createScheduleSchema.safeParse({
      name: "Tokyo to Osaka",
      category: "transport",
      departurePlace: "Tokyo Station",
      arrivalPlace: "Shin-Osaka Station",
      transportMethod: "train",
    });
    expect(result.success).toBe(true);
  });

  it("accepts without transport-specific fields", () => {
    const result = createScheduleSchema.safeParse({
      name: "Tokyo to Osaka",
      category: "transport",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid transportMethod", () => {
    const result = createScheduleSchema.safeParse({
      name: "Tokyo to Osaka",
      category: "transport",
      transportMethod: "helicopter",
    });
    expect(result.success).toBe(false);
  });
});

describe("reorderSchedulesSchema", () => {
  it("accepts valid UUIDs", () => {
    const result = reorderSchedulesSchema.safeParse({
      scheduleIds: ["550e8400-e29b-41d4-a716-446655440000"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-UUID strings", () => {
    const result = reorderSchedulesSchema.safeParse({
      scheduleIds: ["not-a-uuid"],
    });
    expect(result.success).toBe(false);
  });

  it("accepts empty array", () => {
    const result = reorderSchedulesSchema.safeParse({ scheduleIds: [] });
    expect(result.success).toBe(true);
  });
});
