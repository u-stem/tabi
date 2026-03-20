import type { ScheduleCategory } from "@sugara/shared";
import { format, isValid, parse } from "date-fns";
import { enUS, ja } from "date-fns/locale";

const DATE_FNS_LOCALES = { ja, en: enUS } as const;

function getDateFnsLocale(locale: string) {
  return DATE_FNS_LOCALES[locale as keyof typeof DATE_FNS_LOCALES] ?? ja;
}

export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Parse YYYY-MM-DD directly to avoid timezone issues with Date constructor
export function formatDate(dateStr: string, pattern?: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) return dateStr;
  if (pattern) {
    const d = new Date(year, month - 1, day);
    return format(d, pattern);
  }
  // Default fallback (used by export and non-i18n contexts)
  return `${year}年${month}月${day}日`;
}

// Format ISO datetime string (e.g. "2026-02-18T00:00:00Z") using local timezone
export function formatDateFromISO(isoStr: string, pattern?: string): string {
  const d = new Date(isoStr);
  if (pattern) return format(d, pattern);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
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

/** Returns a message key (e.g. "timeStartRequired") or null. Callers translate via tm(key). */
export function validateTimeRange(
  startTime?: string,
  endTime?: string,
  options?: { allowOvernight?: boolean; category?: ScheduleCategory },
): string | null {
  if (!startTime && endTime) {
    if (options?.category === "hotel") return "timeHotelCheckinRequired";
    if (options?.category === "transport") return "timeTransportDepartureRequired";
    return "timeStartRequired";
  }
  if (startTime && endTime && !options?.allowOvernight && startTime >= endTime) {
    if (options?.category === "hotel") return "timeHotelCheckoutAfter";
    if (options?.category === "transport") return "timeTransportArrivalAfter";
    return "timeEndBeforeStart";
  }
  return null;
}

export function stripProtocol(url: string): string {
  return url.replace(/^https?:\/\//, "");
}

/** Format "yyyy-MM-dd" using a date-fns pattern with locale support */
export function formatDateWithDay(dateStr: string, pattern?: string, locale?: string): string {
  const d = parse(dateStr, "yyyy-MM-dd", new Date());
  if (!isValid(d)) return dateStr;
  const fmt = pattern ?? "M月d日 (E)";
  return format(d, fmt, { locale: getDateFnsLocale(locale ?? "ja") });
}

/** Format a date range like "2/7 (Sat) - 2/8 (Sun)" or single date "2/7 (Sat)" */
export function formatDateRangeShort(
  startDate: string,
  endDate: string,
  pattern?: string,
  locale?: string,
): string {
  if (startDate === endDate) return formatDateWithDay(startDate, pattern, locale);
  return `${formatDateWithDay(startDate, pattern, locale)} - ${formatDateWithDay(endDate, pattern, locale)}`;
}

/** Defense-in-depth: only allow http/https URLs in href attributes */
export function isSafeUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}
