import { z } from "zod";

export const PATTERN_LABEL_MAX_LENGTH = 50;

export const createDayPatternSchema = z.object({
  label: z.string().min(1).max(PATTERN_LABEL_MAX_LENGTH),
});

export const updateDayPatternSchema = z.object({
  label: z.string().min(1).max(PATTERN_LABEL_MAX_LENGTH).optional(),
  sortOrder: z.number().int().min(0).optional(),
});
