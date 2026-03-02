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
