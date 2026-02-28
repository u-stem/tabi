# Admin Signup Toggle Design

Date: 2026-02-28

## Overview

Add an ON/OFF toggle to the admin dashboard to control new user registration (email/password signup). The motivation is DB storage capacity management on the Supabase free plan (500 MB limit).

Guest (anonymous) users are excluded from the block because they have a 7-day TTL and accumulate minimal data compared to registered users.

## DB

Add `app_settings` table with a single enforced row.

```sql
CREATE TABLE app_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1,
  signup_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  CHECK (id = 1)
);
INSERT INTO app_settings (id, signup_enabled) VALUES (1, true);
```

Add to `apps/api/src/db/schema.ts` via Drizzle, then run `db:generate` + `db:migrate`.

## API Endpoints

### Public (no auth required)

```
GET /api/public/settings → { signupEnabled: boolean }
```

Required because the signup page is shown to unauthenticated users.

### Admin (requireAdmin)

```
GET  /api/admin/settings  → { signupEnabled: boolean }
PATCH /api/admin/settings  body: { signupEnabled: boolean } → { signupEnabled: boolean }
```

## Signup Block

Intercept at Hono route level in `apps/api/src/routes/auth.ts`, before the Better Auth catch-all. Anonymous signup (`/api/auth/sign-in/anonymous`) is not affected.

```ts
authRoutes.post("/api/auth/sign-up/*", async (c, next) => {
  const settings = await getAppSettings();
  if (!settings.signupEnabled) {
    return c.json({ error: "新規利用の受付を停止しています" }, 403);
  }
  return next();
});

authRoutes.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));
```

`getAppSettings()` reads directly from DB. No cache needed since signups are a low-frequency path.

## Frontend Message Touchpoints

All four entry points a user could reach to create an account must handle the disabled state.

| Entry point | File | Behavior when disabled |
|-------------|------|------------------------|
| Landing page | `app/page.tsx` | "新規登録" button disabled with tooltip |
| Signup page | `app/auth/signup/page.tsx` | Form replaced with "受付停止" message |
| Guest upgrade dialog | `components/guest-upgrade-dialog.tsx` | Dialog body replaced with "受付停止" message |
| Form submit fallback | `components/signup-form.tsx` + `auth-error.ts` | Error alert on 403 response |

### Message Text

```
Signup page / guest upgrade dialog (primary):
  「現在、新規利用の受付を停止しています。
   再開までしばらくお待ちください。」

Landing page button tooltip:
  「現在、新規利用の受付を停止しています」

Form submit fallback (auth-error.ts):
  「新規利用の受付を停止しています」
```

### Settings Fetch Strategy

The signup page and landing page fetch `GET /api/public/settings` on load using React Query (`staleTime: 5min`). This prevents the user from seeing a form they cannot submit.

The guest upgrade dialog fetches the same endpoint when opened.

## Admin Dashboard

Add a "設定" section to `apps/web/app/admin/page.tsx`.

```
[ 設定 ]
新規利用受付    [Switch: ON/OFF]
                現在、新規アカウントの登録を受け付けています
                  ↓ when OFF:
                現在、新規利用の受付を停止しています
```

- Toggle calls `PATCH /api/admin/settings` and refetches
- Show loading state during mutation

## Testing

- Unit: `getAppSettings()` with DB mock
- Unit: auth route interceptor returns 403 when disabled, passes through when enabled
- Unit: `translateAuthError` handles signup-disabled 403
- Integration: full signup flow blocked when `signup_enabled = false`
- UI: admin toggle changes value and updates display
