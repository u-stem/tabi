import { z } from "zod";

export const updateTripDaySchema = z.object({
  memo: z.string().max(500).nullable(),
});

export type UpdateTripDay = z.infer<typeof updateTripDaySchema>;
