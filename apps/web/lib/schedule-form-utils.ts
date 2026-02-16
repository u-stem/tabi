import type { ScheduleCategory, ScheduleColor, TransportMethod } from "@sugara/shared";

type ScheduleFormState = {
  category: ScheduleCategory;
  color: ScheduleColor;
  startTime: string | undefined;
  endTime: string | undefined;
  transportMethod: TransportMethod | "";
  endDayOffset: number;
};

export function buildSchedulePayload(formData: FormData, state: ScheduleFormState) {
  return {
    name: formData.get("name") as string,
    category: state.category,
    color: state.color,
    address:
      state.category !== "transport" ? (formData.get("address") as string) || undefined : undefined,
    url: (formData.get("url") as string) || undefined,
    startTime: state.startTime || undefined,
    endTime: state.endTime || undefined,
    memo: (formData.get("memo") as string) || undefined,
    ...(state.category === "transport"
      ? {
          departurePlace: (formData.get("departurePlace") as string) || undefined,
          arrivalPlace: (formData.get("arrivalPlace") as string) || undefined,
          transportMethod: state.transportMethod || undefined,
        }
      : {}),
    ...(state.endDayOffset > 0 ? { endDayOffset: state.endDayOffset } : {}),
  };
}
