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

// Unified region group type shared by prefecture and country presets
export type RegionGroup = {
  nameKey: string;
  keys: string[];
};

const COUNTRY_REGIONS_CONST = [
  {
    nameKey: "regionEastAsia",
    keys: ["china", "south_korea", "taiwan", "hong_kong", "mongolia"],
  },
  {
    nameKey: "regionSoutheastAsia",
    keys: [
      "thailand",
      "vietnam",
      "singapore",
      "malaysia",
      "indonesia",
      "philippines",
      "cambodia",
      "myanmar",
      "laos",
    ],
  },
  {
    nameKey: "regionSouthAsia",
    keys: ["india", "sri_lanka", "nepal", "maldives"],
  },
  {
    nameKey: "regionMiddleEast",
    keys: ["turkey", "uae", "israel", "jordan", "oman", "qatar"],
  },
  {
    nameKey: "regionWesternEurope",
    keys: [
      "uk",
      "france",
      "germany",
      "italy",
      "spain",
      "portugal",
      "netherlands",
      "belgium",
      "switzerland",
      "austria",
      "ireland",
    ],
  },
  {
    nameKey: "regionNorthernEurope",
    keys: ["sweden", "norway", "finland", "denmark", "iceland"],
  },
  {
    nameKey: "regionEasternEurope",
    keys: ["poland", "czech", "hungary", "croatia", "greece", "romania", "bulgaria"],
  },
  {
    nameKey: "regionNorthAmerica",
    keys: ["usa", "canada", "mexico"],
  },
  {
    nameKey: "regionCentralSouthAmerica",
    keys: ["brazil", "argentina", "peru", "chile", "colombia", "cuba", "costa_rica"],
  },
  {
    nameKey: "regionAfrica",
    keys: ["egypt", "morocco", "south_africa", "kenya", "tanzania", "ethiopia"],
  },
  {
    nameKey: "regionOceania",
    keys: ["australia", "new_zealand", "fiji", "guam", "hawaii"],
  },
] as const satisfies readonly RegionGroup[];

// Re-export under a friendlier name. The const-assertion above already gives
// us a readonly tuple typed as RegionGroup, so no cast is needed here —
// previously we routed through `as unknown as RegionGroup[]` which silently
// discarded the satisfies check.
export const COUNTRY_REGIONS = COUNTRY_REGIONS_CONST;

export const ALL_COUNTRY_KEYS = COUNTRY_REGIONS_CONST.flatMap((r) => r.keys);

export type PresetCategory = "prefecture" | "country" | "cuisine" | "transport";

export const PRESET_CATEGORIES: PresetCategory[] = [
  "prefecture",
  "country",
  "cuisine",
  "transport",
];
