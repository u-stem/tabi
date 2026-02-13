export type Season = "spring" | "summer" | "autumn" | "winter";

export function getSeason(): Season {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

const seasonalGradients: Record<Season, string> = {
  spring: "from-pink-400 to-purple-400",
  summer: "from-green-500 to-teal-400",
  autumn: "from-amber-500 to-red-500",
  winter: "from-blue-400 to-indigo-400",
};

export function getSeasonalGradient(): string {
  return seasonalGradients[getSeason()];
}

export function getSeasonalBg(): string {
  return `bg-gradient-to-br ${getSeasonalGradient()}`;
}
