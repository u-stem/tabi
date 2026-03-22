# Discord Webhook Notifications Design

## Overview

Trip-level Discord Webhook notifications for sugara. When events occur in a trip (member changes, schedule updates, polls, expenses), send formatted Discord Embed messages to a configured channel.

## Scope

### In scope

- One Discord Webhook per trip (1:1 relationship)
- Owner and editor can configure Webhook
- All notification types supported, selectable per Webhook via `enabledTypes`
- Discord Embed format with type-based color coding and link to trip page
- Synchronous send within existing notification flow
- Retry with automatic deactivation on persistent failure
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
| isActive | BOOLEAN | Active/inactive (auto-deactivated on failure) |
| lastSuccessAt | TIMESTAMP | Last successful send |
| failureCount | INTEGER | Consecutive failure count |
| createdBy | UUID | FK users |
| createdAt | TIMESTAMP | Created at |
| updatedAt | TIMESTAMP | Updated at |

- UNIQUE constraint on `tripId` enforces one Webhook per trip
- `enabledTypes` stores an array like `["member_added", "schedule_created", ...]`
- `failureCount >= 5` triggers auto-deactivation

## API Endpoints

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/api/trips/:id/discord-webhook` | member | Get Webhook config (URL masked) |
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
      - 5xx (Discord outage): failureCount++, retry up to 2 times in-place
      - failureCount >= 5: isActive = false, notify owner via in-app notification
```

Discord send runs after the API response is sent (non-blocking to the client) but is not fire-and-forget — results are awaited to update Webhook state.

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

Embed messages use the trip owner's language setting. Since this is a trip-level (not per-user) notification, individual member language preferences are not considered.

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

- Webhook URL is stored encrypted or at minimum never returned in full via API
- Only owner/editor can configure; viewer can see masked status only
- Rate limiting via existing `rateLimitByIp` middleware
- Webhook URL validated against Discord URL pattern to prevent SSRF

## Notification Type for Webhook Failure

Add `discord_webhook_disabled` to `notificationTypeEnum` to notify the trip owner when a Webhook is auto-deactivated.

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
