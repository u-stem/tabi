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

export const transportMethodSchema = z.enum([
  "train",
  "shinkansen",
  "bus",
  "taxi",
  "walk",
  "car",
  "airplane",
]);
export type TransportMethod = z.infer<typeof transportMethodSchema>;

const timeRegex = /^\d{2}:\d{2}(:\d{2})?$/;

export const SCHEDULE_NAME_MAX_LENGTH = 200;
export const SCHEDULE_ADDRESS_MAX_LENGTH = 500;
export const SCHEDULE_MEMO_MAX_LENGTH = 2000;
export const SCHEDULE_URL_MAX_LENGTH = 2000;
export const SCHEDULE_PLACE_MAX_LENGTH = 200;
export const MAX_END_DAY_OFFSET = 30;
const CANDIDATE_NAME_MAX_LENGTH = 200;
const CANDIDATE_MEMO_MAX_LENGTH = 2000;

export const createScheduleSchema = z.object({
  name: z.string().min(1).max(SCHEDULE_NAME_MAX_LENGTH),
  category: scheduleCategorySchema,
  address: z.string().max(SCHEDULE_ADDRESS_MAX_LENGTH).optional(),
  startTime: z.string().regex(timeRegex).optional(),
  endTime: z.string().regex(timeRegex).optional(),
  memo: z.string().max(SCHEDULE_MEMO_MAX_LENGTH).optional(),
  url: z.string().url().max(SCHEDULE_URL_MAX_LENGTH).optional(),
  departurePlace: z.string().max(SCHEDULE_PLACE_MAX_LENGTH).optional(),
  arrivalPlace: z.string().max(SCHEDULE_PLACE_MAX_LENGTH).optional(),
  transportMethod: transportMethodSchema.optional(),
  color: scheduleColorSchema.default("blue"),
  endDayOffset: z.number().int().min(1).max(MAX_END_DAY_OFFSET).nullable().optional(),
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
  name: z.string().min(1).max(CANDIDATE_NAME_MAX_LENGTH),
  category: scheduleCategorySchema,
  memo: z.string().max(CANDIDATE_MEMO_MAX_LENGTH).optional(),
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

export const REACTION_TYPES = ["like", "hmm"] as const;
export type ReactionType = (typeof REACTION_TYPES)[number];

export const reactionSchema = z.object({
  type: z.enum(REACTION_TYPES),
});
export type ReactionInput = z.infer<typeof reactionSchema>;
