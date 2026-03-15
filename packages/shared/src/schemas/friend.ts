import { z } from "zod";

export const friendRequestSchema = z.object({
  addresseeId: z.string().check(z.guid()),
});

export const acceptFriendRequestSchema = z.object({
  status: z.literal("accepted"),
});
