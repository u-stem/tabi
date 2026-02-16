import type { ScheduleCategory, ScheduleColor, TransportMethod } from "@sugara/shared";

type ScheduleFormState = {
  category: ScheduleCategory;
  color: ScheduleColor;
  startTime: string | undefined;
  endTime: string | undefined;
  transportMethod: TransportMethod | "";
  endDayOffset: number;
  urls: string[];
};

// Use `|| undefined` for fields where absence means "not set" (time, transportMethod).
// Use `emptyToNull` for clearable text fields so the API receives null to clear the value,
// rather than omitting the field (which would leave the old value intact on partial updates).
function emptyToNull(value: string | null): string | null {
  return value && value.trim() !== "" ? value : null;
}

export function buildSchedulePayload(formData: FormData, state: ScheduleFormState) {
  return {
    name: formData.get("name") as string,
    category: state.category,
    color: state.color,
    address:
      state.category !== "transport"
        ? emptyToNull(formData.get("address") as string)
        : undefined,
    urls: state.urls.filter((u) => u.trim() !== ""),
    startTime: state.startTime || undefined,
    endTime: state.endTime || undefined,
    memo: emptyToNull(formData.get("memo") as string),
    ...(state.category === "transport"
      ? {
          departurePlace: emptyToNull(formData.get("departurePlace") as string),
          arrivalPlace: emptyToNull(formData.get("arrivalPlace") as string),
          transportMethod: state.transportMethod || undefined,
        }
      : {}),
    ...(state.endDayOffset > 0 ? { endDayOffset: state.endDayOffset } : {}),
  };
}
