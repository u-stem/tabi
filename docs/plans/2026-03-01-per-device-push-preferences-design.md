# Per-device push notification preferences design

Date: 2026-03-01

## Problem

Push notification preferences are stored per-user (`notification_preferences.push`).
Turning off push on one device silences push on all devices. Users cannot configure
each device independently.

## Goal

Allow each registered device (push subscription) to have its own push preferences
while keeping in-app notification preferences user-level.

## Approach

Store per-device push preferences as a JSONB column on `push_subscriptions`.
Only overrides are stored; absent keys fall back to `NOTIFICATION_DEFAULTS[type].push`.

## Data layer

### `push_subscriptions` table

Add `preferences JSONB NOT NULL DEFAULT '{}'`.

Example value (sparse — only overrides stored):
```json
{ "schedule_created": false }
```

Fallback logic:
```
enabled = preferences[type] ?? NOTIFICATION_DEFAULTS[type].push
```

### `notification_preferences` table

Remove the `push` column. This table becomes `inApp`-only.

### Migration steps

1. Add `preferences` column to `push_subscriptions` (default `{}`).
2. For each existing subscription, populate `preferences` from the user's
   `notification_preferences.push` values (copy user-level settings into each
   device subscription to preserve existing behaviour).
3. Drop `push` column from `notification_preferences`.

## API layer

### Changed endpoints

| Endpoint | Change |
|----------|--------|
| `GET /api/notification-preferences` | Returns `inApp` only (no `push` field) |
| `PUT /api/notification-preferences` | Ignores `push` field |
| `notifications.ts createNotificationInternal` | Removes `notificationPreferences.push` check; always calls `sendPushToUser` |
| `notifications.ts sendPushToUser` | Filters subscriptions by `sub.preferences[type] ?? NOTIFICATION_DEFAULTS[type].push` |

### New endpoints

```
GET  /api/push-subscriptions/preferences?endpoint=<url>
     → { member_added: true, schedule_created: false, ... }  (all 9 types expanded)
     → 404 if endpoint not found for the authenticated user

PUT  /api/push-subscriptions/preferences
     body: { endpoint: string, type: NotificationType, enabled: boolean }
     → Updates the JSONB key for that subscription
     → 404 if endpoint not found for the authenticated user
```

Authorization: `(userId, endpoint)` unique constraint ensures users can only
read/write their own device's preferences.

## Frontend

### `notification-preferences-section.tsx`

Split the single query into two:

1. **User-level** (`GET /api/notification-preferences`): drives `inApp` switches — unchanged.
2. **Device-level** (new): on mount, call `pushManager.getSubscription()` to get the
   current device's endpoint, then fetch `GET /api/push-subscriptions/preferences?endpoint=...`.

### Push switch states

| State | Push switches |
|-------|--------------|
| `Notification.permission !== "granted"` | Disabled + tooltip "プッシュ通知を有効にしてください" |
| Permission granted, subscription registered | Active, reflect device preferences |

After the user clicks "有効にする" and the subscription is registered, re-fetch
push preferences to activate the switches.

### Toggle data flow

```
User toggles push switch
→ PUT /api/push-subscriptions/preferences { endpoint, type, enabled }
→ invalidateQueries([pushPreferences])
```

## Tests

### `notifications.ts`

- `sendPushToUser` filters by `preferences`:
  - `{}` → falls back to `NOTIFICATION_DEFAULTS`
  - `{ member_added: false }` → skips that subscription for `member_added`
  - Mixed subscriptions (one on, one off) → sends only to the enabled one

### `push-subscriptions` routes

- `GET /api/push-subscriptions/preferences?endpoint=...`:
  - Returns expanded preferences for a known endpoint
  - Returns 404 for an endpoint that does not belong to the user
- `PUT /api/push-subscriptions/preferences`:
  - Updates JSONB key for own device
  - Returns 404 for another user's endpoint

### `notification-preferences` routes

- `PUT` ignores `push` field without error
