import type { WeatherType } from "@sugara/shared";
import type { IconType } from "react-icons";
import {
  WiCloudy,
  WiDayCloudy,
  WiDayCloudyHigh,
  WiDaySunny,
  WiFog,
  WiRain,
  WiSleet,
  WiSnow,
  WiStormShowers,
  WiThunderstorm,
} from "react-icons/wi";

export const WEATHER_ICON_COLOR: Record<WeatherType, string> = {
  sunny: "text-amber-400",
  partly_cloudy: "text-amber-400",
  cloudy: "text-slate-400",
  mostly_cloudy: "text-slate-400",
  light_rain: "text-blue-400",
  rainy: "text-blue-400",
  heavy_rain: "text-blue-500",
  thunder: "text-yellow-400",
  snowy: "text-sky-300",
  sleet: "text-sky-400",
  foggy: "text-slate-400",
};

export const WEATHER_ICON: Record<WeatherType, IconType> = {
  sunny: WiDaySunny,
  partly_cloudy: WiDayCloudy,
  cloudy: WiCloudy,
  mostly_cloudy: WiDayCloudyHigh,
  light_rain: WiRain,
  rainy: WiRain,
  heavy_rain: WiStormShowers,
  thunder: WiThunderstorm,
  snowy: WiSnow,
  sleet: WiSleet,
  foggy: WiFog,
};
