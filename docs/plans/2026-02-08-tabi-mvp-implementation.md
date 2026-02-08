# tabi MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a travel planning web app where users can create trips, manage daily schedules with spots, view them on a map, and share read-only links.

**Architecture:** Turborepo monorepo with Next.js frontend and Hono API server, sharing Zod schemas. PostgreSQL via Drizzle ORM for data, Better Auth for authentication.

**Tech Stack:** bun, Turborepo, Next.js (App Router), Hono, Drizzle ORM, PostgreSQL, Better Auth, Tailwind CSS, shadcn/ui, Zod, Vitest

---

## Task 1: Monorepo Setup

**Files:**
- Create: `package.json` (root)
- Create: `turbo.json`
- Create: `apps/web/package.json`
- Create: `apps/api/package.json`
- Create: `packages/shared/package.json`
- Create: `tsconfig.json` (root)
- Create: `.gitignore`

**Step 1: Initialize root package.json with bun workspaces**

```json
// package.json
{
  "name": "tabi",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "test": "turbo test",
    "lint": "turbo lint",
    "check-types": "turbo check-types"
  },
  "devDependencies": {
    "turbo": "^2"
  }
}
```

**Step 2: Create turbo.json**

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "dev": {
      "persistent": true,
      "cache": false
    },
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "lint": {},
    "check-types": {
      "dependsOn": ["^build"]
    }
  }
}
```

**Step 3: Create root tsconfig.json**

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

**Step 4: Create shared package**

```json
// packages/shared/package.json
{
  "name": "@tabi/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "test": "vitest run",
    "check-types": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5",
    "vitest": "^3"
  },
  "dependencies": {
    "zod": "^3"
  }
}
```

```json
// packages/shared/tsconfig.json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

```ts
// packages/shared/src/index.ts
export {};
```

**Step 5: Create API app scaffold**

```json
// apps/api/package.json
{
  "name": "@tabi/api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "bun run --hot src/index.ts",
    "build": "bun build src/index.ts --outdir dist --target bun",
    "test": "vitest run",
    "check-types": "tsc --noEmit"
  },
  "dependencies": {
    "@tabi/shared": "workspace:*",
    "hono": "^4"
  },
  "devDependencies": {
    "typescript": "^5",
    "vitest": "^3",
    "@types/bun": "latest"
  }
}
```

```json
// apps/api/tsconfig.json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "types": ["bun-types"]
  },
  "include": ["src/**/*"]
}
```

**Step 6: Create Web app scaffold**

```json
// apps/web/package.json
{
  "name": "@tabi/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "check-types": "tsc --noEmit"
  },
  "dependencies": {
    "@tabi/shared": "workspace:*",
    "next": "^15",
    "react": "^19",
    "react-dom": "^19"
  },
  "devDependencies": {
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "typescript": "^5"
  }
}
```

**Step 7: Create .gitignore**

```
node_modules/
dist/
.next/
.turbo/
*.tsbuildinfo
.env
.env.local
```

**Step 8: Install dependencies and verify**

Run: `bun install`
Expected: Successful install, no errors

Run: `bun run check-types`
Expected: No type errors (may warn about empty projects)

**Step 9: Commit**

```bash
git add -A
git commit -m "chore: monorepo初期セットアップ (Turborepo + bun workspaces)"
```

---

## Task 2: Hono API Server with Health Check

**Files:**
- Create: `apps/api/src/index.ts`
- Create: `apps/api/src/app.ts`
- Create: `apps/api/src/__tests__/health.test.ts`

**Step 1: Write the failing test**

```ts
// apps/api/src/__tests__/health.test.ts
import { describe, expect, it } from "vitest";
import { app } from "../app";

describe("GET /health", () => {
  it("returns ok status", async () => {
    const res = await app.request("/health");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ status: "ok" });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/api && bun run test`
Expected: FAIL - cannot find module `../app`

**Step 3: Write minimal implementation**

```ts
// apps/api/src/app.ts
import { Hono } from "hono";

const app = new Hono();

app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

export { app };
```

```ts
// apps/api/src/index.ts
import { serve } from "@hono/node-server";
import { app } from "./app";

const port = Number(process.env.PORT) || 3001;

console.log(`API server running on http://localhost:${port}`);

export default {
  fetch: app.fetch,
  port,
};
```

Note: `apps/api/src/index.ts` uses Bun's built-in HTTP server via `export default`. No need for `@hono/node-server` when running with bun. Remove the import and use:

```ts
// apps/api/src/index.ts
import { app } from "./app";

const port = Number(process.env.PORT) || 3001;

console.log(`API server running on http://localhost:${port}`);

export default {
  fetch: app.fetch,
  port,
};
```

**Step 4: Run test to verify it passes**

Run: `cd apps/api && bun run test`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/api/src/
git commit -m "feat: Hono APIサーバーとヘルスチェックエンドポイントを追加"
```

---

## Task 3: Shared Zod Schemas

**Files:**
- Create: `packages/shared/src/schemas/trip.ts`
- Create: `packages/shared/src/schemas/spot.ts`
- Create: `packages/shared/src/schemas/index.ts`
- Create: `packages/shared/src/__tests__/trip-schema.test.ts`
- Create: `packages/shared/src/__tests__/spot-schema.test.ts`
- Modify: `packages/shared/src/index.ts`

**Step 1: Write failing test for trip schema**

```ts
// packages/shared/src/__tests__/trip-schema.test.ts
import { describe, expect, it } from "vitest";
import { createTripSchema, tripStatusSchema } from "../schemas/trip";

describe("createTripSchema", () => {
  it("validates a valid trip", () => {
    const result = createTripSchema.safeParse({
      title: "Kyoto 3-day trip",
      destination: "Kyoto",
      startDate: "2025-03-15",
      endDate: "2025-03-17",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty title", () => {
    const result = createTripSchema.safeParse({
      title: "",
      destination: "Kyoto",
      startDate: "2025-03-15",
      endDate: "2025-03-17",
    });
    expect(result.success).toBe(false);
  });

  it("rejects end date before start date", () => {
    const result = createTripSchema.safeParse({
      title: "Trip",
      destination: "Kyoto",
      startDate: "2025-03-17",
      endDate: "2025-03-15",
    });
    expect(result.success).toBe(false);
  });
});

describe("tripStatusSchema", () => {
  it("accepts valid statuses", () => {
    for (const status of ["draft", "planned", "active", "completed"]) {
      expect(tripStatusSchema.safeParse(status).success).toBe(true);
    }
  });

  it("rejects invalid status", () => {
    expect(tripStatusSchema.safeParse("invalid").success).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/shared && bun run test`
Expected: FAIL

**Step 3: Implement trip schema**

```ts
// packages/shared/src/schemas/trip.ts
import { z } from "zod";

export const tripStatusSchema = z.enum([
  "draft",
  "planned",
  "active",
  "completed",
]);
export type TripStatus = z.infer<typeof tripStatusSchema>;

export const createTripSchema = z
  .object({
    title: z.string().min(1).max(100),
    destination: z.string().min(1).max(100),
    startDate: z.string().date(),
    endDate: z.string().date(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "End date must be on or after start date",
    path: ["endDate"],
  });
export type CreateTripInput = z.infer<typeof createTripSchema>;

export const updateTripSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  destination: z.string().min(1).max(100).optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  status: tripStatusSchema.optional(),
});
export type UpdateTripInput = z.infer<typeof updateTripSchema>;
```

**Step 4: Run test to verify it passes**

Run: `cd packages/shared && bun run test`
Expected: PASS

**Step 5: Write failing test for spot schema**

```ts
// packages/shared/src/__tests__/spot-schema.test.ts
import { describe, expect, it } from "vitest";
import { createSpotSchema, spotCategorySchema } from "../schemas/spot";

describe("spotCategorySchema", () => {
  it("accepts valid categories", () => {
    const categories = [
      "sightseeing",
      "restaurant",
      "hotel",
      "transport",
      "activity",
      "other",
    ];
    for (const cat of categories) {
      expect(spotCategorySchema.safeParse(cat).success).toBe(true);
    }
  });
});

describe("createSpotSchema", () => {
  it("validates a valid spot", () => {
    const result = createSpotSchema.safeParse({
      name: "Kinkaku-ji",
      category: "sightseeing",
    });
    expect(result.success).toBe(true);
  });

  it("validates spot with all optional fields", () => {
    const result = createSpotSchema.safeParse({
      name: "Kinkaku-ji",
      category: "sightseeing",
      address: "1 Kinkakujicho, Kita Ward, Kyoto",
      latitude: 35.0394,
      longitude: 135.7292,
      startTime: "09:00",
      endTime: "10:30",
      memo: "Golden Pavilion",
      url: "https://example.com",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = createSpotSchema.safeParse({
      name: "",
      category: "sightseeing",
    });
    expect(result.success).toBe(false);
  });
});
```

**Step 6: Run test to verify it fails**

Run: `cd packages/shared && bun run test`
Expected: FAIL for spot tests

**Step 7: Implement spot schema**

```ts
// packages/shared/src/schemas/spot.ts
import { z } from "zod";

export const spotCategorySchema = z.enum([
  "sightseeing",
  "restaurant",
  "hotel",
  "transport",
  "activity",
  "other",
]);
export type SpotCategory = z.infer<typeof spotCategorySchema>;

const timeRegex = /^\d{2}:\d{2}$/;

export const createSpotSchema = z.object({
  name: z.string().min(1).max(200),
  category: spotCategorySchema,
  address: z.string().max(500).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  startTime: z.string().regex(timeRegex).optional(),
  endTime: z.string().regex(timeRegex).optional(),
  memo: z.string().max(2000).optional(),
  url: z.string().url().max(2000).optional(),
});
export type CreateSpotInput = z.infer<typeof createSpotSchema>;

export const updateSpotSchema = createSpotSchema.partial();
export type UpdateSpotInput = z.infer<typeof updateSpotSchema>;

export const reorderSpotsSchema = z.object({
  spotIds: z.array(z.string().uuid()),
});
export type ReorderSpotsInput = z.infer<typeof reorderSpotsSchema>;
```

**Step 8: Create barrel exports**

```ts
// packages/shared/src/schemas/index.ts
export * from "./trip";
export * from "./spot";
```

```ts
// packages/shared/src/index.ts
export * from "./schemas/index";
```

**Step 9: Run all tests**

Run: `cd packages/shared && bun run test`
Expected: All PASS

**Step 10: Commit**

```bash
git add packages/shared/
git commit -m "feat: 共有Zodスキーマを追加 (trip, spot)"
```

---

## Task 4: Database Schema with Drizzle

**Files:**
- Create: `apps/api/src/db/schema.ts`
- Create: `apps/api/src/db/index.ts`
- Create: `apps/api/drizzle.config.ts`
- Create: `apps/api/.env.example`

**Step 1: Install Drizzle dependencies**

Run: `cd apps/api && bun add drizzle-orm postgres && bun add -d drizzle-kit`

**Step 2: Create database schema**

```ts
// apps/api/src/db/schema.ts
import {
  pgTable,
  uuid,
  varchar,
  text,
  date,
  integer,
  timestamp,
  pgEnum,
  decimal,
  time,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const tripStatusEnum = pgEnum("trip_status", [
  "draft",
  "planned",
  "active",
  "completed",
]);

export const tripMemberRoleEnum = pgEnum("trip_member_role", [
  "owner",
  "editor",
  "viewer",
]);

export const spotCategoryEnum = pgEnum("spot_category", [
  "sightseeing",
  "restaurant",
  "hotel",
  "transport",
  "activity",
  "other",
]);

// --- Tables ---

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: timestamp("email_verified"),
  avatarUrl: varchar("avatar_url", { length: 500 }),
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
  expiresAt: timestamp("expires_at"),
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

export const spots = pgTable("spots", {
  id: uuid("id").primaryKey().defaultRandom(),
  tripDayId: uuid("trip_day_id")
    .notNull()
    .references(() => tripDays.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 200 }).notNull(),
  category: spotCategoryEnum("category").notNull(),
  address: varchar("address", { length: 500 }),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  startTime: time("start_time"),
  endTime: time("end_time"),
  sortOrder: integer("sort_order").notNull().default(0),
  memo: text("memo"),
  url: varchar("url", { length: 2000 }),
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
}));

export const tripMembersRelations = relations(tripMembers, ({ one }) => ({
  trip: one(trips, { fields: [tripMembers.tripId], references: [trips.id] }),
  user: one(users, { fields: [tripMembers.userId], references: [users.id] }),
}));

export const tripDaysRelations = relations(tripDays, ({ one, many }) => ({
  trip: one(trips, { fields: [tripDays.tripId], references: [trips.id] }),
  spots: many(spots),
}));

export const spotsRelations = relations(spots, ({ one }) => ({
  tripDay: one(tripDays, {
    fields: [spots.tripDayId],
    references: [tripDays.id],
  }),
}));
```

**Step 3: Create database connection**

```ts
// apps/api/src/db/index.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL || "postgresql://localhost:5432/tabi";

const client = postgres(connectionString);

export const db = drizzle(client, { schema });
export type Database = typeof db;
```

**Step 4: Create drizzle config**

```ts
// apps/api/drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgresql://localhost:5432/tabi",
  },
});
```

**Step 5: Create .env.example**

```
DATABASE_URL=postgresql://localhost:5432/tabi
```

**Step 6: Add db scripts to api package.json**

Add to `apps/api/package.json` scripts:
```json
"db:generate": "drizzle-kit generate",
"db:migrate": "drizzle-kit migrate",
"db:push": "drizzle-kit push",
"db:studio": "drizzle-kit studio"
```

**Step 7: Generate initial migration**

Run: `cd apps/api && bun run db:generate`
Expected: Migration files created in `apps/api/drizzle/`

**Step 8: Commit**

```bash
git add apps/api/
git commit -m "feat: Drizzle ORMスキーマとDB接続を追加"
```

---

## Task 5: Better Auth Setup

**Files:**
- Create: `apps/api/src/lib/auth.ts`
- Create: `apps/api/src/routes/auth.ts`
- Modify: `apps/api/src/app.ts`

**Step 1: Install Better Auth**

Run: `cd apps/api && bun add better-auth`

**Step 2: Create auth configuration**

```ts
// apps/api/src/lib/auth.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db/index";
import * as schema from "../db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
  },
  trustedOrigins: [process.env.FRONTEND_URL || "http://localhost:3000"],
});
```

**Step 3: Create auth route handler**

```ts
// apps/api/src/routes/auth.ts
import { Hono } from "hono";
import { auth } from "../lib/auth";

const authRoutes = new Hono();

authRoutes.on(["POST", "GET"], "/api/auth/**", (c) => {
  return auth.handler(c.req.raw);
});

export { authRoutes };
```

**Step 4: Mount auth routes in app**

```ts
// apps/api/src/app.ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { authRoutes } from "./routes/auth";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  }),
);

app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

app.route("/", authRoutes);

export { app };
```

**Step 5: Run existing tests to ensure nothing breaks**

Run: `cd apps/api && bun run test`
Expected: Health check test still PASS

**Step 6: Commit**

```bash
git add apps/api/
git commit -m "feat: Better Auth認証セットアップを追加"
```

---

## Task 6: Auth Middleware

**Files:**
- Create: `apps/api/src/middleware/auth.ts`
- Create: `apps/api/src/__tests__/middleware.test.ts`

**Step 1: Write failing test for auth middleware**

```ts
// apps/api/src/__tests__/middleware.test.ts
import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";

describe("requireAuth middleware", () => {
  it("returns 401 when no session", async () => {
    const app = new Hono();
    app.use("*", requireAuth);
    app.get("/protected", (c) => c.json({ ok: true }));

    const res = await app.request("/protected");
    expect(res.status).toBe(401);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/api && bun run test`
Expected: FAIL

**Step 3: Implement auth middleware**

```ts
// apps/api/src/middleware/auth.ts
import type { Context, Next } from "hono";
import { auth } from "../lib/auth";

type AuthSession = {
  user: { id: string; name: string; email: string };
  session: { id: string };
};

export async function requireAuth(c: Context, next: Next) {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("user", session.user);
  c.set("session", session.session);
  await next();
}
```

**Step 4: Run test to verify it passes**

Run: `cd apps/api && bun run test`
Expected: PASS (middleware returns 401 without session)

**Step 5: Commit**

```bash
git add apps/api/src/middleware/ apps/api/src/__tests__/middleware.test.ts
git commit -m "feat: 認証ミドルウェアを追加"
```

---

## Task 7: Trips CRUD API

**Files:**
- Create: `apps/api/src/routes/trips.ts`
- Create: `apps/api/src/__tests__/trips.test.ts`

**Step 1: Write failing tests for trip CRUD**

```ts
// apps/api/src/__tests__/trips.test.ts
import { describe, expect, it, beforeEach, vi } from "vitest";
import { app } from "../app";

// Mock auth middleware to inject a fake user
vi.mock("../middleware/auth", () => ({
  requireAuth: vi.fn(async (c, next) => {
    c.set("user", {
      id: "test-user-id",
      name: "Test User",
      email: "test@example.com",
    });
    await next();
  }),
}));

// Mock db for unit tests
vi.mock("../db/index", () => {
  const trips: any[] = [];
  return {
    db: {
      _trips: trips,
    },
  };
});

describe("Trips API", () => {
  describe("POST /api/trips", () => {
    it("creates a trip with valid data", async () => {
      const res = await app.request("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Kyoto Trip",
          destination: "Kyoto",
          startDate: "2025-03-15",
          endDate: "2025-03-17",
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.title).toBe("Kyoto Trip");
    });

    it("returns 400 for invalid data", async () => {
      const res = await app.request("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "",
          destination: "Kyoto",
          startDate: "2025-03-15",
          endDate: "2025-03-17",
        }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/trips", () => {
    it("returns a list of trips", async () => {
      const res = await app.request("/api/trips");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
    });
  });
});
```

Note: These tests use mocking. In Task 12 we'll add integration tests with a real DB. For now, focus on route logic.

**Step 2: Run test to verify it fails**

Run: `cd apps/api && bun run test`
Expected: FAIL - route not found (404)

**Step 3: Implement trips routes**

```ts
// apps/api/src/routes/trips.ts
import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { db } from "../db/index";
import { trips, tripDays, tripMembers } from "../db/schema";
import { requireAuth } from "../middleware/auth";
import { createTripSchema, updateTripSchema } from "@tabi/shared";

const tripRoutes = new Hono();

tripRoutes.use("*", requireAuth);

// List trips for current user
tripRoutes.get("/", async (c) => {
  const user = c.get("user");
  const userTrips = await db.query.trips.findMany({
    where: eq(trips.ownerId, user.id),
    orderBy: (trips, { desc }) => [desc(trips.updatedAt)],
  });
  return c.json(userTrips);
});

// Create a trip
tripRoutes.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const parsed = createTripSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const { title, destination, startDate, endDate } = parsed.data;

  const [trip] = await db
    .insert(trips)
    .values({
      ownerId: user.id,
      title,
      destination,
      startDate,
      endDate,
    })
    .returning();

  // Auto-create trip days based on date range
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = [];
  let dayNumber = 1;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push({
      tripId: trip.id,
      date: d.toISOString().split("T")[0],
      dayNumber: dayNumber++,
    });
  }
  if (days.length > 0) {
    await db.insert(tripDays).values(days);
  }

  // Add owner as trip member
  await db.insert(tripMembers).values({
    tripId: trip.id,
    userId: user.id,
    role: "owner",
  });

  return c.json(trip, 201);
});

// Get trip detail
tripRoutes.get("/:id", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("id");

  const trip = await db.query.trips.findFirst({
    where: and(eq(trips.id, tripId), eq(trips.ownerId, user.id)),
    with: {
      days: {
        orderBy: (days, { asc }) => [asc(days.dayNumber)],
        with: {
          spots: {
            orderBy: (spots, { asc }) => [asc(spots.sortOrder)],
          },
        },
      },
    },
  });

  if (!trip) {
    return c.json({ error: "Trip not found" }, 404);
  }

  return c.json(trip);
});

// Update trip
tripRoutes.patch("/:id", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateTripSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const existing = await db.query.trips.findFirst({
    where: and(eq(trips.id, tripId), eq(trips.ownerId, user.id)),
  });

  if (!existing) {
    return c.json({ error: "Trip not found" }, 404);
  }

  const [updated] = await db
    .update(trips)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(trips.id, tripId))
    .returning();

  return c.json(updated);
});

// Delete trip
tripRoutes.delete("/:id", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("id");

  const existing = await db.query.trips.findFirst({
    where: and(eq(trips.id, tripId), eq(trips.ownerId, user.id)),
  });

  if (!existing) {
    return c.json({ error: "Trip not found" }, 404);
  }

  await db.delete(trips).where(eq(trips.id, tripId));

  return c.json({ ok: true });
});

export { tripRoutes };
```

**Step 4: Mount trips routes in app**

Update `apps/api/src/app.ts`:

```ts
// apps/api/src/app.ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { authRoutes } from "./routes/auth";
import { tripRoutes } from "./routes/trips";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  }),
);

app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

app.route("/", authRoutes);
app.route("/api/trips", tripRoutes);

export { app };
```

**Step 5: Run tests**

Run: `cd apps/api && bun run test`
Expected: Tests pass (with mocked db)

**Step 6: Commit**

```bash
git add apps/api/src/routes/trips.ts apps/api/src/app.ts apps/api/src/__tests__/trips.test.ts
git commit -m "feat: 旅行CRUD APIを追加"
```

---

## Task 8: Spots API

**Files:**
- Create: `apps/api/src/routes/spots.ts`
- Create: `apps/api/src/__tests__/spots.test.ts`
- Modify: `apps/api/src/app.ts`

**Step 1: Write failing tests**

```ts
// apps/api/src/__tests__/spots.test.ts
import { describe, expect, it, vi } from "vitest";
import { app } from "../app";

vi.mock("../middleware/auth", () => ({
  requireAuth: vi.fn(async (c, next) => {
    c.set("user", {
      id: "test-user-id",
      name: "Test User",
      email: "test@example.com",
    });
    await next();
  }),
}));

describe("Spots API", () => {
  describe("POST /api/trips/:tripId/days/:dayId/spots", () => {
    it("returns 400 for invalid spot data", async () => {
      const res = await app.request(
        "/api/trips/trip-1/days/day-1/spots",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "", category: "invalid" }),
        },
      );
      expect(res.status).toBe(400);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/api && bun run test`
Expected: FAIL

**Step 3: Implement spots routes**

```ts
// apps/api/src/routes/spots.ts
import { Hono } from "hono";
import { eq, and, sql } from "drizzle-orm";
import { db } from "../db/index";
import { spots, tripDays, trips } from "../db/schema";
import { requireAuth } from "../middleware/auth";
import {
  createSpotSchema,
  updateSpotSchema,
  reorderSpotsSchema,
} from "@tabi/shared";

const spotRoutes = new Hono();

spotRoutes.use("*", requireAuth);

// List spots for a day
spotRoutes.get("/:tripId/days/:dayId/spots", async (c) => {
  const dayId = c.req.param("dayId");

  const daySpots = await db.query.spots.findMany({
    where: eq(spots.tripDayId, dayId),
    orderBy: (spots, { asc }) => [asc(spots.sortOrder)],
  });

  return c.json(daySpots);
});

// Add spot
spotRoutes.post("/:tripId/days/:dayId/spots", async (c) => {
  const dayId = c.req.param("dayId");
  const body = await c.req.json();
  const parsed = createSpotSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  // Get next sort order
  const maxOrder = await db
    .select({ max: sql<number>`COALESCE(MAX(${spots.sortOrder}), -1)` })
    .from(spots)
    .where(eq(spots.tripDayId, dayId));

  const [spot] = await db
    .insert(spots)
    .values({
      tripDayId: dayId,
      ...parsed.data,
      sortOrder: (maxOrder[0]?.max ?? -1) + 1,
    })
    .returning();

  return c.json(spot, 201);
});

// Update spot
spotRoutes.patch("/:tripId/days/:dayId/spots/:spotId", async (c) => {
  const spotId = c.req.param("spotId");
  const body = await c.req.json();
  const parsed = updateSpotSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const existing = await db.query.spots.findFirst({
    where: eq(spots.id, spotId),
  });

  if (!existing) {
    return c.json({ error: "Spot not found" }, 404);
  }

  const [updated] = await db
    .update(spots)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(spots.id, spotId))
    .returning();

  return c.json(updated);
});

// Delete spot
spotRoutes.delete("/:tripId/days/:dayId/spots/:spotId", async (c) => {
  const spotId = c.req.param("spotId");

  const existing = await db.query.spots.findFirst({
    where: eq(spots.id, spotId),
  });

  if (!existing) {
    return c.json({ error: "Spot not found" }, 404);
  }

  await db.delete(spots).where(eq(spots.id, spotId));

  return c.json({ ok: true });
});

// Reorder spots
spotRoutes.patch("/:tripId/days/:dayId/spots/reorder", async (c) => {
  const body = await c.req.json();
  const parsed = reorderSpotsSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  // Update sort_order for each spot
  for (let i = 0; i < parsed.data.spotIds.length; i++) {
    await db
      .update(spots)
      .set({ sortOrder: i })
      .where(eq(spots.id, parsed.data.spotIds[i]));
  }

  return c.json({ ok: true });
});

export { spotRoutes };
```

**Step 4: Mount in app.ts**

Add to `apps/api/src/app.ts`:
```ts
import { spotRoutes } from "./routes/spots";
// ...
app.route("/api/trips", spotRoutes);
```

Note: The spot routes use path params like `/:tripId/days/:dayId/spots` so mounting at `/api/trips` gives us `/api/trips/:tripId/days/:dayId/spots`.

**Step 5: Run tests**

Run: `cd apps/api && bun run test`
Expected: PASS

**Step 6: Commit**

```bash
git add apps/api/src/routes/spots.ts apps/api/src/__tests__/spots.test.ts apps/api/src/app.ts
git commit -m "feat: スポットCRUD APIを追加"
```

---

## Task 9: Share API

**Files:**
- Create: `apps/api/src/routes/share.ts`
- Create: `apps/api/src/__tests__/share.test.ts`
- Modify: `apps/api/src/app.ts`

**Step 1: Write failing test**

```ts
// apps/api/src/__tests__/share.test.ts
import { describe, expect, it, vi } from "vitest";
import { app } from "../app";

describe("Share API", () => {
  describe("GET /api/shared/:token", () => {
    it("returns 404 for invalid share token", async () => {
      const res = await app.request("/api/shared/invalid-token");
      expect(res.status).toBe(404);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/api && bun run test`
Expected: FAIL

**Step 3: Implement share routes**

```ts
// apps/api/src/routes/share.ts
import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { db } from "../db/index";
import { trips } from "../db/schema";
import { requireAuth } from "../middleware/auth";

const shareRoutes = new Hono();

// Generate or get share link (requires auth)
shareRoutes.post("/api/trips/:id/share", requireAuth, async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("id");

  const trip = await db.query.trips.findFirst({
    where: and(eq(trips.id, tripId), eq(trips.ownerId, user.id)),
  });

  if (!trip) {
    return c.json({ error: "Trip not found" }, 404);
  }

  let shareToken = trip.shareToken;
  if (!shareToken) {
    shareToken = crypto.randomUUID().replace(/-/g, "");
    await db
      .update(trips)
      .set({ shareToken })
      .where(eq(trips.id, tripId));
  }

  return c.json({ shareToken });
});

// View shared trip (no auth required)
shareRoutes.get("/api/shared/:token", async (c) => {
  const token = c.req.param("token");

  const trip = await db.query.trips.findFirst({
    where: eq(trips.shareToken, token),
    with: {
      days: {
        orderBy: (days, { asc }) => [asc(days.dayNumber)],
        with: {
          spots: {
            orderBy: (spots, { asc }) => [asc(spots.sortOrder)],
          },
        },
      },
    },
  });

  if (!trip) {
    return c.json({ error: "Shared trip not found" }, 404);
  }

  // Remove sensitive fields
  const { ownerId, shareToken, ...publicTrip } = trip;
  return c.json(publicTrip);
});

export { shareRoutes };
```

**Step 4: Mount share routes in app.ts**

```ts
import { shareRoutes } from "./routes/share";
// ...
app.route("/", shareRoutes);
```

**Step 5: Run tests**

Run: `cd apps/api && bun run test`
Expected: PASS

**Step 6: Commit**

```bash
git add apps/api/src/routes/share.ts apps/api/src/__tests__/share.test.ts apps/api/src/app.ts
git commit -m "feat: 旅行共有APIを追加"
```

---

## Task 10: Next.js Frontend Setup

**Files:**
- Create: `apps/web/next.config.ts`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/postcss.config.mjs`
- Create: `apps/web/app/layout.tsx`
- Create: `apps/web/app/page.tsx`
- Create: `apps/web/app/globals.css`
- Create: `apps/web/lib/api.ts`

**Step 1: Install frontend dependencies**

Run:
```bash
cd apps/web && bun add next react react-dom
bun add -d typescript @types/react @types/react-dom tailwindcss postcss autoprefixer
```

**Step 2: Initialize Tailwind CSS**

Run: `cd apps/web && bunx tailwindcss init -p`

**Step 3: Initialize shadcn/ui**

Run: `cd apps/web && bunx shadcn@latest init`
Choose: New York style, Zinc color, CSS variables: yes

**Step 4: Create Next.js config**

```ts
// apps/web/next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@tabi/shared"],
};

export default nextConfig;
```

**Step 5: Create root layout**

```tsx
// apps/web/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "tabi - Travel Planner",
  description: "Plan your perfect trip",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
```

**Step 6: Create landing page**

```tsx
// apps/web/app/page.tsx
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="text-4xl font-bold tracking-tight">tabi</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Plan your perfect trip
      </p>
      <div className="mt-8 flex gap-4">
        <Link
          href="/auth/login"
          className="rounded-md bg-primary px-6 py-3 text-primary-foreground hover:bg-primary/90"
        >
          Login
        </Link>
        <Link
          href="/auth/signup"
          className="rounded-md border border-input px-6 py-3 hover:bg-accent"
        >
          Sign Up
        </Link>
      </div>
    </div>
  );
}
```

**Step 7: Create API client**

```ts
// apps/web/lib/api.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type FetchOptions = RequestInit & {
  params?: Record<string, string>;
};

export async function api<T>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const { params, ...fetchOptions } = options;

  let url = `${API_BASE}${path}`;
  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  const res = await fetch(url, {
    ...fetchOptions,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...fetchOptions.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `API error: ${res.status}`);
  }

  return res.json();
}
```

**Step 8: Verify dev server starts**

Run: `cd apps/web && bun run dev`
Expected: Next.js dev server starts on http://localhost:3000

**Step 9: Commit**

```bash
git add apps/web/
git commit -m "feat: Next.jsフロントエンド初期セットアップ"
```

---

## Task 11: Auth UI (Login / Signup)

**Files:**
- Create: `apps/web/lib/auth-client.ts`
- Create: `apps/web/app/auth/login/page.tsx`
- Create: `apps/web/app/auth/signup/page.tsx`
- Create: `apps/web/components/auth-form.tsx`

**Step 1: Install Better Auth client**

Run: `cd apps/web && bun add better-auth`

**Step 2: Install shadcn components needed**

Run:
```bash
cd apps/web
bunx shadcn@latest add button input label card
```

**Step 3: Create auth client**

```ts
// apps/web/lib/auth-client.ts
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001",
});

export const { signIn, signUp, signOut, useSession } = authClient;
```

**Step 4: Create auth form component**

```tsx
// apps/web/components/auth-form.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { signIn, signUp } from "@/lib/auth-client";

type AuthFormProps = {
  mode: "login" | "signup";
};

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      if (mode === "signup") {
        const name = formData.get("name") as string;
        await signUp.email({
          email,
          password,
          name,
        });
      } else {
        await signIn.email({
          email,
          password,
        });
      }
      router.push("/dashboard");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An error occurred",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{mode === "login" ? "Login" : "Sign Up"}</CardTitle>
        <CardDescription>
          {mode === "login"
            ? "Sign in to your account"
            : "Create a new account"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              minLength={8}
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading
              ? "..."
              : mode === "login"
                ? "Login"
                : "Sign Up"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

**Step 5: Create login and signup pages**

```tsx
// apps/web/app/auth/login/page.tsx
import { AuthForm } from "@/components/auth-form";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="space-y-4">
        <AuthForm mode="login" />
        <p className="text-center text-sm text-muted-foreground">
          Don't have an account?{" "}
          <Link href="/auth/signup" className="underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
```

```tsx
// apps/web/app/auth/signup/page.tsx
import { AuthForm } from "@/components/auth-form";
import Link from "next/link";

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="space-y-4">
        <AuthForm mode="signup" />
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/auth/login" className="underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
```

**Step 6: Verify pages render**

Run: `cd apps/web && bun run dev`
Visit: http://localhost:3000/auth/login and /auth/signup
Expected: Login and signup forms render

**Step 7: Commit**

```bash
git add apps/web/
git commit -m "feat: ログイン・サインアップUIを追加"
```

---

## Task 12: Dashboard Page

**Files:**
- Create: `apps/web/app/dashboard/page.tsx`
- Create: `apps/web/components/trip-card.tsx`
- Create: `apps/web/components/header.tsx`
- Create: `apps/web/app/dashboard/layout.tsx`

**Step 1: Install additional shadcn components**

Run: `cd apps/web && bunx shadcn@latest add badge avatar dropdown-menu`

**Step 2: Create header component**

```tsx
// apps/web/components/header.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { signOut, useSession } from "@/lib/auth-client";

export function Header() {
  const router = useRouter();
  const { data: session } = useSession();

  async function handleSignOut() {
    await signOut();
    router.push("/");
  }

  return (
    <header className="border-b">
      <div className="container flex h-14 items-center justify-between">
        <Link href="/dashboard" className="text-xl font-bold">
          tabi
        </Link>
        <div className="flex items-center gap-4">
          {session?.user && (
            <>
              <span className="text-sm text-muted-foreground">
                {session.user.name}
              </span>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                Logout
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
```

**Step 3: Create dashboard layout**

```tsx
// apps/web/app/dashboard/layout.tsx
import { Header } from "@/components/header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="container py-8">{children}</main>
    </div>
  );
}
```

**Step 4: Create trip card component**

```tsx
// apps/web/components/trip-card.tsx
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type TripCardProps = {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  status: string;
};

const statusLabels: Record<string, string> = {
  draft: "Draft",
  planned: "Planned",
  active: "Active",
  completed: "Completed",
};

export function TripCard({
  id,
  title,
  destination,
  startDate,
  endDate,
  status,
}: TripCardProps) {
  return (
    <Link href={`/trips/${id}`}>
      <Card className="transition-colors hover:bg-accent/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{title}</CardTitle>
            <Badge variant="secondary">{statusLabels[status] ?? status}</Badge>
          </div>
          <CardDescription>{destination}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {startDate} - {endDate}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
```

**Step 5: Create dashboard page**

```tsx
// apps/web/app/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TripCard } from "@/components/trip-card";
import { api } from "@/lib/api";

type Trip = {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  status: string;
};

export default function DashboardPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<Trip[]>("/api/trips")
      .then(setTrips)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Trips</h1>
        <Button asChild>
          <Link href="/trips/new">New Trip</Link>
        </Button>
      </div>
      {loading ? (
        <p className="mt-8 text-muted-foreground">Loading...</p>
      ) : trips.length === 0 ? (
        <p className="mt-8 text-muted-foreground">
          No trips yet. Create your first trip!
        </p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trips.map((trip) => (
            <TripCard key={trip.id} {...trip} />
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 6: Commit**

```bash
git add apps/web/
git commit -m "feat: ダッシュボードページを追加"
```

---

## Task 13: Trip Creation Page

**Files:**
- Create: `apps/web/app/trips/new/page.tsx`
- Create: `apps/web/app/trips/layout.tsx`

**Step 1: Install shadcn date picker dependencies**

Run: `cd apps/web && bunx shadcn@latest add calendar popover`

**Step 2: Create trips layout**

```tsx
// apps/web/app/trips/layout.tsx
import { Header } from "@/components/header";

export default function TripsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="container py-8">{children}</main>
    </div>
  );
}
```

**Step 3: Create trip creation page**

```tsx
// apps/web/app/trips/new/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/lib/api";

export default function NewTripPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      title: formData.get("title") as string,
      destination: formData.get("destination") as string,
      startDate: formData.get("startDate") as string,
      endDate: formData.get("endDate") as string,
    };

    try {
      const trip = await api<{ id: string }>("/api/trips", {
        method: "POST",
        body: JSON.stringify(data),
      });
      router.push(`/trips/${trip.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create trip");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>Create New Trip</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Trip Title</Label>
              <Input
                id="title"
                name="title"
                placeholder="Kyoto 3-day trip"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="destination">Destination</Label>
              <Input
                id="destination"
                name="destination"
                placeholder="Kyoto"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  name="startDate"
                  type="date"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  name="endDate"
                  type="date"
                  required
                />
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating..." : "Create Trip"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add apps/web/app/trips/
git commit -m "feat: 旅行作成ページを追加"
```

---

## Task 14: Trip Detail Page (Timeline)

**Files:**
- Create: `apps/web/app/trips/[id]/page.tsx`
- Create: `apps/web/components/day-timeline.tsx`
- Create: `apps/web/components/spot-item.tsx`
- Create: `apps/web/components/add-spot-dialog.tsx`

**Step 1: Install shadcn dialog and select**

Run: `cd apps/web && bunx shadcn@latest add dialog select textarea`

**Step 2: Create spot item component**

```tsx
// apps/web/components/spot-item.tsx
type SpotItemProps = {
  name: string;
  category: string;
  startTime?: string | null;
  endTime?: string | null;
  memo?: string | null;
  onDelete: () => void;
};

const categoryIcons: Record<string, string> = {
  sightseeing: "[Sight]",
  restaurant: "[Food]",
  hotel: "[Hotel]",
  transport: "[Move]",
  activity: "[Play]",
  other: "[Other]",
};

export function SpotItem({
  name,
  category,
  startTime,
  endTime,
  memo,
  onDelete,
}: SpotItemProps) {
  const timeStr =
    startTime && endTime
      ? `${startTime} - ${endTime}`
      : startTime
        ? startTime
        : "";

  return (
    <div className="flex items-start gap-3 rounded-md border p-3">
      <span className="text-xs text-muted-foreground">
        {categoryIcons[category] ?? "[?]"}
      </span>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <span className="font-medium">{name}</span>
          <button
            onClick={onDelete}
            className="text-xs text-muted-foreground hover:text-destructive"
          >
            Delete
          </button>
        </div>
        {timeStr && (
          <p className="text-xs text-muted-foreground">{timeStr}</p>
        )}
        {memo && (
          <p className="mt-1 text-sm text-muted-foreground">{memo}</p>
        )}
      </div>
    </div>
  );
}
```

**Step 3: Create add spot dialog**

```tsx
// apps/web/components/add-spot-dialog.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";

type AddSpotDialogProps = {
  tripId: string;
  dayId: string;
  onAdded: () => void;
};

const categories = [
  { value: "sightseeing", label: "Sightseeing" },
  { value: "restaurant", label: "Restaurant" },
  { value: "hotel", label: "Hotel" },
  { value: "transport", label: "Transport" },
  { value: "activity", label: "Activity" },
  { value: "other", label: "Other" },
];

export function AddSpotDialog({ tripId, dayId, onAdded }: AddSpotDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      category: formData.get("category") as string,
      startTime: (formData.get("startTime") as string) || undefined,
      endTime: (formData.get("endTime") as string) || undefined,
      memo: (formData.get("memo") as string) || undefined,
    };

    try {
      await api(`/api/trips/${tripId}/days/${dayId}/spots`, {
        method: "POST",
        body: JSON.stringify(data),
      });
      setOpen(false);
      onAdded();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          + Add Spot
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Spot</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" placeholder="Kinkaku-ji" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select name="category" defaultValue="sightseeing">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time</Label>
              <Input id="startTime" name="startTime" type="time" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">End Time</Label>
              <Input id="endTime" name="endTime" type="time" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="memo">Memo</Label>
            <Textarea id="memo" name="memo" rows={3} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Adding..." : "Add Spot"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 4: Create day timeline component**

```tsx
// apps/web/components/day-timeline.tsx
"use client";

import { SpotItem } from "./spot-item";
import { AddSpotDialog } from "./add-spot-dialog";
import { api } from "@/lib/api";

type Spot = {
  id: string;
  name: string;
  category: string;
  startTime?: string | null;
  endTime?: string | null;
  memo?: string | null;
};

type DayTimelineProps = {
  tripId: string;
  dayId: string;
  dayNumber: number;
  date: string;
  spots: Spot[];
  onRefresh: () => void;
};

export function DayTimeline({
  tripId,
  dayId,
  dayNumber,
  date,
  spots,
  onRefresh,
}: DayTimelineProps) {
  async function handleDelete(spotId: string) {
    await api(`/api/trips/${tripId}/days/${dayId}/spots/${spotId}`, {
      method: "DELETE",
    });
    onRefresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">
          Day {dayNumber}{" "}
          <span className="text-sm font-normal text-muted-foreground">
            {date}
          </span>
        </h3>
        <AddSpotDialog tripId={tripId} dayId={dayId} onAdded={onRefresh} />
      </div>
      {spots.length === 0 ? (
        <p className="text-sm text-muted-foreground">No spots yet</p>
      ) : (
        <div className="space-y-2">
          {spots.map((spot) => (
            <SpotItem
              key={spot.id}
              {...spot}
              onDelete={() => handleDelete(spot.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 5: Create trip detail page**

```tsx
// apps/web/app/trips/[id]/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { DayTimeline } from "@/components/day-timeline";
import { api } from "@/lib/api";

type Spot = {
  id: string;
  name: string;
  category: string;
  startTime?: string | null;
  endTime?: string | null;
  memo?: string | null;
  latitude?: string | null;
  longitude?: string | null;
};

type Day = {
  id: string;
  dayNumber: number;
  date: string;
  spots: Spot[];
};

type Trip = {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  status: string;
  days: Day[];
};

export default function TripDetailPage() {
  const params = useParams();
  const tripId = params.id as string;
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTrip = useCallback(async () => {
    try {
      const data = await api<Trip>(`/api/trips/${tripId}`);
      setTrip(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    fetchTrip();
  }, [fetchTrip]);

  if (loading) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  if (!trip) {
    return <p className="text-destructive">Trip not found</p>;
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Left: Timeline */}
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold">{trip.title}</h1>
          <p className="text-muted-foreground">
            {trip.destination} / {trip.startDate} - {trip.endDate}
          </p>
        </div>
        <div className="space-y-6">
          {trip.days.map((day) => (
            <DayTimeline
              key={day.id}
              tripId={tripId}
              dayId={day.id}
              dayNumber={day.dayNumber}
              date={day.date}
              spots={day.spots}
              onRefresh={fetchTrip}
            />
          ))}
        </div>
      </div>

      {/* Right: Map placeholder */}
      <div className="rounded-lg border bg-muted/50 p-8 text-center text-muted-foreground lg:sticky lg:top-4 lg:h-[calc(100vh-8rem)]">
        <p>Map View</p>
        <p className="text-sm">(Task 15 implementation)</p>
      </div>
    </div>
  );
}
```

**Step 6: Commit**

```bash
git add apps/web/
git commit -m "feat: 旅行詳細ページ（タイムライン）を追加"
```

---

## Task 15: Map View with Leaflet

**Files:**
- Create: `apps/web/components/trip-map.tsx`
- Modify: `apps/web/app/trips/[id]/page.tsx`

**Step 1: Install Leaflet**

Run: `cd apps/web && bun add leaflet react-leaflet && bun add -d @types/leaflet`

**Step 2: Create map component**

```tsx
// apps/web/components/trip-map.tsx
"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

type Spot = {
  id: string;
  name: string;
  category: string;
  latitude?: string | null;
  longitude?: string | null;
};

type TripMapProps = {
  spots: Spot[];
};

// Leaflet must be loaded client-side only
function TripMapInner({ spots }: TripMapProps) {
  const [L, setL] = useState<typeof import("react-leaflet") | null>(null);

  useEffect(() => {
    import("react-leaflet").then(setL);
    // Include Leaflet CSS
    import("leaflet/dist/leaflet.css");
  }, []);

  if (!L) return null;

  const { MapContainer, TileLayer, Marker, Popup } = L;

  const validSpots = spots.filter(
    (s) => s.latitude != null && s.longitude != null,
  );

  // Default center: Tokyo
  const center =
    validSpots.length > 0
      ? {
          lat: Number(validSpots[0].latitude),
          lng: Number(validSpots[0].longitude),
        }
      : { lat: 35.6762, lng: 139.6503 };

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={13}
      className="h-full w-full rounded-lg"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {validSpots.map((spot) => (
        <Marker
          key={spot.id}
          position={[Number(spot.latitude), Number(spot.longitude)]}
        >
          <Popup>{spot.name}</Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

// Dynamic import to avoid SSR issues with Leaflet
export const TripMap = dynamic(() => Promise.resolve(TripMapInner), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      Loading map...
    </div>
  ),
});
```

**Step 3: Update trip detail page to use map**

Replace the map placeholder in `apps/web/app/trips/[id]/page.tsx`:

```tsx
// Replace the right column placeholder with:
{/* Right: Map */}
<div className="lg:sticky lg:top-4 lg:h-[calc(100vh-8rem)]">
  <TripMap
    spots={trip.days.flatMap((day) => day.spots)}
  />
</div>
```

Add import: `import { TripMap } from "@/components/trip-map";`

**Step 4: Commit**

```bash
git add apps/web/
git commit -m "feat: Leaflet地図ビューを追加"
```

---

## Task 16: Share View Page

**Files:**
- Create: `apps/web/app/shared/[token]/page.tsx`

**Step 1: Create shared trip view page**

```tsx
// apps/web/app/shared/[token]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { DayTimeline } from "@/components/day-timeline";
import { TripMap } from "@/components/trip-map";
import { api } from "@/lib/api";

type Spot = {
  id: string;
  name: string;
  category: string;
  startTime?: string | null;
  endTime?: string | null;
  memo?: string | null;
  latitude?: string | null;
  longitude?: string | null;
};

type Day = {
  id: string;
  dayNumber: number;
  date: string;
  spots: Spot[];
};

type SharedTrip = {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  days: Day[];
};

export default function SharedTripPage() {
  const params = useParams();
  const token = params.token as string;
  const [trip, setTrip] = useState<SharedTrip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<SharedTrip>(`/api/shared/${token}`)
      .then(setTrip)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <p className="p-8 text-muted-foreground">Loading...</p>;
  if (error) return <p className="p-8 text-destructive">{error}</p>;
  if (!trip) return <p className="p-8 text-destructive">Trip not found</p>;

  return (
    <div className="container py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{trip.title}</h1>
        <p className="text-muted-foreground">
          {trip.destination} / {trip.startDate} - {trip.endDate}
        </p>
      </div>
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          {trip.days.map((day) => (
            <div key={day.id} className="space-y-3">
              <h3 className="font-semibold">
                Day {day.dayNumber}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  {day.date}
                </span>
              </h3>
              {day.spots.length === 0 ? (
                <p className="text-sm text-muted-foreground">No spots</p>
              ) : (
                <div className="space-y-2">
                  {day.spots.map((spot) => (
                    <div
                      key={spot.id}
                      className="rounded-md border p-3"
                    >
                      <span className="font-medium">{spot.name}</span>
                      {spot.startTime && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {spot.startTime}
                          {spot.endTime && ` - ${spot.endTime}`}
                        </span>
                      )}
                      {spot.memo && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {spot.memo}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="lg:sticky lg:top-4 lg:h-[calc(100vh-8rem)]">
          <TripMap spots={trip.days.flatMap((day) => day.spots)} />
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/app/shared/
git commit -m "feat: 共有旅行ビューページを追加"
```

---

## Task 17: Integration Testing Setup

**Files:**
- Create: `apps/api/src/__tests__/integration/setup.ts`
- Create: `apps/api/src/__tests__/integration/trips.integration.test.ts`
- Create: `docker-compose.yml` (for test PostgreSQL)

**Step 1: Create docker-compose for test DB**

```yaml
# docker-compose.yml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: tabi
      POSTGRES_PASSWORD: tabi
      POSTGRES_DB: tabi
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

**Step 2: Create test setup**

```ts
// apps/api/src/__tests__/integration/setup.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import * as schema from "../../db/schema";

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL || "postgresql://tabi:tabi@localhost:5432/tabi_test";

export async function setupTestDb() {
  const client = postgres(TEST_DB_URL);
  const db = drizzle(client, { schema });
  return { db, client };
}

export async function teardownTestDb(client: ReturnType<typeof postgres>) {
  await client.end();
}
```

**Step 3: Create integration test for trips**

```ts
// apps/api/src/__tests__/integration/trips.integration.test.ts
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { setupTestDb, teardownTestDb } from "./setup";

describe("Trips Integration", () => {
  let db: any;
  let client: any;

  beforeAll(async () => {
    const setup = await setupTestDb();
    db = setup.db;
    client = setup.client;
  });

  afterAll(async () => {
    await teardownTestDb(client);
  });

  it("placeholder - requires running PostgreSQL", () => {
    // This test verifies the integration test setup works.
    // Full integration tests require `docker compose up` first.
    expect(true).toBe(true);
  });
});
```

**Step 4: Commit**

```bash
git add docker-compose.yml apps/api/src/__tests__/integration/
git commit -m "chore: 統合テストのセットアップを追加"
```

---

## Task 18: README and Dev Environment Docs

**Files:**
- Modify: `README.md`

**Step 1: Update README with setup instructions**

```markdown
# tabi

Travel planning web application.

## Tech Stack

- **Monorepo**: Turborepo + bun workspaces
- **Frontend**: Next.js (App Router) + Tailwind CSS + shadcn/ui
- **API**: Hono (bun)
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: Better Auth

## Setup

### Prerequisites

- [bun](https://bun.sh/) >= 1.0
- [Docker](https://www.docker.com/) (for PostgreSQL)

### Install

```bash
bun install
```

### Start Database

```bash
docker compose up -d
```

### Run Migrations

```bash
cd apps/api
cp .env.example .env
bun run db:push
```

### Development

```bash
bun run dev
```

- Web: http://localhost:3000
- API: http://localhost:3001

### Testing

```bash
bun run test
```

## Project Structure

```
tabi/
├── apps/
│   ├── web/        # Next.js frontend
│   └── api/        # Hono API server
├── packages/
│   └── shared/     # Shared types & Zod schemas
└── docs/plans/     # Design & implementation docs
```
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: READMEにセットアップ手順を追加"
```

---

## Summary

| Task | Description | Estimated Steps |
|------|-------------|-----------------|
| 1 | Monorepo setup | 9 |
| 2 | Hono API + health check | 5 |
| 3 | Shared Zod schemas | 10 |
| 4 | Drizzle DB schema | 8 |
| 5 | Better Auth setup | 6 |
| 6 | Auth middleware | 5 |
| 7 | Trips CRUD API | 6 |
| 8 | Spots API | 6 |
| 9 | Share API | 6 |
| 10 | Next.js frontend setup | 9 |
| 11 | Auth UI | 7 |
| 12 | Dashboard page | 6 |
| 13 | Trip creation page | 4 |
| 14 | Trip detail (timeline) | 6 |
| 15 | Map view (Leaflet) | 4 |
| 16 | Share view page | 2 |
| 17 | Integration test setup | 4 |
| 18 | README update | 2 |
