import { z } from "zod";

export const fullMemberRoleSchema = z.enum(["owner", "editor", "viewer"]);
export type MemberRole = z.infer<typeof fullMemberRoleSchema>;

export const assignableRoleSchema = z.enum(["editor", "viewer"]);
export type AssignableRole = z.infer<typeof assignableRoleSchema>;

export const addMemberSchema = z.object({
  email: z.string().email(),
  role: assignableRoleSchema,
});
export type AddMemberInput = z.infer<typeof addMemberSchema>;

export const updateMemberRoleSchema = z.object({
  role: assignableRoleSchema,
});
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
