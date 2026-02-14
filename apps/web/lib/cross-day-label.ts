import type { ScheduleCategory } from "@sugara/shared";

type CrossDayPosition = "intermediate" | "final";

const START_LABELS: Partial<Record<ScheduleCategory, string>> = {
  hotel: "チェックイン",
};

const CROSS_DAY_LABELS: Partial<Record<ScheduleCategory, Record<CrossDayPosition, string>>> = {
  hotel: { intermediate: "滞在中", final: "チェックアウト" },
};

const GENERIC_START = "開始";
const GENERIC_LABELS: Record<CrossDayPosition, string> = {
  intermediate: "継続中",
  final: "終了",
};

/** Label for the start day of a multi-day schedule (e.g. "チェックイン"). Null for transport. */
export function getStartDayLabel(category: ScheduleCategory): string | null {
  if (category === "transport") return null;
  return START_LABELS[category] ?? GENERIC_START;
}

/** Label for a cross-day entry (e.g. "チェックアウト", "滞在中"). Null for transport. */
export function getCrossDayLabel(
  category: ScheduleCategory,
  position: CrossDayPosition,
): string | null {
  if (category === "transport") return null;
  return CROSS_DAY_LABELS[category]?.[position] ?? GENERIC_LABELS[position];
}
