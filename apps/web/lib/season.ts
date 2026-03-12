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

// Raw color values for inline style usage (e.g. Logo ripple effect)
const seasonalColors: Record<Season, [string, string]> = {
  spring: ["#f472b6", "#c084fc"],
  summer: ["#22c55e", "#2dd4bf"],
  autumn: ["#f59e0b", "#ef4444"],
  winter: ["#60a5fa", "#818cf8"],
};

export function getSeasonalColors(): [string, string] {
  return seasonalColors[getSeason()];
}

export function getSeasonalGradient(): string {
  return seasonalGradients[getSeason()];
}

export function getSeasonalBg(): string {
  return `bg-gradient-to-br ${getSeasonalGradient()}`;
}
