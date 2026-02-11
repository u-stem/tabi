import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
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
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

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
});

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
});

export const verifications = pgTable("verifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  identifier: varchar("identifier", { length: 255 }).notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

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
});

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
  (table) => [primaryKey({ columns: [table.tripId, table.userId] })],
);

export const tripDays = pgTable("trip_days", {
  id: uuid("id").primaryKey().defaultRandom(),
  tripId: uuid("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  dayNumber: integer("day_number").notNull(),
  memo: text("memo"),
});

export const dayPatterns = pgTable("day_patterns", {
  id: uuid("id").primaryKey().defaultRandom(),
  tripDayId: uuid("trip_day_id")
    .notNull()
    .references(() => tripDays.id, { onDelete: "cascade" }),
  label: varchar("label", { length: 50 }).notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const schedules = pgTable("schedules", {
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
  url: varchar("url", { length: 2000 }),
  departurePlace: varchar("departure_place", { length: 200 }),
  arrivalPlace: varchar("arrival_place", { length: 200 }),
  transportMethod: transportMethodEnum("transport_method"),
  color: scheduleColorEnum("color").notNull().default("blue"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// --- Relations ---

export const usersRelations = relations(users, ({ many }) => ({
  trips: many(trips),
  tripMembers: many(tripMembers),
}));

export const tripsRelations = relations(trips, ({ one, many }) => ({
  owner: one(users, { fields: [trips.ownerId], references: [users.id] }),
  members: many(tripMembers),
  days: many(tripDays),
  schedules: many(schedules),
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

export const schedulesRelations = relations(schedules, ({ one }) => ({
  trip: one(trips, { fields: [schedules.tripId], references: [trips.id] }),
  dayPattern: one(dayPatterns, { fields: [schedules.dayPatternId], references: [dayPatterns.id] }),
}));
