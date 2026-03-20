import type { ScheduleCategory } from "@sugara/shared";

type CrossDayPosition = "intermediate" | "final";

type CrossDayTranslations = {
  hotelCheckin: string;
  hotelStaying: string;
  hotelCheckout: string;
  genericStart: string;
  genericContinuing: string;
  genericEnd: string;
};

/** Label for the start day of a multi-day schedule (e.g. "Check-in"). Null for transport. */
export function getStartDayLabel(
  category: ScheduleCategory,
  t: CrossDayTranslations,
): string | null {
  if (category === "transport") return null;
  if (category === "hotel") return t.hotelCheckin;
  return t.genericStart;
}

/** Label for a cross-day entry (e.g. "Checkout", "Staying"). Null for transport. */
export function getCrossDayLabel(
  category: ScheduleCategory,
  position: CrossDayPosition,
  t: CrossDayTranslations,
): string | null {
  if (category === "transport") return null;
  if (category === "hotel") {
    return position === "intermediate" ? t.hotelStaying : t.hotelCheckout;
  }
  return position === "intermediate" ? t.genericContinuing : t.genericEnd;
}
