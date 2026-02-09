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

export const transportMethodSchema = z.enum([
  "train",
  "bus",
  "taxi",
  "walk",
  "car",
  "airplane",
]);
export type TransportMethod = z.infer<typeof transportMethodSchema>;

const timeRegex = /^\d{2}:\d{2}$/;

export const createSpotSchema = z.object({
  name: z.string().min(1).max(200),
  category: spotCategorySchema,
  address: z.string().max(500).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  startTime: z.string().regex(timeRegex).optional(),
  endTime: z.string().regex(timeRegex).optional(),
  memo: z.string().max(2000).optional(),
  url: z.string().url().max(2000).optional(),
  departurePlace: z.string().max(200).optional(),
  arrivalPlace: z.string().max(200).optional(),
  transportMethod: transportMethodSchema.optional(),
});
export type CreateSpotInput = z.infer<typeof createSpotSchema>;

export const updateSpotSchema = createSpotSchema.partial();
export type UpdateSpotInput = z.infer<typeof updateSpotSchema>;

export const reorderSpotsSchema = z.object({
  spotIds: z.array(z.string().uuid()),
});
export type ReorderSpotsInput = z.infer<typeof reorderSpotsSchema>;
