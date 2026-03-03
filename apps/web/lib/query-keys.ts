export const queryKeys = {
  trips: {
    all: ["trips"] as const,
    owned: () => [...queryKeys.trips.all, "owned"] as const,
    shared: () => [...queryKeys.trips.all, "shared"] as const,
    detail: (tripId: string) => [...queryKeys.trips.all, tripId] as const,
    members: (tripId: string) => [...queryKeys.trips.all, tripId, "members"] as const,
    activityLogs: (tripId: string) => [...queryKeys.trips.all, tripId, "activity-logs"] as const,
  },
  friends: {
    all: ["friends"] as const,
    list: () => [...queryKeys.friends.all, "list"] as const,
    requests: () => [...queryKeys.friends.all, "requests"] as const,
  },
  groups: {
    all: ["groups"] as const,
    list: () => [...queryKeys.groups.all, "list"] as const,
    members: (groupId: string) => [...queryKeys.groups.all, groupId, "members"] as const,
  },
  bookmarks: {
    all: ["bookmarks"] as const,
    lists: () => [...queryKeys.bookmarks.all, "lists"] as const,
    list: (listId: string) => [...queryKeys.bookmarks.all, "list", listId] as const,
  },
  profile: {
    bookmarkLists: (userId: string) => ["profile", userId, "bookmark-lists"] as const,
    bookmarkList: (userId: string, listId: string) =>
      ["profile", userId, "bookmark-lists", listId] as const,
  },
  polls: {
    all: ["polls"] as const,
    detail: (pollId: string) => [...queryKeys.polls.all, pollId] as const,
    shared: (token: string) => [...queryKeys.polls.all, "shared", token] as const,
  },
  expenses: {
    all: ["expenses"] as const,
    list: (tripId: string) => [...queryKeys.expenses.all, tripId] as const,
  },
  souvenirs: {
    all: ["souvenirs"] as const,
    list: (tripId: string) => [...queryKeys.souvenirs.all, tripId] as const,
  },
  shared: {
    trip: (token: string) => ["shared", token] as const,
  },
  admin: {
    stats: () => ["admin", "stats"] as const,
    settings: () => ["admin", "settings"] as const,
    users: () => ["admin", "users"] as const,
    announcement: () => ["admin", "announcement"] as const,
  },
  publicSettings: {
    all: ["public-settings"] as const,
  },
  notifications: {
    all: ["notifications"] as const,
    list: () => [...queryKeys.notifications.all, "list"] as const,
    preferences: () => [...queryKeys.notifications.all, "preferences"] as const,
    pushPreferences: (endpoint: string) =>
      [...queryKeys.notifications.all, "push-preferences", endpoint] as const,
  },
};
