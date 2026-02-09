import { describe, expect, it } from "vitest";
import {
  createSpotSchema,
  reorderSpotsSchema,
  spotCategorySchema,
  transportMethodSchema,
  updateSpotSchema,
} from "../schemas/spot";

describe("spotCategorySchema", () => {
  it.each([
    "sightseeing",
    "restaurant",
    "hotel",
    "transport",
    "activity",
    "other",
  ])("accepts '%s'", (cat) => {
    expect(spotCategorySchema.safeParse(cat).success).toBe(true);
  });

  it("rejects invalid category", () => {
    expect(spotCategorySchema.safeParse("invalid").success).toBe(false);
  });
});

describe("createSpotSchema", () => {
  it("validates a valid spot", () => {
    const result = createSpotSchema.safeParse({
      name: "Kinkaku-ji",
      category: "sightseeing",
    });
    expect(result.success).toBe(true);
  });

  it("validates spot with all optional fields", () => {
    const result = createSpotSchema.safeParse({
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
    const result = createSpotSchema.safeParse({
      name: "",
      category: "sightseeing",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid time format", () => {
    const result = createSpotSchema.safeParse({
      name: "Spot",
      category: "sightseeing",
      startTime: "9:00",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateSpotSchema", () => {
  it("accepts partial update with name only", () => {
    const result = updateSpotSchema.safeParse({ name: "New Name" });
    expect(result.success).toBe(true);
  });

  it("accepts empty object", () => {
    const result = updateSpotSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("rejects invalid category", () => {
    const result = updateSpotSchema.safeParse({ category: "invalid" });
    expect(result.success).toBe(false);
  });
});

describe("transportMethodSchema", () => {
  it.each(["train", "bus", "taxi", "walk", "car", "airplane"])("accepts '%s'", (method) => {
    expect(transportMethodSchema.safeParse(method).success).toBe(true);
  });

  it("rejects invalid method", () => {
    expect(transportMethodSchema.safeParse("helicopter").success).toBe(false);
  });
});

describe("createSpotSchema transport fields", () => {
  it("accepts transport-specific fields", () => {
    const result = createSpotSchema.safeParse({
      name: "Tokyo to Osaka",
      category: "transport",
      departurePlace: "Tokyo Station",
      arrivalPlace: "Shin-Osaka Station",
      transportMethod: "train",
    });
    expect(result.success).toBe(true);
  });

  it("accepts without transport-specific fields", () => {
    const result = createSpotSchema.safeParse({
      name: "Tokyo to Osaka",
      category: "transport",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid transportMethod", () => {
    const result = createSpotSchema.safeParse({
      name: "Tokyo to Osaka",
      category: "transport",
      transportMethod: "helicopter",
    });
    expect(result.success).toBe(false);
  });
});

describe("reorderSpotsSchema", () => {
  it("accepts valid UUIDs", () => {
    const result = reorderSpotsSchema.safeParse({
      spotIds: ["550e8400-e29b-41d4-a716-446655440000"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-UUID strings", () => {
    const result = reorderSpotsSchema.safeParse({
      spotIds: ["not-a-uuid"],
    });
    expect(result.success).toBe(false);
  });

  it("accepts empty array", () => {
    const result = reorderSpotsSchema.safeParse({ spotIds: [] });
    expect(result.success).toBe(true);
  });
});
