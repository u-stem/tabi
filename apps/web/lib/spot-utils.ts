import { CATEGORY_LABELS, TRANSPORT_METHOD_LABELS } from "@tabi/shared";

export function getTimeLabels(category: string): { start: string; end: string } {
  if (category === "transport") return { start: "出発時間", end: "到着時間" };
  if (category === "hotel") return { start: "チェックイン", end: "チェックアウト" };
  return { start: "開始時間", end: "終了時間" };
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
