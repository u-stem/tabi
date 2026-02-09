// Parse YYYY-MM-DD directly to avoid timezone issues with Date constructor
export function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
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

export function validateTimeRange(startTime?: string, endTime?: string): string | null {
  if (!startTime && endTime) return "開始時間を入力してください";
  if (startTime && endTime && startTime >= endTime) return "終了時間は開始時間より後にしてください";
  return null;
}
