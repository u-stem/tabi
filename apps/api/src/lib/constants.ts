export const DEFAULT_PATTERN_LABEL = "デフォルト";
export const MAX_TRIP_DAYS = 365;

export const WS_CLOSE_CODE = {
  UNAUTHORIZED: 4401,
  NOT_A_MEMBER: 4403,
} as const;

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
} as const;
