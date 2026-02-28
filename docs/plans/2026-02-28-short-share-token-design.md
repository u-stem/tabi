# Short Share Token Design

## Overview

Shorten share link tokens from 64 characters to 11 characters, and add rate limiting to public shared-trip endpoints.

## Scope

**In scope:**
- Shorter token generation in `generateShareToken()`
- Rate limiting on `GET /api/shared/:token` and `GET /polls/shared/:token`

**Out of scope:**
- DB column size reduction (unnecessary; `varchar(64)` accepts shorter values)
- Custom slugs or vanity URLs

## Token Shortening

Replace `crypto.randomBytes(32).toString("hex")` with `crypto.randomBytes(8).toString("base64url")`.

| Property | Before | After |
|----------|--------|-------|
| Length | 64 chars (hex) | 11 chars (base64url) |
| Entropy | 256 bits | 64 bits |
| Brute-force at 1M req/s | ~10^63 years | ~580,000 years |

64 bits provides sufficient security for 7-day ephemeral tokens. No DB migration required. Existing long tokens expire naturally within 7 days.

The function is shared between `routes/share.ts` and `routes/polls.ts`, so both token types shorten automatically.

## Rate Limiting

Apply `rateLimitByIp({ window: 60, max: 30 })` to the two unauthenticated read endpoints:

- `GET /api/shared/:token` (`routes/share.ts`)
- `GET /polls/shared/:token` (`routes/polls.ts`)

**Why `window: 60, max: 30`:** OGP crawlers (LINE, Discord, X) each use distinct IPs and make one request per link preview — no impact. A legitimate user opening a shared page multiple times within a minute will not hit 30 requests.

Note: the rate limiter uses an in-memory store. In Vercel's serverless environment, each function instance has its own memory, so enforcement is best-effort across instances.

## Files to Change

| Action | Path |
|--------|------|
| Modify | `apps/api/src/lib/share-token.ts` |
| Modify | `apps/api/src/routes/share.ts` |
| Modify | `apps/api/src/routes/polls.ts` |

## Testing

- `share-token.test.ts`: assert token length is 11 and consists of base64url characters
- `share.test.ts`: assert `GET /api/shared/:token` returns 429 after exceeding the rate limit
