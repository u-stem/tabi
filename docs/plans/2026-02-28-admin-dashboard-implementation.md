# Admin Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a private `/admin` dashboard showing user, trip, content, and Supabase free tier metrics, accessible only to the user whose username matches the `ADMIN_USERNAME` environment variable.

**Architecture:** New `requireAdmin` middleware + `/api/admin/stats` Hono route in `apps/api`, new `app/admin/page.tsx` Client Component in `apps/web`. No DB schema changes.

**Tech Stack:** Hono, Drizzle ORM, Next.js 15, React 19, Tailwind CSS v4, shadcn/ui

---

## Reference

- Design doc: `docs/plans/2026-02-28-admin-dashboard-design.md`
- Route registration: `apps/api/src/app.ts`
- Existing middleware pattern: `apps/api/src/middleware/auth.ts`
- DB tables used: `users`, `sessions`, `trips`, `schedules`, `souvenirItems` (from `apps/api/src/db/schema.ts`)
- Run lint: `bun run --filter @sugara/web check` / `bun run --filter @sugara/api check`
- Run type check: `bun run check-types`

---

## Task 1: requireAdmin Middleware

**Files:**
- Create: `apps/api/src/middleware/require-admin.ts`

**Step 1: Create the file**

```ts
import type { Context, Next } from "hono";
import { auth } from "../lib/auth";

export async function requireAdmin(c: Context, next: Next) {
  const adminUsername = process.env.ADMIN_USERNAME;
  if (!adminUsername) {
    return c.json({ error: "Forbidden" }, 403);
  }

  let session: Awaited<ReturnType<typeof auth.api.getSession>>;
  try {
    session = await auth.api.getSession({ headers: c.req.raw.headers });
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const username = (session.user as { username?: string | null }).username;
  if (username !== adminUsername) {
    return c.json({ error: "Forbidden" }, 403);
  }

  await next();
}
```

**Step 2: Lint and type check**

```bash
bun run --filter @sugara/api check
bun run check-types
```

Expected: no errors.

**Step 3: Commit**

```bash
git add apps/api/src/middleware/require-admin.ts
git commit -m "feat(admin): requireAdminミドルウェアを追加"
```

---

## Task 2: Admin Stats API Route

**Files:**
- Create: `apps/api/src/routes/admin.ts`
- Modify: `apps/api/src/app.ts` (register route)

**Step 1: Create the route file**

```ts
import { and, count, eq, gte, sql } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import { schedules, sessions, souvenirItems, trips, users } from "../db/schema";
import { requireAdmin } from "../middleware/require-admin";

const adminRoutes = new Hono();

adminRoutes.get("/api/admin/stats", requireAdmin, async (c) => {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalUsersResult,
    guestUsersResult,
    newUsers7dResult,
    newUsers30dResult,
    tripStatusResult,
    newTrips7dResult,
    totalSchedulesResult,
    totalSouvenirsResult,
    mauResult,
    dbSizeResult,
  ] = await Promise.all([
    // Non-guest users
    db.select({ count: count() }).from(users).where(eq(users.isAnonymous, false)),
    // Guest users
    db.select({ count: count() }).from(users).where(eq(users.isAnonymous, true)),
    // New non-guest users in last 7 days
    db
      .select({ count: count() })
      .from(users)
      .where(and(eq(users.isAnonymous, false), gte(users.createdAt, sevenDaysAgo))),
    // New non-guest users in last 30 days
    db
      .select({ count: count() })
      .from(users)
      .where(and(eq(users.isAnonymous, false), gte(users.createdAt, thirtyDaysAgo))),
    // Trips grouped by status
    db.select({ status: trips.status, count: count() }).from(trips).groupBy(trips.status),
    // New trips in last 7 days
    db.select({ count: count() }).from(trips).where(gte(trips.createdAt, sevenDaysAgo)),
    // Total schedules
    db.select({ count: count() }).from(schedules),
    // Total souvenir items
    db.select({ count: count() }).from(souvenirItems),
    // MAU: distinct users with a session created in last 30 days
    db
      .selectDistinct({ userId: sessions.userId })
      .from(sessions)
      .where(gte(sessions.createdAt, thirtyDaysAgo)),
    // DB size in bytes
    db.execute(sql`SELECT pg_database_size(current_database()) AS size`),
  ]);

  // Build trips.byStatus map
  const statusMap = { scheduling: 0, draft: 0, planned: 0, active: 0, completed: 0 } as Record<
    string,
    number
  >;
  for (const row of tripStatusResult) {
    statusMap[row.status] = Number(row.count);
  }
  const totalTrips = Object.values(statusMap).reduce((a, b) => a + b, 0);

  return c.json({
    users: {
      total: Number(totalUsersResult[0]?.count ?? 0),
      guest: Number(guestUsersResult[0]?.count ?? 0),
      newLast7Days: Number(newUsers7dResult[0]?.count ?? 0),
      newLast30Days: Number(newUsers30dResult[0]?.count ?? 0),
    },
    trips: {
      total: totalTrips,
      byStatus: statusMap,
      newLast7Days: Number(newTrips7dResult[0]?.count ?? 0),
    },
    content: {
      schedules: Number(totalSchedulesResult[0]?.count ?? 0),
      souvenirs: Number(totalSouvenirsResult[0]?.count ?? 0),
    },
    supabase: {
      mau: mauResult.length,
      dbSizeBytes: Number((dbSizeResult.rows[0] as { size: string }).size),
    },
  });
});

export { adminRoutes };
```

**Step 2: Register the route in app.ts**

Open `apps/api/src/app.ts` and add the following import and route registration:

```ts
// Add import after other route imports:
import { adminRoutes } from "./routes/admin";

// Add route registration before export { app }:
app.route("/", adminRoutes);
```

**Step 3: Lint and type check**

```bash
bun run --filter @sugara/api check
bun run check-types
```

Expected: no errors.

**Step 4: Smoke test**

Start dev server and test (replace `<token>` with a valid session cookie or use browser):

```bash
bun run --filter @sugara/web dev
# In browser (logged in as admin): open http://localhost:3000/api/admin/stats
# Expected: JSON with users/trips/content/supabase stats
# As non-admin: Expected: {"error":"Forbidden"}
```

**Step 5: Commit**

```bash
git add apps/api/src/routes/admin.ts apps/api/src/app.ts
git commit -m "feat(admin): 管理統計APIエンドポイントを追加"
```

---

## Task 3: Admin Dashboard Page

**Files:**
- Create: `apps/web/app/admin/page.tsx`

**Step 1: Add queryKey for admin stats**

Open `apps/web/lib/query-keys.ts` and add an `admin` key:

```ts
// Add to the queryKeys object:
admin: {
  stats: () => ["admin", "stats"] as const,
},
```

**Step 2: Create the page**

Create `apps/web/app/admin/page.tsx`:

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { Logo } from "@/components/logo";
import { ApiError, api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

const SUPABASE_MAU_LIMIT = 50_000;
const SUPABASE_DB_SIZE_LIMIT_BYTES = 500 * 1024 * 1024; // 500 MB

type AdminStatsResponse = {
  users: {
    total: number;
    guest: number;
    newLast7Days: number;
    newLast30Days: number;
  };
  trips: {
    total: number;
    byStatus: {
      scheduling: number;
      draft: number;
      planned: number;
      active: number;
      completed: number;
    };
    newLast7Days: number;
  };
  content: {
    schedules: number;
    souvenirs: number;
  };
  supabase: {
    mau: number;
    dbSizeBytes: number;
  };
};

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value.toLocaleString()}</p>
    </div>
  );
}

function UsageBar({
  label,
  value,
  limit,
  formatValue,
}: {
  label: string;
  value: number;
  limit: number;
  formatValue: (v: number) => string;
}) {
  const pct = Math.min((value / limit) * 100, 100);
  const color = pct >= 80 ? "bg-red-500" : pct >= 60 ? "bg-yellow-500" : "bg-primary";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {formatValue(value)} / {formatValue(limit)}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-right text-xs text-muted-foreground">{pct.toFixed(1)}%</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function AdminPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.admin.stats(),
    queryFn: () => api<AdminStatsResponse>("/api/admin/stats"),
  });

  const isForbidden = error instanceof ApiError && error.status === 403;

  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="container flex h-14 items-center gap-3">
          <Logo />
          <span className="text-sm font-medium text-muted-foreground">管理ダッシュボード</span>
        </div>
      </header>

      <main className="container max-w-4xl space-y-8 py-8">
        {isForbidden && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
            <p className="font-medium text-destructive">アクセス権がありません</p>
          </div>
        )}

        {isLoading && (
          <p className="text-center text-sm text-muted-foreground">読み込み中...</p>
        )}

        {data && (
          <>
            <Section title="ユーザー">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label="総ユーザー" value={data.users.total} />
                <StatCard label="ゲスト" value={data.users.guest} />
                <StatCard label="7日以内 新規" value={data.users.newLast7Days} />
                <StatCard label="30日以内 新規" value={data.users.newLast30Days} />
              </div>
            </Section>

            <Section title="旅行">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <StatCard label="総数" value={data.trips.total} />
                <StatCard label="日程調整" value={data.trips.byStatus.scheduling} />
                <StatCard label="下書き" value={data.trips.byStatus.draft} />
                <StatCard label="計画済" value={data.trips.byStatus.planned} />
                <StatCard label="旅行中" value={data.trips.byStatus.active} />
                <StatCard label="完了" value={data.trips.byStatus.completed} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                7日以内作成: {data.trips.newLast7Days.toLocaleString()}件
              </p>
            </Section>

            <Section title="コンテンツ">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label="スポット" value={data.content.schedules} />
                <StatCard label="お土産" value={data.content.souvenirs} />
              </div>
            </Section>

            <Section title="Supabase 無料プラン使用状況">
              <div className="rounded-lg border bg-card space-y-4 p-5">
                <UsageBar
                  label="MAU（月間アクティブユーザー）"
                  value={data.supabase.mau}
                  limit={SUPABASE_MAU_LIMIT}
                  formatValue={(v) => v.toLocaleString()}
                />
                <UsageBar
                  label="DB サイズ"
                  value={data.supabase.dbSizeBytes}
                  limit={SUPABASE_DB_SIZE_LIMIT_BYTES}
                  formatValue={(v) => `${(v / 1024 / 1024).toFixed(1)} MB`}
                />
              </div>
            </Section>
          </>
        )}
      </main>
    </div>
  );
}
```

**Step 3: Lint and type check**

```bash
bun run --filter @sugara/web check
bun run check-types
```

Expected: no errors.

**Step 4: Verify in browser**

```bash
bun run --filter @sugara/web dev
```

1. Log in as admin user, navigate to `http://localhost:3000/admin`
2. Verify all 4 sections render with correct numbers
3. Log in as non-admin user (or log out), navigate to `/admin` — confirm "アクセス権がありません" is shown

**Step 5: Commit**

```bash
git add apps/web/app/admin/page.tsx apps/web/lib/query-keys.ts
git commit -m "feat(admin): 管理ダッシュボードページを追加"
```

---

## Post-Implementation: Add Environment Variable

Add `ADMIN_USERNAME=<your_username>` to:
1. `apps/web/.env.local` (local dev) — note: this env var is read server-side by Hono, not by Next.js client, so no `NEXT_PUBLIC_` prefix needed
2. Vercel project settings → Environment Variables
