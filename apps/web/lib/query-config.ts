// Centralized cache configuration for TanStack Query.
// dynamic: trips, schedules, polls — changes with user actions
// stable:  profile, friends, notification settings — changes infrequently
// static:  FAQs, announcements — rarely changes
export const QUERY_CONFIG = {
  dynamic: { staleTime: 15_000, gcTime: 60_000 },
  stable: { staleTime: 60_000, gcTime: 5 * 60_000 },
  static: { staleTime: 5 * 60_000, gcTime: 30 * 60_000 },
} as const;
