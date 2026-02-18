import type { MemberRole, ScheduleColor, TripStatus } from "@sugara/shared";

export const SELECTED_RING = "border-ring ring-2 ring-ring";
export const DROP_ZONE_ACTIVE = "border-blue-400 bg-blue-50 dark:bg-blue-950/30";

export const STATUS_COLORS: Record<TripStatus, string> = {
  draft:
    "bg-gray-200 text-gray-800 border-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600",
  planned:
    "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-700",
  active:
    "bg-green-100 text-green-800 border-green-300 dark:bg-green-900 dark:text-green-200 dark:border-green-700",
  completed:
    "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900 dark:text-purple-200 dark:border-purple-700",
};

export const ROLE_COLORS: Record<MemberRole, string> = {
  owner:
    "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900 dark:text-amber-200 dark:border-amber-700",
  editor:
    "bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-900 dark:text-sky-200 dark:border-sky-700",
  viewer:
    "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600",
};

export const SCHEDULE_COLOR_CLASSES: Record<
  ScheduleColor,
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
