# Admin Dashboard Design

## Overview

Add a private admin dashboard at `/admin` to monitor key application metrics. Accessible only to the developer/owner via username-based access control.

## Scope

**In scope:**
- Access control via `ADMIN_USERNAME` environment variable
- `GET /api/admin/stats` endpoint returning aggregate metrics
- `/admin` page with card-based dashboard UI
- Supabase free tier usage indicators (MAU, DB size)

**Out of scope:**
- Supabase Storage usage (requires Supabase PAT, deferred)
- Realtime concurrent connections (no public API available)
- Multiple admin users

## Access Control

A new environment variable controls access:

```
ADMIN_USERNAME=<your_username>   # set in .env.local and Vercel
```

`username` is unique in the `users` table (`varchar(30).unique()`), so this is a safe identity check.

A new `requireAdmin` middleware in `apps/api/src/middleware/require-admin.ts` checks the session user's username against `ADMIN_USERNAME`. Returns 403 if not matched or env var is unset.

```ts
export async function requireAdmin(c: Context, next: Next) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  const adminUsername = process.env.ADMIN_USERNAME;
  if (!adminUsername || (session.user as { username?: string }).username !== adminUsername) {
    return c.json({ error: "Forbidden" }, 403);
  }
  await next();
}
```

## API: GET /api/admin/stats

New route file: `apps/api/src/routes/admin.ts`

### Response Shape

```ts
type AdminStatsResponse = {
  users: {
    total: number;       // non-guest users
    guest: number;       // isAnonymous = true
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
    mau: number;          // distinct users with a session created in the last 30 days
    dbSizeBytes: number;  // pg_database_size(current_database())
  };
};
```

### Queries (Drizzle ORM + raw SQL)

```ts
// Non-guest users
const totalUsers = await db
  .select({ count: count() })
  .from(users)
  .where(eq(users.isAnonymous, false));

// Guest users
const guestUsers = await db
  .select({ count: count() })
  .from(users)
  .where(eq(users.isAnonymous, true));

// New users (last 7 / 30 days)
const newLast7 = await db
  .select({ count: count() })
  .from(users)
  .where(and(eq(users.isAnonymous, false), gte(users.createdAt, subDays(new Date(), 7))));

// Trips by status — single query with conditional aggregation
const tripStats = await db
  .select({ status: trips.status, count: count() })
  .from(trips)
  .groupBy(trips.status);

// MAU: distinct users with session in last 30 days
const mau = await db
  .selectDistinct({ userId: sessions.userId })
  .from(sessions)
  .where(gte(sessions.createdAt, subDays(new Date(), 30)));

// DB size
const dbSize = await db.execute(
  sql`SELECT pg_database_size(current_database()) AS size`
);
```

### Registration

Added to `apps/web/app/api/[[...route]]/route.ts` alongside existing routes.

## Frontend: /admin

### File

`apps/web/app/admin/page.tsx` — Client Component using `useQuery`.

### Layout

```
[sugara logo]  管理ダッシュボード

━━ ユーザー ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ 総ユーザー│ │ ゲスト   │ │ 7日新規  │ │ 30日新規 │
│    42    │ │    8     │ │    3     │ │   12     │
└──────────┘ └──────────┘ └──────────┘ └──────────┘

━━ 旅行 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ 総数     │ │ 日程調整 │ │ 下書き   │ │ 計画済   │ │ 旅行中   │ │ 完了     │
│  120     │ │   10     │ │   40     │ │   45     │ │    8     │ │   17     │
└──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘
（7日以内作成: 5件）

━━ コンテンツ ━━━━━━━━━━━━━━━━━━━━━━━━━━━
┌──────────┐ ┌──────────┐
│ スポット  │ │ お土産   │
│  1,234   │ │   89     │
└──────────┘ └──────────┘

━━ Supabase 無料プラン使用状況 ━━━━━━━━━━
MAU      1,234 / 50,000   ████░░░░░░░░░░░░  2.5%
DB サイズ  42 MB / 500 MB  ████░░░░░░░░░░░░  8.4%
```

### Error States

- 403: 「アクセス権がありません」を表示（非管理者がアクセスした場合）
- Network error: 通常のエラー表示

## Files to Create / Modify

| Action | Path |
|--------|------|
| Create | `apps/api/src/middleware/require-admin.ts` |
| Create | `apps/api/src/routes/admin.ts` |
| Modify | `apps/web/app/api/[[...route]]/route.ts` — register adminRoutes |
| Create | `apps/web/app/admin/page.tsx` |

## Environment Variables

| Variable | Example | Where |
|----------|---------|-------|
| `ADMIN_USERNAME` | `mikiya` | `.env.local`, Vercel |
