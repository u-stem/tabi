import type { ScheduleCategory } from "@sugara/shared";
import { MSG } from "@/lib/messages";

export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Parse YYYY-MM-DD directly to avoid timezone issues with Date constructor
export function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) return dateStr;
  return `${year}年${month}月${day}日`;
}

export function formatTime(time: string): string {
  return time.slice(0, 5);
}

export function formatDateShort(dateStr: string): string {
  const [, month, day] = dateStr.split("-").map(Number);
  return `${month}/${day}`;
}

export function formatDateRange(startDate: string, endDate: string): string {
  return `${formatDate(startDate)} - ${formatDate(endDate)}`;
}

export function getDayCount(startDate: string, endDate: string): number {
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  const start = Date.UTC(sy, sm - 1, sd);
  const end = Date.UTC(ey, em - 1, ed);
  return Math.round((end - start) / 86400000) + 1;
}

export function formatTimeRange(startTime?: string | null, endTime?: string | null): string {
  if (startTime && endTime) return `${formatTime(startTime)} - ${formatTime(endTime)}`;
  if (startTime) return formatTime(startTime);
  if (endTime) return `- ${formatTime(endTime)}`;
  return "";
}

export type TimeStatus = "past" | "current" | "future";

export function getTimeStatus(
  now: string,
  startTime?: string | null,
  endTime?: string | null,
): TimeStatus {
  const nowHm = now.slice(0, 5);

  if (!startTime) return "future";

  const startHm = startTime.slice(0, 5);

  if (endTime) {
    const endHm = endTime.slice(0, 5);
    if (endHm <= nowHm) return "past";
    if (startHm <= nowHm) return "current";
    return "future";
  }

  // startTime only: treat as past once the time has passed
  return startHm <= nowHm ? "past" : "future";
}

/**
 * TimeStatus for cross-day entries displayed on the target day.
 * Only endTime is relevant (the checkout / arrival time on this day).
 */
export function getCrossDayTimeStatus(now: string, endTime?: string | null): TimeStatus | null {
  if (!endTime) return null;
  const nowHm = now.slice(0, 5);
  const endHm = endTime.slice(0, 5);
  return endHm <= nowHm ? "past" : "current";
}

export function compareByStartTime(
  a: { startTime?: string | null },
  b: { startTime?: string | null },
): number {
  const aTime = a.startTime?.slice(0, 5) ?? null;
  const bTime = b.startTime?.slice(0, 5) ?? null;
  if (aTime === null && bTime === null) return 0;
  if (aTime === null) return 1;
  if (bTime === null) return -1;
  if (aTime < bTime) return -1;
  if (aTime > bTime) return 1;
  return 0;
}

export function validateTimeRange(
  startTime?: string,
  endTime?: string,
  options?: { allowOvernight?: boolean; category?: ScheduleCategory },
): string | null {
  if (!startTime && endTime) {
    if (options?.category === "hotel") return MSG.TIME_HOTEL_CHECKIN_REQUIRED;
    if (options?.category === "transport") return MSG.TIME_TRANSPORT_DEPARTURE_REQUIRED;
    return MSG.TIME_START_REQUIRED;
  }
  if (startTime && endTime && !options?.allowOvernight && startTime >= endTime) {
    if (options?.category === "hotel") return MSG.TIME_HOTEL_CHECKOUT_AFTER;
    if (options?.category === "transport") return MSG.TIME_TRANSPORT_ARRIVAL_AFTER;
    return MSG.TIME_END_BEFORE_START;
  }
  return null;
}
