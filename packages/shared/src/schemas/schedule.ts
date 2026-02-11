import { z } from "zod";

export const scheduleCategorySchema = z.enum([
  "sightseeing",
  "restaurant",
  "hotel",
  "transport",
  "activity",
  "other",
]);
export type ScheduleCategory = z.infer<typeof scheduleCategorySchema>;

export const SCHEDULE_COLORS = [
  "blue",
  "red",
  "green",
  "yellow",
  "purple",
  "pink",
  "orange",
  "gray",
] as const;
export const scheduleColorSchema = z.enum(SCHEDULE_COLORS);
export type ScheduleColor = z.infer<typeof scheduleColorSchema>;

export const transportMethodSchema = z.enum(["train", "bus", "taxi", "walk", "car", "airplane"]);
export type TransportMethod = z.infer<typeof transportMethodSchema>;

const timeRegex = /^\d{2}:\d{2}(:\d{2})?$/;

export const createScheduleSchema = z.object({
  name: z.string().min(1).max(200),
  category: scheduleCategorySchema,
  address: z.string().max(500).optional(),
  startTime: z.string().regex(timeRegex).optional(),
  endTime: z.string().regex(timeRegex).optional(),
  memo: z.string().max(2000).optional(),
  url: z.string().url().max(2000).optional(),
  departurePlace: z.string().max(200).optional(),
  arrivalPlace: z.string().max(200).optional(),
  transportMethod: transportMethodSchema.optional(),
  color: scheduleColorSchema.default("blue"),
});
export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;

export const updateScheduleSchema = createScheduleSchema.partial().extend({
  expectedUpdatedAt: z.string().datetime().optional(),
});
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;

export const reorderSchedulesSchema = z.object({
  scheduleIds: z.array(z.string().uuid()),
});
export type ReorderSchedulesInput = z.infer<typeof reorderSchedulesSchema>;

export const createCandidateSchema = z.object({
  name: z.string().min(1).max(200),
  category: scheduleCategorySchema,
  memo: z.string().max(2000).optional(),
});
export type CreateCandidateInput = z.infer<typeof createCandidateSchema>;

export const assignCandidateSchema = z.object({
  dayPatternId: z.string().uuid(),
});
export type AssignCandidateInput = z.infer<typeof assignCandidateSchema>;

export const batchAssignCandidatesSchema = z.object({
  scheduleIds: z.array(z.string().uuid()).min(1),
  dayPatternId: z.string().uuid(),
});
export type BatchAssignCandidatesInput = z.infer<typeof batchAssignCandidatesSchema>;

export const batchUnassignSchedulesSchema = z.object({
  scheduleIds: z.array(z.string().uuid()).min(1),
});
export type BatchUnassignSchedulesInput = z.infer<typeof batchUnassignSchedulesSchema>;

export const batchDeleteSchedulesSchema = z.object({
  scheduleIds: z.array(z.string().uuid()).min(1),
});
export type BatchDeleteSchedulesInput = z.infer<typeof batchDeleteSchedulesSchema>;
