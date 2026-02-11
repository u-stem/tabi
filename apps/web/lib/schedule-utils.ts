import { CATEGORY_LABELS, TRANSPORT_METHOD_LABELS } from "@sugara/shared";

export function getTimeLabels(category: string): { start: string; end: string } {
  if (category === "transport") return { start: "出発時間", end: "到着時間" };
  if (category === "hotel") return { start: "チェックイン", end: "チェックアウト" };
  return { start: "開始時間", end: "終了時間" };
}

export function getEndDayOptions(maxOffset: number): { value: number; label: string }[] {
  const options = [{ value: 0, label: "当日" }];
  if (maxOffset >= 1) options.push({ value: 1, label: "翌日" });
  for (let i = 2; i <= maxOffset; i++) {
    options.push({ value: i, label: `${i}日後` });
  }
  return options;
}

export const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export const TRANSPORT_METHOD_OPTIONS = Object.entries(TRANSPORT_METHOD_LABELS).map(
  ([value, label]) => ({
    value,
    label,
  }),
);
