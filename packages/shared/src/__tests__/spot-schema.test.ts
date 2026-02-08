import { describe, expect, it } from "vitest";
import { createSpotSchema, updateSpotSchema, reorderSpotsSchema, spotCategorySchema } from "../schemas/spot";

describe("spotCategorySchema", () => {
  it.each(["sightseeing", "restaurant", "hotel", "transport", "activity", "other"])(
    "accepts '%s'",
    (cat) => {
      expect(spotCategorySchema.safeParse(cat).success).toBe(true);
    },
  );

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
      latitude: 35.0394,
      longitude: 135.7292,
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

  it("rejects latitude out of range", () => {
    const result = createSpotSchema.safeParse({
      name: "Spot",
      category: "sightseeing",
      latitude: 91,
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
