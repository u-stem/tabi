import { z } from "zod";
import { GROUP_NAME_MAX_LENGTH } from "../limits";

export const createGroupSchema = z.object({
  name: z.string().min(1).max(GROUP_NAME_MAX_LENGTH),
});

export const updateGroupSchema = z.object({
  name: z.string().min(1).max(GROUP_NAME_MAX_LENGTH),
});

export const addGroupMemberSchema = z.object({
  userId: z.string().uuid(),
});
