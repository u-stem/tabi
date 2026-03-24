// Cuisine genre presets
export const CUISINE_KEYS = [
  "japanese",
  "chinese",
  "western",
  "italian",
  "french",
  "korean",
  "thai",
  "vietnamese",
  "indian",
  "mexican",
  "ramen",
  "sushi",
  "yakiniku",
  "curry",
  "udon",
  "soba",
  "pizza",
  "hamburger",
  "cafe",
  "izakaya",
] as const;

// Transportation presets
export const TRANSPORT_KEYS = [
  "walk",
  "bicycle",
  "car",
  "taxi",
  "bus",
  "train",
  "shinkansen",
  "airplane",
  "ferry",
  "rental_car",
  "motorcycle",
  "hitchhike",
] as const;

export type PresetCategory = "prefecture" | "cuisine" | "transport";

export const PRESET_CATEGORIES: PresetCategory[] = ["prefecture", "cuisine", "transport"];
