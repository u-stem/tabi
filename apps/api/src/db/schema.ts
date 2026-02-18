import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const tripStatusEnum = pgEnum("trip_status", ["draft", "planned", "active", "completed"]);
export const tripMemberRoleEnum = pgEnum("trip_member_role", ["owner", "editor", "viewer"]);
export const transportMethodEnum = pgEnum("transport_method", [
  "train",
  "shinkansen",
  "bus",
  "taxi",
  "walk",
  "car",
  "airplane",
]);

export const friendStatusEnum = pgEnum("friend_status", ["pending", "accepted"]);

export const bookmarkListVisibilityEnum = pgEnum("bookmark_list_visibility", [
  "private",
  "friends_only",
  "public",
]);

export const scheduleCategoryEnum = pgEnum("schedule_category", [
  "sightseeing",
  "restaurant",
  "hotel",
  "transport",
  "activity",
  "other",
]);

export const scheduleColorEnum = pgEnum("schedule_color", [
  "blue",
  "red",
  "green",
  "yellow",
  "purple",
  "pink",
  "orange",
  "gray",
]);

export const pollStatusEnum = pgEnum("poll_status", ["open", "confirmed", "closed"]);
export const pollResponseEnum = pgEnum("poll_response", ["ok", "maybe", "ng"]);

// --- Tables ---

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: varchar("image", { length: 500 }),
  username: varchar("username", { length: 30 }).unique(),
  displayUsername: varchar("display_username", { length: 30 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: varchar("account_id", { length: 255 }).notNull(),
  providerId: varchar("provider_id", { length: 255 }).notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: varchar("scope", { length: 500 }),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

export const verifications = pgTable("verifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  identifier: varchar("identifier", { length: 255 }).notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

export const trips = pgTable(
  "trips",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 100 }).notNull(),
    destination: varchar("destination", { length: 100 }).notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    status: tripStatusEnum("status").notNull().default("draft"),
    coverImageUrl: varchar("cover_image_url", { length: 500 }),
    shareToken: varchar("share_token", { length: 64 }).unique(),
    shareTokenExpiresAt: timestamp("share_token_expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check("trips_date_range_check", sql`${table.endDate} >= ${table.startDate}`)],
).enableRLS();

export const tripMembers = pgTable(
  "trip_members",
  {
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: tripMemberRoleEnum("role").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tripId, table.userId] }),
    index("trip_members_user_id_idx").on(table.userId),
  ],
).enableRLS();

export const tripDays = pgTable(
  "trip_days",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    dayNumber: integer("day_number").notNull(),
    memo: text("memo"),
  },
  (table) => [uniqueIndex("trip_days_trip_date_unique").on(table.tripId, table.date)],
).enableRLS();

export const dayPatterns = pgTable(
  "day_patterns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tripDayId: uuid("trip_day_id")
      .notNull()
      .references(() => tripDays.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 50 }).notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("day_patterns_trip_day_id_idx").on(table.tripDayId)],
).enableRLS();

export const schedules = pgTable(
  "schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    dayPatternId: uuid("day_pattern_id").references(() => dayPatterns.id, {
      onDelete: "cascade",
    }),
    name: varchar("name", { length: 200 }).notNull(),
    category: scheduleCategoryEnum("category").notNull(),
    address: varchar("address", { length: 500 }),
    startTime: time("start_time"),
    endTime: time("end_time"),
    sortOrder: integer("sort_order").notNull().default(0),
    memo: text("memo"),
    urls: text("urls").array().notNull().default([]),
    departurePlace: varchar("departure_place", { length: 200 }),
    arrivalPlace: varchar("arrival_place", { length: 200 }),
    transportMethod: transportMethodEnum("transport_method"),
    color: scheduleColorEnum("color").notNull().default("blue"),
    endDayOffset: integer("end_day_offset"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("schedules_trip_id_idx").on(table.tripId),
    index("schedules_day_pattern_id_idx").on(table.dayPatternId),
  ],
).enableRLS();

export const reactionTypeEnum = pgEnum("reaction_type", ["like", "hmm"]);

export const scheduleReactions = pgTable(
  "schedule_reactions",
  {
    scheduleId: uuid("schedule_id")
      .notNull()
      .references(() => schedules.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: reactionTypeEnum("type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.scheduleId, table.userId] })],
).enableRLS();

export const activityLogs = pgTable(
  "activity_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    action: varchar("action", { length: 50 }).notNull(),
    entityType: varchar("entity_type", { length: 50 }).notNull(),
    entityName: varchar("entity_name", { length: 200 }),
    detail: varchar("detail", { length: 200 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("activity_logs_trip_id_created_at_idx").on(table.tripId, table.createdAt)],
).enableRLS();

export const friends = pgTable(
  "friends",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requesterId: uuid("requester_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    addresseeId: uuid("addressee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: friendStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("friends_pair_unique").on(
      sql`least(${table.requesterId}, ${table.addresseeId})`,
      sql`greatest(${table.requesterId}, ${table.addresseeId})`,
    ),
    check("friends_no_self_ref", sql`${table.requesterId} != ${table.addresseeId}`),
    index("friends_requester_id_idx").on(table.requesterId),
    index("friends_addressee_id_idx").on(table.addresseeId),
  ],
).enableRLS();

export const bookmarkLists = pgTable(
  "bookmark_lists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 50 }).notNull(),
    visibility: bookmarkListVisibilityEnum("visibility").notNull().default("private"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("bookmark_lists_user_sort_idx").on(table.userId, table.sortOrder)],
).enableRLS();

export const bookmarks = pgTable(
  "bookmarks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listId: uuid("list_id")
      .notNull()
      .references(() => bookmarkLists.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull(),
    memo: text("memo"),
    urls: text("urls").array().notNull().default([]),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("bookmarks_list_sort_idx").on(table.listId, table.sortOrder)],
).enableRLS();

export const groups = pgTable(
  "groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 50 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("groups_owner_id_idx").on(table.ownerId)],
).enableRLS();

export const groupMembers = pgTable(
  "group_members",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.groupId, table.userId] }),
    index("group_members_user_id_idx").on(table.userId),
  ],
).enableRLS();

export const schedulePolls = pgTable(
  "schedule_polls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 100 }).notNull(),
    destination: varchar("destination", { length: 100 }).notNull(),
    note: text("note"),
    status: pollStatusEnum("status").notNull().default("open"),
    deadline: timestamp("deadline", { withTimezone: true }),
    shareToken: varchar("share_token", { length: 64 }).unique(),
    confirmedOptionId: uuid("confirmed_option_id"),
    tripId: uuid("trip_id").references(() => trips.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("schedule_polls_owner_id_idx").on(table.ownerId)],
).enableRLS();

export const schedulePollOptions = pgTable(
  "schedule_poll_options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pollId: uuid("poll_id")
      .notNull()
      .references(() => schedulePolls.id, { onDelete: "cascade" }),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    index("schedule_poll_options_poll_id_idx").on(table.pollId),
    check("poll_options_date_range_check", sql`${table.endDate} >= ${table.startDate}`),
  ],
).enableRLS();

export const schedulePollParticipants = pgTable(
  "schedule_poll_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pollId: uuid("poll_id")
      .notNull()
      .references(() => schedulePolls.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    guestName: varchar("guest_name", { length: 50 }),
  },
  (table) => [
    index("schedule_poll_participants_poll_id_idx").on(table.pollId),
    uniqueIndex("schedule_poll_participants_poll_user_unique")
      .on(table.pollId, table.userId)
      .where(sql`${table.userId} IS NOT NULL`),
  ],
).enableRLS();

export const schedulePollResponses = pgTable(
  "schedule_poll_responses",
  {
    participantId: uuid("participant_id")
      .notNull()
      .references(() => schedulePollParticipants.id, { onDelete: "cascade" }),
    optionId: uuid("option_id")
      .notNull()
      .references(() => schedulePollOptions.id, { onDelete: "cascade" }),
    response: pollResponseEnum("response").notNull(),
  },
  (table) => [primaryKey({ columns: [table.participantId, table.optionId] })],
).enableRLS();

// --- Relations ---

export const usersRelations = relations(users, ({ many }) => ({
  trips: many(trips),
  tripMembers: many(tripMembers),
  sentFriendRequests: many(friends, { relationName: "friendRequester" }),
  receivedFriendRequests: many(friends, { relationName: "friendAddressee" }),
  bookmarkLists: many(bookmarkLists),
  ownedGroups: many(groups),
  groupMemberships: many(groupMembers),
  schedulePolls: many(schedulePolls),
  schedulePollParticipations: many(schedulePollParticipants),
}));

export const tripsRelations = relations(trips, ({ one, many }) => ({
  owner: one(users, { fields: [trips.ownerId], references: [users.id] }),
  members: many(tripMembers),
  days: many(tripDays),
  schedules: many(schedules),
  activityLogs: many(activityLogs),
}));

export const tripMembersRelations = relations(tripMembers, ({ one }) => ({
  trip: one(trips, { fields: [tripMembers.tripId], references: [trips.id] }),
  user: one(users, { fields: [tripMembers.userId], references: [users.id] }),
}));

export const tripDaysRelations = relations(tripDays, ({ one, many }) => ({
  trip: one(trips, { fields: [tripDays.tripId], references: [trips.id] }),
  patterns: many(dayPatterns),
}));

export const dayPatternsRelations = relations(dayPatterns, ({ one, many }) => ({
  tripDay: one(tripDays, { fields: [dayPatterns.tripDayId], references: [tripDays.id] }),
  schedules: many(schedules),
}));

export const schedulesRelations = relations(schedules, ({ one, many }) => ({
  trip: one(trips, { fields: [schedules.tripId], references: [trips.id] }),
  dayPattern: one(dayPatterns, { fields: [schedules.dayPatternId], references: [dayPatterns.id] }),
  reactions: many(scheduleReactions),
}));

export const scheduleReactionsRelations = relations(scheduleReactions, ({ one }) => ({
  schedule: one(schedules, {
    fields: [scheduleReactions.scheduleId],
    references: [schedules.id],
  }),
  user: one(users, {
    fields: [scheduleReactions.userId],
    references: [users.id],
  }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  trip: one(trips, { fields: [activityLogs.tripId], references: [trips.id] }),
  user: one(users, { fields: [activityLogs.userId], references: [users.id] }),
}));

export const friendsRelations = relations(friends, ({ one }) => ({
  requester: one(users, {
    fields: [friends.requesterId],
    references: [users.id],
    relationName: "friendRequester",
  }),
  addressee: one(users, {
    fields: [friends.addresseeId],
    references: [users.id],
    relationName: "friendAddressee",
  }),
}));

export const groupsRelations = relations(groups, ({ one, many }) => ({
  owner: one(users, { fields: [groups.ownerId], references: [users.id] }),
  members: many(groupMembers),
}));

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(groups, { fields: [groupMembers.groupId], references: [groups.id] }),
  user: one(users, { fields: [groupMembers.userId], references: [users.id] }),
}));

export const bookmarkListsRelations = relations(bookmarkLists, ({ one, many }) => ({
  user: one(users, { fields: [bookmarkLists.userId], references: [users.id] }),
  bookmarks: many(bookmarks),
}));

export const bookmarksRelations = relations(bookmarks, ({ one }) => ({
  list: one(bookmarkLists, { fields: [bookmarks.listId], references: [bookmarkLists.id] }),
}));

export const schedulePollsRelations = relations(schedulePolls, ({ one, many }) => ({
  owner: one(users, { fields: [schedulePolls.ownerId], references: [users.id] }),
  trip: one(trips, { fields: [schedulePolls.tripId], references: [trips.id] }),
  options: many(schedulePollOptions),
  participants: many(schedulePollParticipants),
}));

export const schedulePollOptionsRelations = relations(schedulePollOptions, ({ one, many }) => ({
  poll: one(schedulePolls, {
    fields: [schedulePollOptions.pollId],
    references: [schedulePolls.id],
  }),
  responses: many(schedulePollResponses),
}));

export const schedulePollParticipantsRelations = relations(
  schedulePollParticipants,
  ({ one, many }) => ({
    poll: one(schedulePolls, {
      fields: [schedulePollParticipants.pollId],
      references: [schedulePolls.id],
    }),
    user: one(users, { fields: [schedulePollParticipants.userId], references: [users.id] }),
    responses: many(schedulePollResponses),
  }),
);

export const schedulePollResponsesRelations = relations(schedulePollResponses, ({ one }) => ({
  participant: one(schedulePollParticipants, {
    fields: [schedulePollResponses.participantId],
    references: [schedulePollParticipants.id],
  }),
  option: one(schedulePollOptions, {
    fields: [schedulePollResponses.optionId],
    references: [schedulePollOptions.id],
  }),
}));
