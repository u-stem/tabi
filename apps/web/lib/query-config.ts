// Centralized cache configuration for TanStack Query.
// dynamic: trips, schedules, polls — changes with user actions
// stable:  profile, friends, notification settings — changes infrequently
// static:  FAQs, announcements — rarely changes
//
// gcTime is set to 24 hours for all tiers to support offline viewing.
// Cached data persists in memory for a full day, and is also written to
// IndexedDB by the persister (see idb-persister.ts) for cross-session survival.
// staleTime controls when background refetch occurs while online.
const ONE_DAY = 24 * 60 * 60 * 1000;

export const QUERY_CONFIG = {
  dynamic: { staleTime: 15_000, gcTime: ONE_DAY },
  stable: { staleTime: 60_000, gcTime: ONE_DAY },
  static: { staleTime: 5 * 60_000, gcTime: ONE_DAY },
} as const;
