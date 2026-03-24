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

export type CountryRegion = {
  nameKey: string;
  countryKeys: string[];
};

export const COUNTRY_REGIONS: CountryRegion[] = [
  {
    nameKey: "regionEastAsia",
    countryKeys: ["china", "south_korea", "taiwan", "hong_kong", "mongolia"],
  },
  {
    nameKey: "regionSoutheastAsia",
    countryKeys: [
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
    countryKeys: ["india", "sri_lanka", "nepal", "maldives"],
  },
  {
    nameKey: "regionMiddleEast",
    countryKeys: ["turkey", "uae", "israel", "jordan", "oman", "qatar"],
  },
  {
    nameKey: "regionWesternEurope",
    countryKeys: [
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
    countryKeys: ["sweden", "norway", "finland", "denmark", "iceland"],
  },
  {
    nameKey: "regionEasternEurope",
    countryKeys: ["poland", "czech", "hungary", "croatia", "greece", "romania", "bulgaria"],
  },
  {
    nameKey: "regionNorthAmerica",
    countryKeys: ["usa", "canada", "mexico"],
  },
  {
    nameKey: "regionCentralSouthAmerica",
    countryKeys: ["brazil", "argentina", "peru", "chile", "colombia", "cuba", "costa_rica"],
  },
  {
    nameKey: "regionAfrica",
    countryKeys: ["egypt", "morocco", "south_africa", "kenya", "tanzania", "ethiopia"],
  },
  {
    nameKey: "regionOceania",
    countryKeys: ["australia", "new_zealand", "fiji", "guam", "hawaii"],
  },
];

export const ALL_COUNTRY_KEYS = COUNTRY_REGIONS.flatMap((r) => r.countryKeys);

export type PresetCategory = "prefecture" | "country" | "cuisine" | "transport";

export const PRESET_CATEGORIES: PresetCategory[] = [
  "prefecture",
  "country",
  "cuisine",
  "transport",
];
