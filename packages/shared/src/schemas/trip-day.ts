import { z } from "zod";

export const DAY_MEMO_MAX_LENGTH = 500;

export const WEATHER_TYPES = [
  "sunny",
  "partly_cloudy",
  "cloudy",
  "mostly_cloudy",
  "light_rain",
  "rainy",
  "heavy_rain",
  "thunder",
  "snowy",
  "sleet",
  "foggy",
] as const;

export type WeatherType = (typeof WEATHER_TYPES)[number];

export const WEATHER_LABELS: Record<WeatherType, string> = {
  sunny: "晴れ",
  partly_cloudy: "晴れ時々曇り",
  cloudy: "曇り",
  mostly_cloudy: "曇り時々晴れ",
  light_rain: "小雨",
  rainy: "雨",
  heavy_rain: "大雨",
  thunder: "雷雨",
  snowy: "雪",
  sleet: "みぞれ",
  foggy: "霧",
};

export const updateTripDaySchema = z.object({
  memo: z.string().max(DAY_MEMO_MAX_LENGTH).nullable(),
  weatherType: z.enum(WEATHER_TYPES).nullable().optional(),
  weatherTypeSecondary: z.enum(WEATHER_TYPES).nullable().optional(),
  tempHigh: z.number().int().min(-50).max(60).nullable().optional(),
  tempLow: z.number().int().min(-50).max(60).nullable().optional(),
});
