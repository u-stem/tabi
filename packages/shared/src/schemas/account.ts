import { z } from "zod";

export const deleteAccountSchema = z.object({
  password: z.string().min(1),
});
