import type { RegionGroup } from "@/lib/roulette-presets";

// Prefecture keys mapped to message keys in the "prefectures" namespace
export type PrefectureKey = (typeof ALL_PREFECTURE_KEYS)[number];

export const REGIONS: RegionGroup[] = [
  {
    nameKey: "regionHokkaido",
    keys: ["hokkaido", "aomori", "iwate", "miyagi", "akita", "yamagata", "fukushima"],
  },
  {
    nameKey: "regionKanto",
    keys: ["ibaraki", "tochigi", "gunma", "saitama", "chiba", "tokyo", "kanagawa"],
  },
  {
    nameKey: "regionChubu",
    keys: [
      "niigata",
      "toyama",
      "ishikawa",
      "fukui",
      "yamanashi",
      "nagano",
      "gifu",
      "shizuoka",
      "aichi",
    ],
  },
  {
    nameKey: "regionKinki",
    keys: ["mie", "shiga", "kyoto", "osaka", "hyogo", "nara", "wakayama"],
  },
  {
    nameKey: "regionChugokuShikoku",
    keys: [
      "tottori",
      "shimane",
      "okayama",
      "hiroshima",
      "yamaguchi",
      "tokushima",
      "kagawa",
      "ehime",
      "kochi",
    ],
  },
  {
    nameKey: "regionKyushu",
    keys: ["fukuoka", "saga", "nagasaki", "kumamoto", "oita", "miyazaki", "kagoshima", "okinawa"],
  },
];

export const ALL_PREFECTURE_KEYS = REGIONS.flatMap((r) => r.keys);
