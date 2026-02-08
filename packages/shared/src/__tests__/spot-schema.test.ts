import { describe, expect, it } from "vitest";
import { createSpotSchema, spotCategorySchema } from "../schemas/spot";

describe("spotCategorySchema", () => {
  it("accepts valid categories", () => {
    const categories = ["sightseeing", "restaurant", "hotel", "transport", "activity", "other"];
    for (const cat of categories) {
      expect(spotCategorySchema.safeParse(cat).success).toBe(true);
    }
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
});
