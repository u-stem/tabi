import type { SpotColor } from "@tabi/shared";

export const SPOT_COLOR_CLASSES: Record<
  SpotColor,
  { bg: string; border: string; text: string; ring: string }
> = {
  blue: {
    bg: "bg-blue-500",
    border: "border-blue-400",
    text: "text-blue-400",
    ring: "ring-blue-500",
  },
  red: { bg: "bg-red-500", border: "border-red-400", text: "text-red-400", ring: "ring-red-500" },
  green: {
    bg: "bg-green-500",
    border: "border-green-400",
    text: "text-green-400",
    ring: "ring-green-500",
  },
  yellow: {
    bg: "bg-yellow-500",
    border: "border-yellow-400",
    text: "text-yellow-400",
    ring: "ring-yellow-500",
  },
  purple: {
    bg: "bg-purple-500",
    border: "border-purple-400",
    text: "text-purple-400",
    ring: "ring-purple-500",
  },
  pink: {
    bg: "bg-pink-500",
    border: "border-pink-400",
    text: "text-pink-400",
    ring: "ring-pink-500",
  },
  orange: {
    bg: "bg-orange-500",
    border: "border-orange-400",
    text: "text-orange-400",
    ring: "ring-orange-500",
  },
  gray: {
    bg: "bg-gray-500",
    border: "border-gray-400",
    text: "text-gray-400",
    ring: "ring-gray-500",
  },
};
