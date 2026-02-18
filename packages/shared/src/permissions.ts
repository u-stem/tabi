import type { MemberRole } from "./schemas/member";

export function canEdit(role: MemberRole | null): boolean {
  return role === "owner" || role === "editor";
}

export function isOwner(role: MemberRole | null): boolean {
  return role === "owner";
}
