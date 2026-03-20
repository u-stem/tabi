// Prefecture keys mapped to message keys in the "prefectures" namespace
export type PrefectureKey = (typeof ALL_PREFECTURE_KEYS)[number];

export type Region = {
  nameKey: string;
  prefectureKeys: string[];
};

export const REGIONS: Region[] = [
  {
    nameKey: "regionHokkaido",
    prefectureKeys: ["hokkaido", "aomori", "iwate", "miyagi", "akita", "yamagata", "fukushima"],
  },
  {
    nameKey: "regionKanto",
    prefectureKeys: ["ibaraki", "tochigi", "gunma", "saitama", "chiba", "tokyo", "kanagawa"],
  },
  {
    nameKey: "regionChubu",
    prefectureKeys: [
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
    prefectureKeys: ["mie", "shiga", "kyoto", "osaka", "hyogo", "nara", "wakayama"],
  },
  {
    nameKey: "regionChugokuShikoku",
    prefectureKeys: [
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
    prefectureKeys: [
      "fukuoka",
      "saga",
      "nagasaki",
      "kumamoto",
      "oita",
      "miyazaki",
      "kagoshima",
      "okinawa",
    ],
  },
];

export const ALL_PREFECTURE_KEYS = REGIONS.flatMap((r) => r.prefectureKeys);
