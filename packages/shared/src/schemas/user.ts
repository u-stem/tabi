import { z } from "zod";

export const userProfileResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  image: z.string().nullable().optional(),
});
