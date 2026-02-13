import { z } from "zod";

export const friendRequestSchema = z.object({
  addresseeId: z.string().uuid(),
});

export const acceptFriendRequestSchema = z.object({
  status: z.literal("accepted"),
});
