import { z } from "zod";

export const spotCategorySchema = z.enum([
  "sightseeing",
  "restaurant",
  "hotel",
  "transport",
  "activity",
  "other",
]);
export type SpotCategory = z.infer<typeof spotCategorySchema>;

export const SPOT_COLORS = [
  "blue",
  "red",
  "green",
  "yellow",
  "purple",
  "pink",
  "orange",
  "gray",
] as const;
export const spotColorSchema = z.enum(SPOT_COLORS);
export type SpotColor = z.infer<typeof spotColorSchema>;

export const transportMethodSchema = z.enum(["train", "bus", "taxi", "walk", "car", "airplane"]);
export type TransportMethod = z.infer<typeof transportMethodSchema>;

const timeRegex = /^\d{2}:\d{2}(:\d{2})?$/;

export const createSpotSchema = z.object({
  name: z.string().min(1).max(200),
  category: spotCategorySchema,
  address: z.string().max(500).optional(),
  startTime: z.string().regex(timeRegex).optional(),
  endTime: z.string().regex(timeRegex).optional(),
  memo: z.string().max(2000).optional(),
  url: z.string().url().max(2000).optional(),
  departurePlace: z.string().max(200).optional(),
  arrivalPlace: z.string().max(200).optional(),
  transportMethod: transportMethodSchema.optional(),
  color: spotColorSchema.default("blue"),
});
export type CreateSpotInput = z.infer<typeof createSpotSchema>;

export const updateSpotSchema = createSpotSchema.partial();
export type UpdateSpotInput = z.infer<typeof updateSpotSchema>;

export const reorderSpotsSchema = z.object({
  spotIds: z.array(z.string().uuid()),
});
export type ReorderSpotsInput = z.infer<typeof reorderSpotsSchema>;

export const createCandidateSpotSchema = z.object({
  name: z.string().min(1).max(200),
  category: spotCategorySchema,
  memo: z.string().max(2000).optional(),
});
export type CreateCandidateSpotInput = z.infer<typeof createCandidateSpotSchema>;

export const assignCandidateSchema = z.object({
  dayPatternId: z.string().uuid(),
});
export type AssignCandidateInput = z.infer<typeof assignCandidateSchema>;

export const batchAssignCandidatesSchema = z.object({
  spotIds: z.array(z.string().uuid()).min(1),
  dayPatternId: z.string().uuid(),
});
export type BatchAssignCandidatesInput = z.infer<typeof batchAssignCandidatesSchema>;

export const batchUnassignSpotsSchema = z.object({
  spotIds: z.array(z.string().uuid()).min(1),
});
export type BatchUnassignSpotsInput = z.infer<typeof batchUnassignSpotsSchema>;

export const batchDeleteSpotsSchema = z.object({
  spotIds: z.array(z.string().uuid()).min(1),
});
export type BatchDeleteSpotsInput = z.infer<typeof batchDeleteSpotsSchema>;
