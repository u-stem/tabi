# Announcement Banner Design

## Overview

A site-wide announcement banner backed by Vercel Edge Config. Administrators update
the message from the sugara admin dashboard; the banner appears on all pages without
a redeploy.

## Goals

- Display a dismissible (page-load scoped) banner on all pages when an announcement
  is set.
- Allow the admin to set or clear the message from the existing admin dashboard.
- No redeploy required to change the message.
- No dependency on the database; the banner works even when Supabase is down.

## Architecture

```
Admin dashboard (browser)
  → POST /api/admin/announcement   (requireAuth + requireAdmin)
      → Vercel API PATCH /v1/edge-config/{id}/items
          → Edge Config updated instantly

All pages (browser)
  → GET /api/announcement          (no auth)
      → @vercel/edge-config get("announcement")
          → returns { message: string | null }
  → AnnouncementBanner renders if message is non-empty
```

## Data Model

Edge Config key: `announcement` — plain string.
- Non-empty string → banner displayed.
- Empty string or key absent → no banner.

No type/severity field (YAGNI). Plain text only; no HTML.

## Components

### `GET /api/announcement`

- No authentication required (shown to all users including guests).
- Reads `announcement` key from Edge Config via `@vercel/edge-config`.
- Returns `{ message: string | null }`.
- If `EDGE_CONFIG` env var is absent (local dev), returns `{ message: null }`.

### `POST /api/admin/announcement`

- Requires `requireAuth` + `requireAdmin` middleware.
- Body: `{ message: string }` — empty string clears the banner.
- Calls Vercel REST API: `PATCH https://api.vercel.com/v1/edge-config/{EDGE_CONFIG_ID}/items`
  with `Authorization: Bearer {VERCEL_API_TOKEN}`.
- Returns 200 on success.
- Returns 503 if `VERCEL_API_TOKEN` or `EDGE_CONFIG_ID` env vars are absent.

### `AnnouncementBanner` (Client Component)

- Fetches `/api/announcement` once on mount (no polling).
- Renders a yellow banner identical in style to `OfflineBanner` when message is set.
- Added inside `<header>` in both `header.tsx` and `sp-header.tsx`, above `OfflineBanner`.

### Admin Dashboard UI

- New "アナウンス" section added to the existing admin page (`/admin`).
- Textarea for the message (max 200 chars) + "保存" button + "クリア" button.
- Shows current message on load via `GET /api/admin/announcement` (same endpoint,
  admin-gated read for the management UI).
- Calls `POST /api/admin/announcement` on save/clear.

## Environment Variables

| Variable            | Set by   | Purpose                          |
|---------------------|----------|----------------------------------|
| `EDGE_CONFIG`       | Vercel   | Edge Config connection string    |
| `VERCEL_API_TOKEN`  | Manual   | Token to write Edge Config items |
| `EDGE_CONFIG_ID`    | Manual   | Edge Config store ID             |

`EDGE_CONFIG` is auto-populated when the Edge Config store is linked to the project
in the Vercel dashboard.

## Setup Steps (one-time, manual)

1. Create an Edge Config store in the Vercel dashboard.
2. Link it to the project (auto-sets `EDGE_CONFIG`).
3. Add `announcement` key with value `""`.
4. Create a Vercel API token (Account Settings → Tokens).
5. Add `VERCEL_API_TOKEN` and `EDGE_CONFIG_ID` to Vercel environment variables.

## Local Development

If `EDGE_CONFIG` is absent, `/api/announcement` returns `{ message: null }` and the
banner is never shown. No mock or local Edge Config needed.

## Out of Scope

- Severity levels (info / warning / error) — plain banner only.
- Auto-dismiss timer.
- Per-user dismiss persistence (sessionStorage dismiss is acceptable if added later).
