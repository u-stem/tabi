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
function isValidTime(val: string): boolean {
  const [h, m] = val.split(":").map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}
const timeSchema = z
  .string()
  .regex(timeRegex, "Invalid time format")
  .refine(isValidTime, "Time out of range");

export const SCHEDULE_NAME_MAX_LENGTH = 200;
export const SCHEDULE_ADDRESS_MAX_LENGTH = 500;
export const SCHEDULE_MEMO_MAX_LENGTH = 2000;
export const SCHEDULE_URL_MAX_LENGTH = 2000;
export const MAX_URLS_PER_SCHEDULE = 5;
export const SCHEDULE_PLACE_MAX_LENGTH = 200;
export const MAX_END_DAY_OFFSET = 30;

const singleUrlSchema = z
  .string()
  .url()
  .max(SCHEDULE_URL_MAX_LENGTH)
  .refine((v) => {
    try {
      const { protocol } = new URL(v);
      return protocol === "http:" || protocol === "https:";
    } catch {
      return false;
    }
  }, "Only http and https URLs are allowed");

const urlsSchema = z
  .array(singleUrlSchema)
  .max(MAX_URLS_PER_SCHEDULE)
  .refine((arr) => new Set(arr).size === arr.length, "Duplicate URLs are not allowed")
  .default([]);

export const createScheduleSchema = z.object({
  name: z.string().min(1).max(SCHEDULE_NAME_MAX_LENGTH),
  category: scheduleCategorySchema,
  address: z.string().max(SCHEDULE_ADDRESS_MAX_LENGTH).optional(),
  startTime: timeSchema.optional(),
  endTime: timeSchema.optional(),
  memo: z.string().max(SCHEDULE_MEMO_MAX_LENGTH).optional(),
  urls: urlsSchema,
  departurePlace: z.string().max(SCHEDULE_PLACE_MAX_LENGTH).optional(),
  arrivalPlace: z.string().max(SCHEDULE_PLACE_MAX_LENGTH).optional(),
  transportMethod: transportMethodSchema.optional(),
  color: scheduleColorSchema.default("blue"),
  endDayOffset: z.number().int().min(1).max(MAX_END_DAY_OFFSET).nullable().optional(),
});
export const updateScheduleSchema = createScheduleSchema.partial().extend({
  expectedUpdatedAt: z.string().datetime().optional(),
});

export const reorderSchedulesSchema = z.object({
  scheduleIds: z.array(z.string().uuid()),
});

export const createCandidateSchema = createScheduleSchema;

export const assignCandidateSchema = z.object({
  dayPatternId: z.string().uuid(),
});

export const batchAssignCandidatesSchema = z.object({
  scheduleIds: z.array(z.string().uuid()).min(1),
  dayPatternId: z.string().uuid(),
});

export const batchUnassignSchedulesSchema = z.object({
  scheduleIds: z.array(z.string().uuid()).min(1),
});

export const batchDeleteSchedulesSchema = z.object({
  scheduleIds: z.array(z.string().uuid()).min(1),
});

export const batchShiftSchedulesSchema = z.object({
  scheduleIds: z.array(z.string().uuid()).min(1),
  deltaMinutes: z
    .number()
    .int()
    .min(-1440)
    .max(1440)
    .refine((v) => v !== 0, "deltaMinutes must be non-zero"),
});

export const REACTION_TYPES = ["like", "hmm"] as const;
export type ReactionType = (typeof REACTION_TYPES)[number];

export const reactionSchema = z.object({
  type: z.enum(REACTION_TYPES),
});
