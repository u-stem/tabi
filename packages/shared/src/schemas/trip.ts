import { z } from "zod";
import { MAX_OPTIONS_PER_POLL } from "../limits";

export const TRIP_TITLE_MAX_LENGTH = 100;
export const TRIP_DESTINATION_MAX_LENGTH = 100;
export const COVER_IMAGE_URL_MAX_LENGTH = 500;

export const tripStatusSchema = z.enum(["scheduling", "draft", "planned", "active", "completed"]);
export type TripStatus = z.infer<typeof tripStatusSchema>;

export const createTripSchema = z
  .object({
    title: z.string().min(1).max(TRIP_TITLE_MAX_LENGTH),
    destination: z.string().max(TRIP_DESTINATION_MAX_LENGTH).optional(),
    coverImageUrl: z.string().url().max(COVER_IMAGE_URL_MAX_LENGTH).optional(),
    startDate: z.string().date(),
    endDate: z.string().date(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "End date must be on or after start date",
    path: ["endDate"],
  });
// Used when creating a trip with schedule poll mode
export const createTripWithPollSchema = z.object({
  title: z.string().min(1).max(TRIP_TITLE_MAX_LENGTH),
  destination: z.string().max(TRIP_DESTINATION_MAX_LENGTH).optional(),
  coverImageUrl: z.string().url().max(COVER_IMAGE_URL_MAX_LENGTH).optional(),
  pollOptions: z
    .array(
      z
        .object({
          startDate: z.string().date(),
          endDate: z.string().date(),
        })
        .refine((d) => d.endDate >= d.startDate, {
          message: "End date must be on or after start date",
          path: ["endDate"],
        }),
    )
    .min(1)
    .max(MAX_OPTIONS_PER_POLL),
});

export const updateTripSchema = z
  .object({
    title: z.string().min(1).max(TRIP_TITLE_MAX_LENGTH).optional(),
    destination: z.string().max(TRIP_DESTINATION_MAX_LENGTH).nullable().optional(),
    status: tripStatusSchema.optional(),
    coverImageUrl: z.string().url().max(COVER_IMAGE_URL_MAX_LENGTH).nullable().optional(),
    coverImagePosition: z.number().int().min(0).max(100).optional(),
    startDate: z.string().date().optional(),
    endDate: z.string().date().optional(),
  })
  .refine(
    (data) => {
      // Only validates when both dates are provided in the same request.
      // Single-date updates are validated against existing DB values in the route handler.
      if (data.startDate && data.endDate) return data.endDate >= data.startDate;
      return true;
    },
    { message: "End date must be on or after start date", path: ["endDate"] },
  );
