import { z } from "zod";

export const tripStatusSchema = z.enum(["draft", "planned", "active", "completed"]);
export type TripStatus = z.infer<typeof tripStatusSchema>;

export const createTripSchema = z
  .object({
    title: z.string().min(1).max(100),
    destination: z.string().min(1).max(100),
    startDate: z.string().date(),
    endDate: z.string().date(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "End date must be on or after start date",
    path: ["endDate"],
  });
export type CreateTripInput = z.infer<typeof createTripSchema>;

export const updateTripSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  destination: z.string().min(1).max(100).optional(),
  status: tripStatusSchema.optional(),
});
export type UpdateTripInput = z.infer<typeof updateTripSchema>;
