import { z } from "zod";

export const TRIP_TITLE_MAX_LENGTH = 100;
export const TRIP_DESTINATION_MAX_LENGTH = 100;

export const tripStatusSchema = z.enum(["draft", "planned", "active", "completed"]);
export type TripStatus = z.infer<typeof tripStatusSchema>;

export const createTripSchema = z
  .object({
    title: z.string().min(1).max(TRIP_TITLE_MAX_LENGTH),
    destination: z.string().min(1).max(TRIP_DESTINATION_MAX_LENGTH),
    startDate: z.string().date(),
    endDate: z.string().date(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "End date must be on or after start date",
    path: ["endDate"],
  });
export type CreateTripInput = z.infer<typeof createTripSchema>;

export const updateTripSchema = z
  .object({
    title: z.string().min(1).max(TRIP_TITLE_MAX_LENGTH).optional(),
    destination: z.string().min(1).max(TRIP_DESTINATION_MAX_LENGTH).optional(),
    status: tripStatusSchema.optional(),
    startDate: z.string().date().optional(),
    endDate: z.string().date().optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) return data.endDate >= data.startDate;
      return true;
    },
    { message: "End date must be on or after start date", path: ["endDate"] },
  );
export type UpdateTripInput = z.infer<typeof updateTripSchema>;
