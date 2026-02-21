# Guest Account Design

## Overview

Allow users to try the app without registration. Guest accounts expire after 7 days. Guests can upgrade to a full account and keep their data.

## Requirements

- Purpose: demo/trial experience
- Scope: create and edit 1 trip (schedules, days, etc.)
- Restrictions: no friends, groups, or sharing
- Expiration: 7 days from creation
- Upgrade: username + password registration, data carries over
- Guest indicator: header banner with remaining days + registration button
- Trigger: "Guest" button on login and signup pages

## Data Model

### DB Changes

Better Auth anonymous plugin adds `isAnonymous: boolean` to users table automatically.

Manual addition:
- `guestExpiresAt: timestamp | null` on users table (null for regular users)

### Guest User Defaults

| Field | Value |
|-------|-------|
| email | `{uuid}@guest.sugara.local` |
| username | `guest-{shortId}` |
| name | `ゲスト` |
| isAnonymous | `true` |
| guestExpiresAt | `now + 7 days` |

## Authentication

### Plugin Setup

Server (`apps/api/src/lib/auth.ts`):
```ts
import { anonymous } from "better-auth/plugins"

plugins: [
  anonymous({
    emailDomainName: "guest.sugara.local",
    onLinkAccount: async ({ anonymousUser, newUser }) => {
      // Transfer trips, trip_members, trip_days, schedules from anonymousUser to newUser
    },
  }),
]
```

Client (`apps/web/lib/auth-client.ts`):
```ts
import { anonymousClient } from "better-auth/client/plugins"

plugins: [anonymousClient()]
```

### Guest Creation Flow

1. User taps "ゲストで試す" on login/signup page
2. Call `authClient.signIn.anonymous()`
3. Server creates guest user with `guestExpiresAt = now + 7 days`
4. Session issued, redirect to home

### Upgrade Flow

1. User taps "アカウント登録" in header banner
2. ResponsiveDialog opens with username + password form
3. Submit calls `authClient.signUp.email({ username, password, email: auto })`
4. Better Auth auto-links anonymous user
5. `onLinkAccount` transfers trip data to new user
6. Set `isAnonymous = false`, `guestExpiresAt = null`
7. Show success toast, reload page

### Expiration Check

In `requireAuth` middleware: if `guestExpiresAt` is set and expired, return 401. Frontend redirects to login page.

## API Restrictions

### New Middleware: `requireNonGuest`

Returns 403 for anonymous users. Applied to:
- `/api/friends/*`
- `/api/groups/*`
- `POST /api/trips/:id/share`

### Trip Limit

`POST /api/trips`: if guest and already has 1 trip, return 403.

### Rate Limiting

Guest creation: 3 requests per 60 seconds (same as signup).

## Frontend

### Login/Signup Pages

Add below existing form:
```
──── または ────
[ゲストで試す]
```

### Header Banner

Shown when `isAnonymous === true`:
```
ゲストモード（残り○日）  [アカウント登録]
```
- Compact single line below header
- Days remaining calculated from `guestExpiresAt`
- "アカウント登録" opens upgrade dialog

### Guest Restriction UI

- Disabled features (friends, groups, sharing): not hidden, but show toast "アカウント登録すると使えます" on tap
- Trip creation after limit: button disabled with tooltip

## Cleanup

### Script: `bun run db:cleanup-guests`

- Find users where `guestExpiresAt < now AND isAnonymous = true`
- Cascade delete: trips -> trip_days -> schedules, trip_members, sessions, accounts
- Log deleted count

### Future Option

Migrate to Vercel Cron at `/api/cron/cleanup-guests`.
