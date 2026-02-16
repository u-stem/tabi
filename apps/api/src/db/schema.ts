import { relations, sql } from "drizzle-orm";
import {
  boolean,
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

// --- Tables ---

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: varchar("image", { length: 500 }),
  username: varchar("username", { length: 30 }).unique(),
  displayUsername: varchar("display_username", { length: 30 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}).enableRLS();

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
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
  expiresAt: timestamp("expires_at"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: varchar("scope", { length: 500 }),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}).enableRLS();

export const verifications = pgTable("verifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  identifier: varchar("identifier", { length: 255 }).notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}).enableRLS();

export const trips = pgTable("trips", {
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
  shareTokenExpiresAt: timestamp("share_token_expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}).enableRLS();

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
    createdAt: timestamp("created_at").notNull().defaultNow(),
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
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
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
    createdAt: timestamp("created_at").notNull().defaultNow(),
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
    createdAt: timestamp("created_at").notNull().defaultNow(),
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
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("friends_pair_unique").on(
      sql`least(${table.requesterId}, ${table.addresseeId})`,
      sql`greatest(${table.requesterId}, ${table.addresseeId})`,
    ),
    index("friends_requester_id_idx").on(table.requesterId),
    index("friends_addressee_id_idx").on(table.addresseeId),
  ],
).enableRLS();

// --- Relations ---

export const usersRelations = relations(users, ({ many }) => ({
  trips: many(trips),
  tripMembers: many(tripMembers),
  sentFriendRequests: many(friends, { relationName: "friendRequester" }),
  receivedFriendRequests: many(friends, { relationName: "friendAddressee" }),
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
