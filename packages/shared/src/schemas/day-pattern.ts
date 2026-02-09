import { z } from "zod";

export const createDayPatternSchema = z.object({
  label: z.string().min(1).max(50),
});
export type CreateDayPatternInput = z.infer<typeof createDayPatternSchema>;

export const updateDayPatternSchema = z.object({
  label: z.string().min(1).max(50).optional(),
  sortOrder: z.number().int().min(0).optional(),
});
export type UpdateDayPatternInput = z.infer<typeof updateDayPatternSchema>;
