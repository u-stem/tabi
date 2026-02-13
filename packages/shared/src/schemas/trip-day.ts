import { z } from "zod";

export const DAY_MEMO_MAX_LENGTH = 500;

export const updateTripDaySchema = z.object({
  memo: z.string().max(DAY_MEMO_MAX_LENGTH).nullable(),
});
