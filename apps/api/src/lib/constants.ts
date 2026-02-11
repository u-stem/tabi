export const DEFAULT_PATTERN_LABEL = "デフォルト";
export const MAX_TRIP_DAYS = 365;

export const ERROR_MSG = {
  TRIP_NOT_FOUND: "Trip not found",
  SCHEDULE_NOT_FOUND: "Schedule not found",
  PATTERN_NOT_FOUND: "Pattern not found",
  CANNOT_DELETE_DEFAULT: "Cannot delete default pattern",
  INVALID_JSON: "Invalid JSON",
  INTERNAL_ERROR: "Internal server error",
  DATE_ORDER: "End date must be on or after start date",
  SHARED_NOT_FOUND: "Shared trip not found",
  CANDIDATE_NOT_FOUND: "Candidate not found",
  CONFLICT: "Resource was modified by another user",
  USER_NOT_FOUND: "User not found",
  ALREADY_MEMBER: "Already a member",
  CANNOT_CHANGE_OWN_ROLE: "Cannot change own role",
  MEMBER_NOT_FOUND: "Member not found",
  CANNOT_REMOVE_SELF: "Cannot remove yourself",
  INVALID_REORDER: "Some schedules do not belong to this pattern",
} as const;
