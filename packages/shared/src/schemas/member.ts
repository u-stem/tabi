import { z } from "zod";

const fullMemberRoleSchema = z.enum(["owner", "editor", "viewer"]);
export type MemberRole = z.infer<typeof fullMemberRoleSchema>;

const assignableRoleSchema = z.enum(["editor", "viewer"]);

export const addMemberSchema = z.object({
  userId: z.string().uuid(),
  role: assignableRoleSchema,
});

export const updateMemberRoleSchema = z.object({
  role: assignableRoleSchema,
});
