import { z } from "zod";

export const userProfileResponseSchema = z.object({
  id: z.string().check(z.guid()),
  name: z.string(),
  image: z.string().nullable().optional(),
});

export type UserProfileResponse = z.infer<typeof userProfileResponseSchema>;
