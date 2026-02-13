import { z } from "zod";

export const FEEDBACK_BODY_MAX_LENGTH = 1000;

export const createFeedbackSchema = z.object({
  body: z.string().min(1).max(FEEDBACK_BODY_MAX_LENGTH),
});
