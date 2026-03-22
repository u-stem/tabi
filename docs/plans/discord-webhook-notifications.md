# Discord Webhook Notifications Design

## Overview

Trip-level Discord Webhook notifications for sugara. When events occur in a trip (member changes, schedule updates, polls, expenses), send formatted Discord Embed messages to a configured channel.

## Scope

### In scope

- One Discord Webhook per trip (1:1 relationship)
- Owner and editor can configure Webhook
- All notification types supported, selectable per Webhook via `enabledTypes`
- Discord Embed format with type-based color coding and link to trip page
- Integrated into existing fire-and-forget notification flow
- Automatic deactivation on persistent failure (retry once on 5xx)
- Owner notification on deactivation
- Settings UI within trip settings page

### Out of scope

- Per-user DM notifications (requires Discord OAuth, increases personal data)
- Discord OAuth login
- Discord Bot (commands, interactions)
- Multiple Webhooks per trip

## DB Schema

Add `discord_webhooks` table:

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | PK |
| tripId | UUID | FK trips, UNIQUE |
| webhookUrl | TEXT | Discord Webhook URL |
| name | TEXT | Display name (e.g., "Trip notifications") |
| enabledTypes | JSONB | Array of enabled notification types |
| locale | TEXT | Embed message language ("ja" / "en"), set at creation time |
| isActive | BOOLEAN | Active/inactive (auto-deactivated on failure) |
| lastSuccessAt | TIMESTAMP | Last successful send |
| failureCount | INTEGER | Consecutive failure count |
| createdBy | UUID | FK users |
| createdAt | TIMESTAMP | Created at |
| updatedAt | TIMESTAMP | Updated at |

- UNIQUE constraint on `tripId` enforces one Webhook per trip
- `enabledTypes` stores an array like `["member_added", "schedule_created", ...]`
- Notification types not in `enabledTypes` are disabled by default (new types added later require explicit opt-in)
- `discord_webhook_disabled` is excluded from `enabledTypes` selection to prevent recursive notification loops
- `failureCount >= 5` triggers auto-deactivation
- `tripId` FK uses `onDelete: "cascade"` (trip deletion removes Webhook config)
- `createdBy` FK uses `onDelete: "cascade"` (consistent with existing pattern)
- Table uses `.enableRLS()` (consistent with all existing tables)

## API Endpoints

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/api/trips/:id/discord-webhook` | member | Get Webhook config (URL masked). Viewer included intentionally — knowing a Webhook exists is not sensitive |
| POST | `/api/trips/:id/discord-webhook` | owner/editor | Create Webhook |
| PUT | `/api/trips/:id/discord-webhook` | owner/editor | Update Webhook (URL, name, enabledTypes) |
| DELETE | `/api/trips/:id/discord-webhook` | owner/editor | Delete Webhook |
| POST | `/api/trips/:id/discord-webhook/test` | owner/editor | Send test notification |

### Details

- GET masks `webhookUrl` (e.g., `...abcd1234`), never returns full URL
- POST validates URL by calling Discord API before saving
- Test endpoint sends a sample Embed to verify configuration

## Notification Flow

```
Event occurs
  -> Send existing in-app / push notifications
  -> Query discord_webhooks by tripId
  -> If isActive = true AND event type in enabledTypes:
    -> Build Discord Embed
    -> POST to webhookUrl
    -> On success: update lastSuccessAt, reset failureCount = 0
    -> On failure:
      - 404/401 (Webhook invalid): immediately isActive = false, notify owner
      - 5xx (Discord outage): failureCount++, retry once immediately
      - failureCount >= 5: isActive = false, notify owner via in-app notification
```

Discord send is integrated into the existing fire-and-forget notification flow (`void Promise.all(...)` pattern). Webhook state (lastSuccessAt, failureCount) is updated within the same promise.

### Vercel Serverless Constraint

Vercel may freeze the runtime after the API response is sent. Existing push notifications share this constraint. To minimize risk: retry at most once (no exponential backoff), and keep the total Discord send path short. If the runtime freezes mid-send, the failureCount simply won't increment — the next event will retry naturally.

## Discord Embed Format

```
+-----------------------------------+
| Color bar (type-specific)         |
|                                   |
| sugara               <- author   |
|                                   |
| Trip Name            <- title     |
|                                   |
| Tanaka added spot "Tokyo Tower"   |
| to Day 2             <- description|
|                                   |
| View in sugara       <- link      |
|                                   |
| 2026-03-22 14:30     <- timestamp |
+-----------------------------------+
```

### Color scheme

| Category | Types | Color |
|----------|-------|-------|
| Member | member_added, member_removed, role_changed | Blue (#3B82F6) |
| Schedule | schedule_created, schedule_updated, schedule_deleted | Green (#22C55E) |
| Poll | poll_started, poll_closed | Orange (#F97316) |
| Expense | expense_added, settlement_checked | Purple (#A855F7) |

### Localization

Embed messages use the locale set when the Webhook was created (stored in `discord_webhooks.locale`). Since this is a trip-level (not per-user) notification, individual member language preferences are not considered.

Create a dedicated Discord message formatter (similar to existing `PUSH_MSG` pattern in `packages/shared`) that produces localized Embed descriptions for each notification type. This keeps Discord formatting separate from push/in-app formatting.

## Frontend UI

Located in the trip settings page.

### Webhook not configured

- "Set up Discord notifications" button
- Form: Webhook URL input + display name (optional)
- On save: validate URL + send test notification

### Webhook configured

- Display: name, masked URL, status (active/inactive), last success time
- Notification type toggles (per-type on/off)
- "Send test" button
- "Delete" button
- If deactivated: warning banner + "Reactivate" button (re-enter URL)

### Validation

- Webhook URL must match Discord Webhook URL pattern (`https://discord.com/api/webhooks/...` or `https://discordapp.com/api/webhooks/...`)
- Zod schema in `packages/shared` for frontend + API validation

## Security

- Webhook URL is stored in plaintext (leakage risk is limited to message posting to a single channel; DB access already implies Supabase dashboard access). API responses always mask the URL.
- Only owner/editor can configure; viewer can see masked status only
- Rate limiting via existing `rateLimitByIp` middleware
- Webhook URL validated against Discord URL pattern to prevent SSRF

## Notification Type for Webhook Failure

Add `discord_webhook_disabled` to `notificationTypeEnum` to notify the trip owner when a Webhook is auto-deactivated. This requires:

- DB migration: `ALTER TYPE notification_type ADD VALUE 'discord_webhook_disabled'`
- Update `packages/shared/src/schemas/notification.ts`: add to `notificationTypeSchema`, `NOTIFICATION_DEFAULTS`, `NOTIFICATION_TYPE_LABELS`, `formatNotificationText`, `PUSH_MSG`

## Testing Strategy

- Unit tests: Embed builder (message formatting per notification type)
- Unit tests: Webhook URL validation
- Unit tests: Failure counting and deactivation logic
- Integration tests: API endpoints (CRUD, permission checks)
- Integration tests: Notification flow with Discord Webhook (mocked HTTP)

## FAQ Updates

Add entries to `seed-faqs.ts` (JA + EN):
- "How do I set up Discord notifications for my trip?"
- "What events are sent to Discord?"
- "What happens if the Discord Webhook stops working?"

## News Article

Add `apps/web/content/news/{ja,en}/2026-03-22-discord-notifications.md` announcing the feature.
