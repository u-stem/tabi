import { z } from "zod";

export const memberRoleSchema = z.enum(["editor", "viewer"]);
export type InviteMemberRole = z.infer<typeof memberRoleSchema>;

export const addMemberSchema = z.object({
  email: z.string().email(),
  role: memberRoleSchema,
});
export type AddMemberInput = z.infer<typeof addMemberSchema>;

export const updateMemberRoleSchema = z.object({
  role: memberRoleSchema,
});
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
